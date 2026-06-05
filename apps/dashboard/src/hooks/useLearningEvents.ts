import { useEffect } from 'react';
import { useOnlineLearningStore } from '../store/onlineLearning';
import { VITE_WS_URL } from '../lib/env';

let socket: WebSocket | null = null;
let reconnectTimeout: any = null;
let backoff = 1000;
let listenerCount = 0;

function connect() {
  const store = useOnlineLearningStore.getState();

  // If already connecting or live, do nothing
  if (socket) return;

  store.setWsState("connecting");

  const wsProto = VITE_WS_URL.startsWith('https') ? 'wss' : 'ws';
  const host = VITE_WS_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
  const wsUrl = `${wsProto}://${host}/ws/learning_events`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      store.setWsState("live");
      backoff = 1000; // Reset backoff on success
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg || typeof msg !== 'object') {
          console.warn("Received empty or non-object learning event payload", msg);
          return;
        }

        if (msg.type === "forgetting_detected") {
          const alert = msg.alert || {
            task_label: msg.task_label || 'unknown',
            accuracy_before: msg.accuracy_before || 0,
            accuracy_after: msg.accuracy_after || 0,
            drop_percent: msg.drop_percent || 0,
            step: msg.step || 0
          };
          store.pushForgettingAlert(alert);
        } else if (
          msg.type === "update_complete" ||
          msg.type === "checkpoint_saved" ||
          msg.type === "lr_adjusted"
        ) {
          store.pushEvent(msg);
          store.updateAccuracyHistory(msg);
          store.updateLrHistory(msg);
        } else {
          console.warn("Unrecognized message type on /ws/learning_events:", msg.type, msg);
        }
      } catch (err) {
        console.error("Failed to parse or process learning event message:", err);
      }
    };

    socket.onerror = () => {
      store.setWsState("error");
    };

    socket.onclose = () => {
      socket = null;
      store.setWsState("error");

      // Reconnect if there are still active components using this hook
      if (listenerCount > 0) {
        const delay = backoff;
        backoff = Math.min(backoff * 2, 4000);
        reconnectTimeout = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  } catch (err) {
    console.error("Failed to establish WebSocket connection for learning events:", err);
    store.setWsState("error");
    socket = null;
    if (listenerCount > 0) {
      const delay = backoff;
      backoff = Math.min(backoff * 2, 4000);
      reconnectTimeout = setTimeout(() => {
        connect();
      }, delay);
    }
  }
}

function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  useOnlineLearningStore.getState().setWsState("idle");
}

export function useLearningEvents() {
  const wsState = useOnlineLearningStore((state) => state.wsState);

  useEffect(() => {
    listenerCount++;
    if (listenerCount === 1) {
      connect();
    }

    return () => {
      listenerCount--;
      if (listenerCount === 0) {
        disconnect();
      }
    };
  }, []);

  return { wsState };
}
