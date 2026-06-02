"""
ZeroMQ IPC Bus Wrapper.
Provides robust publisher/subscriber and request/reply sockets for fast, inter-process communication.
"""
import json
import logging
from typing import Dict, List, Optional, Tuple, Callable
import zmq

logger = logging.getLogger(__name__)

class IPCBus:
    """
    ZeroMQ-based IPC Bus for high-performance service orchestration on the edge.
    Supports publisher/subscriber topics and request/reply channels.
    """
    def __init__(self):
        self.context = zmq.Context.instance()
        self.pub_socket: Optional[zmq.Socket] = None
        self.sub_socket: Optional[zmq.Socket] = None
        self.rep_sockets: Dict[str, zmq.Socket] = {}
        self.req_sockets: Dict[str, zmq.Socket] = {}
        self.poller = zmq.Poller()
        self._subscriptions: List[str] = []

    def setup_publisher(self, address: str):
        """Configure a publisher socket binding to the given address."""
        if self.pub_socket is not None:
            self.pub_socket.close()
        self.pub_socket = self.context.socket(zmq.PUB)
        # Avoid buffering too many messages if subscriber is slow
        self.pub_socket.setsockopt(zmq.SNDHWM, 1000)
        self.pub_socket.bind(address)
        logger.info(f"IPC Publisher bound to {address}")

    def setup_subscriber(self, addresses: List[str], topics: List[str]):
        """Configure a subscriber socket connecting to the given addresses and filtering by topics."""
        if self.sub_socket is not None:
            self.poller.unregister(self.sub_socket)
            self.sub_socket.close()
        self.sub_socket = self.context.socket(zmq.SUB)
        self.sub_socket.setsockopt(zmq.RCVHWM, 1000)
        
        for addr in addresses:
            self.sub_socket.connect(addr)
            
        for topic in topics:
            self.sub_socket.setsockopt_string(zmq.SUBSCRIBE, topic)
            self._subscriptions.append(topic)
            
        self.poller.register(self.sub_socket, zmq.POLLIN)
        logger.info(f"IPC Subscriber connected to {addresses} filtering topics: {topics}")

    def publish(self, topic: str, payload: dict):
        """Publish a message over the pub socket."""
        if not self.pub_socket:
            raise RuntimeError("Publisher socket not initialized. Call setup_publisher first.")
        message = f"{topic} {json.dumps(payload)}"
        try:
            self.pub_socket.send_string(message, flags=zmq.NOBLOCK)
        except zmq.Again:
            logger.warning(f"Publish failed: transmit buffer full for topic {topic}")
        except Exception as e:
            logger.error(f"Error publishing on topic {topic}: {e}")

    def poll(self, timeout_ms: int = 0) -> List[Tuple[str, dict]]:
        """Poll the subscriber socket for incoming messages. Returns a list of (topic, payload) tuples."""
        if not self.sub_socket:
            return []
            
        events = dict(self.poller.poll(timeout_ms))
        messages = []
        
        if self.sub_socket in events and events[self.sub_socket] == zmq.POLLIN:
            while True:
                try:
                    # Non-blocking drain
                    msg_str = self.sub_socket.recv_string(flags=zmq.NOBLOCK)
                    parts = msg_str.split(" ", 1)
                    if len(parts) == 2:
                        topic, body = parts
                        messages.append((topic, json.loads(body)))
                    else:
                        logger.warning(f"Malformed raw message received: {msg_str}")
                except zmq.Again:
                    break
                except Exception as e:
                    logger.error(f"Error reading message: {e}")
                    break
                    
        return messages

    def setup_reply(self, address: str) -> zmq.Socket:
        """Set up a reply (REP) socket binding to the given address."""
        if address in self.rep_sockets:
            return self.rep_sockets[address]
        rep_socket = self.context.socket(zmq.REP)
        rep_socket.bind(address)
        self.rep_sockets[address] = rep_socket
        self.poller.register(rep_socket, zmq.POLLIN)
        logger.info(f"IPC Reply socket bound to {address}")
        return rep_socket

    def setup_request(self, address: str) -> zmq.Socket:
        """Set up a request (REQ) socket connecting to the given address."""
        if address in self.req_sockets:
            return self.req_sockets[address]
        req_socket = self.context.socket(zmq.REQ)
        req_socket.connect(address)
        self.req_sockets[address] = req_socket
        logger.info(f"IPC Request socket connected to {address}")
        return req_socket

    def send_request(self, address: str, payload: dict, timeout_ms: int = 1000) -> Optional[dict]:
        """Send a request and wait for a reply with a timeout."""
        socket = self.setup_request(address)
        try:
            socket.send_string(json.dumps(payload))
            
            # Use poller for timeout on receive
            poller = zmq.Poller()
            poller.register(socket, zmq.POLLIN)
            events = dict(poller.poll(timeout_ms))
            
            if socket in events and events[socket] == zmq.POLLIN:
                rep_str = socket.recv_string()
                return json.loads(rep_str)
            else:
                logger.warning(f"Request to {address} timed out after {timeout_ms}ms")
                # REQ sockets must be recreated or reset on timeout/error before reuse
                self.poller.unregister(socket)
                socket.close()
                del self.req_sockets[address]
                return None
        except Exception as e:
            logger.error(f"Error sending request to {address}: {e}")
            try:
                socket.close()
                del self.req_sockets[address]
            except Exception:
                pass
            return None

    def poll_replies(self, timeout_ms: int = 0) -> List[Tuple[str, zmq.Socket, dict]]:
        """Poll reply sockets for incoming requests. Returns list of (address, socket, payload)."""
        if not self.rep_sockets:
            return []
            
        events = dict(self.poller.poll(timeout_ms))
        requests = []
        
        for address, socket in list(self.rep_sockets.items()):
            if socket in events and events[socket] == zmq.POLLIN:
                try:
                    req_str = socket.recv_string(flags=zmq.NOBLOCK)
                    requests.append((address, socket, json.loads(req_str)))
                except zmq.Again:
                    pass
                except Exception as e:
                    logger.error(f"Error receiving request on {address}: {e}")
                    
        return requests

    def send_reply(self, socket: zmq.Socket, payload: dict):
        """Send a reply to a request."""
        try:
            socket.send_string(json.dumps(payload))
        except Exception as e:
            logger.error(f"Error sending reply: {e}")

    def close(self):
        """Clean up and close all sockets."""
        if self.pub_socket:
            self.pub_socket.close()
            self.pub_socket = None
        if self.sub_socket:
            self.poller.unregister(self.sub_socket)
            self.sub_socket.close()
            self.sub_socket = None
        for socket in list(self.rep_sockets.values()):
            try:
                self.poller.unregister(socket)
                socket.close()
            except Exception:
                pass
        self.rep_sockets.clear()
        for socket in list(self.req_sockets.values()):
            try:
                socket.close()
            except Exception:
                pass
        self.req_sockets.clear()
        logger.info("IPC Bus sockets closed.")
