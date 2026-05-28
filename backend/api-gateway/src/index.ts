import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import v1Routes from "./routes/v1";

const server = Fastify({ logger: true });

// Register WebSockets for Realtime Phase
server.register(fastifyWebsocket);

// Register v1 API routes
server.register(v1Routes, { prefix: "/v1" });

server.get("/", async () => {
  return { status: "SignVerse API Gateway Online", version: "v1" };
});

// WebSocket Connection Pooling (Phase 2.1)
server.get("/ws/telemetry", { websocket: true }, (connection, req) => {
  connection.socket.on("message", message => {
    // Broadcast telemetry...
    connection.socket.send(`Received: ${message}`);
  });
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();