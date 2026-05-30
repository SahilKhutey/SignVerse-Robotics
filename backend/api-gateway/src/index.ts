import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyWebsocket from "@fastify/websocket";
import v1Routes from "./routes/v1/index.js";

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
await server.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
await server.register(fastifyRateLimit, {
  max: 200,
  timeWindow: "1 minute",
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `Rate limit exceeded. Retry after ${context.after}.`,
  }),
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
await server.register(fastifyWebsocket);

// ─── Health Check ─────────────────────────────────────────────────────────────
server.get("/health", async () => ({
  status: "ok",
  service: "api-gateway",
  version: "v1",
  timestamp: new Date().toISOString(),
}));

server.get("/", async () => ({
  status: "SignVerse API Gateway Online",
  version: "v1",
  docs: "/v1",
}));

// ─── API v1 Routes ───────────────────────────────────────────────────────────
await server.register(v1Routes, { prefix: "/v1" });

// ─── WebSocket proxy state ────────────────────────────────────────────────────
const telemetryClients = new Set<any>();
const aiClients = new Set<any>();

function broadcast(clients: Set<any>, message: string) {
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  }
}

let pythonWs: any = null;
let reconnectTimer: NodeJS.Timeout | null = null;

function connectToPythonBackend() {
  if (pythonWs) return;

  const backendUrl = process.env.PYTHON_BACKEND_WS_URL || "ws://localhost:8000/ws/telemetry";
  server.log.info(`Connecting to Python SignVerse OS Kernel at ${backendUrl}...`);

  try {
    // @ts-ignore
    pythonWs = new globalThis.WebSocket(backendUrl);

    pythonWs.onopen = () => {
      server.log.info("Connected to Python SignVerse OS Kernel!");
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    };

    pythonWs.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data.toString());
        if (data.type === "SYSTEM_METRICS") {
          const payload = data.payload || {};
          const q_target = payload.q_target || [0, 0, 0];

          // Map to telemetry format
          const telemetryMsg = JSON.stringify({
            type: "telemetry",
            joints: {
              J0: (q_target[0] || 0) * 57.2958,
              J1: (q_target[1] || 0) * 57.2958,
              J2: (q_target[2] || 0) * 57.2958
            },
            status: payload.status,
            mode: payload.mode
          });
          broadcast(telemetryClients, telemetryMsg);

          // Map to vision format
          const gesture = payload.perception?.gesture || (payload.mode === "ai_inference" ? "THUMBS_UP" : "HOLD");
          const aiMsg = JSON.stringify({
            type: "vision",
            bounding_boxes: [10, 20, 50, 50],
            gesture: gesture
          });
          broadcast(aiClients, aiMsg);
        }
      } catch (err) {
        server.log.error(err, "Failed to parse Python kernel telemetry message");
      }
    };

    pythonWs.onerror = () => {
      // Reconnect handled by onclose
    };

    pythonWs.onclose = () => {
      pythonWs = null;
      server.log.warn("Disconnected from Python SignVerse OS Kernel. Retrying...");
      triggerReconnect();
    };
  } catch (err) {
    pythonWs = null;
    triggerReconnect();
  }
}

function triggerReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      connectToPythonBackend();
    }, 5000);
  }
}

// Start backend connection loop
connectToPythonBackend();

// Sweep simulator when offline to provide dynamic systems telemetry to UI
setInterval(() => {
  if (pythonWs && pythonWs.readyState === 1) return;

  const time = Date.now() / 1000;
  const J0 = 45.0 + Math.sin(time) * 30.0;
  const J1 = 15.0 + Math.cos(time * 0.7) * 20.0;
  const J2 = -30.0 + Math.sin(time * 1.3) * 15.0;

  const telemetryMsg = JSON.stringify({
    type: "telemetry",
    joints: { J0, J1, J2 },
    status: "ONLINE",
    mode: "math_fallback"
  });
  broadcast(telemetryClients, telemetryMsg);

  const gestures = ["THUMBS_UP", "OPEN_PALM", "CLOSED_FIST", "VICTORY"];
  const gestureIndex = Math.floor((time / 3) % gestures.length);
  const aiMsg = JSON.stringify({
    type: "vision",
    bounding_boxes: [15, 25, 45, 45],
    gesture: gestures[gestureIndex]
  });
  broadcast(aiClients, aiMsg);
}, 200);

// ─── WebSocket: Telemetry Stream ──────────────────────────────────────────────
server.get(
  "/ws/telemetry",
  { websocket: true },
  (connection, _req) => {
    server.log.info("WebSocket client connected: telemetry");
    telemetryClients.add(connection.socket);

    connection.socket.on("message", (raw: any) => {
      if (pythonWs && pythonWs.readyState === 1) {
        pythonWs.send(raw);
      }
      try {
        const data = JSON.parse(raw.toString());
        connection.socket.send(
          JSON.stringify({
            type: "telemetry_ack",
            robotId: data.robotId,
            receivedAt: Date.now(),
          })
        );
      } catch {
        connection.socket.send(JSON.stringify({ error: "Invalid JSON payload" }));
      }
    });

    connection.socket.on("close", () => {
      server.log.info("WebSocket client disconnected: telemetry");
      telemetryClients.delete(connection.socket);
    });

    connection.socket.on("error", (err: any) => {
      server.log.error({ err }, "WebSocket error");
      telemetryClients.delete(connection.socket);
    });
  }
);

// ─── WebSocket: AI Inference Stream ───────────────────────────────────────────
server.get(
  "/ws/ai-inference",
  { websocket: true },
  (connection, _req) => {
    server.log.info("WebSocket client connected: ai-inference");
    aiClients.add(connection.socket);

    connection.socket.on("message", (raw: any) => {
      if (pythonWs && pythonWs.readyState === 1) {
        pythonWs.send(raw);
      }
      try {
        const data = JSON.parse(raw.toString());
        connection.socket.send(
          JSON.stringify({
            type: "inference_ack",
            modelId: data.modelId,
            receivedAt: Date.now(),
          })
        );
      } catch {
        connection.socket.send(JSON.stringify({ error: "Invalid payload" }));
      }
    });

    connection.socket.on("close", () => {
      server.log.info("WebSocket client disconnected: ai-inference");
      aiClients.delete(connection.socket);
    });
  }
);

// ─── WebSocket: E-Stop ─────────────────────────────────────────────────────────
server.get(
  "/ws/estop",
  { websocket: true },
  (connection, _req) => {
    server.log.warn("E-Stop WebSocket channel opened");

    connection.socket.on("message", (raw: any) => {
      if (pythonWs && pythonWs.readyState === 1) {
        pythonWs.send(raw);
      }
      try {
        const { robotId, triggeredBy } = JSON.parse(raw.toString());
        server.log.error({ robotId, triggeredBy }, "E-STOP TRIGGERED via WebSocket");
        connection.socket.send(
          JSON.stringify({
            type: "estop_ack",
            robotId,
            status: "ESTOP_ACTIVATED",
            timestamp: Date.now(),
          })
        );
      } catch {
        connection.socket.send(JSON.stringify({ error: "Invalid E-Stop payload" }));
      }
    });
  }
);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
server.setNotFoundHandler((_req, reply) => {
  reply.status(404).send({
    statusCode: 404,
    error: "Not Found",
    message: "The requested route does not exist.",
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
server.setErrorHandler((error, _req, reply) => {
  server.log.error(error);
  reply.status(error.statusCode ?? 500).send({
    statusCode: error.statusCode ?? 500,
    error: error.name,
    message: error.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3000");
    const host = process.env.HOST || "0.0.0.0";
    await server.listen({ port, host });
    server.log.info(`🚀 API Gateway running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();