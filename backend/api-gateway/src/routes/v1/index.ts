import { FastifyInstance } from "fastify";

export default async function v1Routes(fastify: FastifyInstance) {
  // ─── Status ────────────────────────────────────────────────────────────────
  fastify.get("/status", async () => ({
    version: "1.0",
    status: "operational",
    services: ["api-gateway", "auth", "telemetry", "ai", "fleet"],
    timestamp: new Date().toISOString(),
  }));

  // ─── Robots ────────────────────────────────────────────────────────────────
  fastify.get("/robots", async () => ({
    robots: [],
    message: "Robot registry — connect to fleet-service for live data",
  }));

  fastify.get("/robots/:id", async (request) => {
    const { id } = request.params as { id: string };
    return { robotId: id, status: "unknown", message: "Connect fleet-service" };
  });

  // ─── Telemetry ─────────────────────────────────────────────────────────────
  fastify.get("/telemetry/:robotId", async (request) => {
    const { robotId } = request.params as { robotId: string };
    return {
      robotId,
      message: "Use /ws/telemetry WebSocket for live data",
      restEndpoint: "Available — connect TimescaleDB for history",
    };
  });

  // ─── AI ────────────────────────────────────────────────────────────────────
  fastify.get("/ai/models", async () => ({
    models: [],
    message: "Model registry endpoint — connect ai-service",
  }));

  // ─── Fleet ─────────────────────────────────────────────────────────────────
  fastify.get("/fleet/status", async () => ({
    fleetId: "signverse-fleet-1",
    totalRobots: 0,
    activeRobots: 0,
    message: "Connect fleet-service for live fleet data",
  }));

  // ─── Missions ──────────────────────────────────────────────────────────────
  fastify.get("/missions", async () => ({
    missions: [],
    message: "Mission control endpoint — connect mission-service",
  }));

  // ─── Safety ────────────────────────────────────────────────────────────────
  fastify.post("/safety/estop", async (request, reply) => {
    const { robotId, reason } = request.body as { robotId?: string; reason?: string };
    if (!robotId) {
      return reply.status(400).send({ error: "robotId is required" });
    }
    return {
      status: "ESTOP_COMMAND_RECEIVED",
      robotId,
      reason: reason ?? "MANUAL_TRIGGER",
      timestamp: new Date().toISOString(),
      note: "E-Stop dispatched — connect safety-service for hardware interrupt",
    };
  });

  // ─── Simulation ────────────────────────────────────────────────────────────
  // In-flight simulation jobs: jobId → { policy, steps, frames }
  const simJobs = new Map<string, { policy: string; steps: number; startedAt: number }>();

  /**
   * POST /v1/simulation/run
   * Body: { policy: string, steps: number, physics_step_ms: number }
   * Returns: { jobId: string }
   *
   * When the Python MuJoCo runner is available, this should proxy to:
   *   POST http://mujoco-runner:8001/simulate
   * and forward the streamed frames to the SSE endpoint below.
   */
  fastify.post("/simulation/run", async (request, reply) => {
    const body = request.body as {
      policy?: string;
      steps?: number;
      physics_step_ms?: number;
    };

    if (!body.policy) {
      return reply.status(400).send({ error: "policy is required" });
    }

    const jobId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    simJobs.set(jobId, {
      policy: body.policy,
      steps: body.steps ?? 200,
      startedAt: Date.now(),
    });

    fastify.log.info({ jobId, policy: body.policy, steps: body.steps }, "Simulation job created");

    return { jobId, status: "STARTED", message: "Poll /v1/simulation/stream/:jobId for SSE trajectory frames" };
  });

  /**
   * GET /v1/simulation/stream/:jobId
   * Server-Sent Events stream of TelemetryFrame-shaped objects.
   * Each event: { frame: TelemetryFrame, progress: number (0–100) }
   *
   * Mock implementation generates physics-plausible joint angle trajectories.
   * Replace the inner loop with a proxy to the Python MuJoCo runner when ready.
   */
  fastify.get("/simulation/stream/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = simJobs.get(jobId);

    if (!job) {
      return reply.status(404).send({ error: `Simulation job ${jobId} not found` });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    const { steps } = job;
    const FRAME_INTERVAL_MS = 16; // ~60fps delivery
    let frameIdx = 0;
    const startTime = Date.now();

    const send = (data: Record<string, unknown>) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch { /* client disconnected */ }
    };

    // Keepalive ping every 5s
    const pingInterval = setInterval(() => {
      try { reply.raw.write(": ping\n\n"); } catch { clearInterval(pingInterval); }
    }, 5000);

    // Frame generator: deterministic physics-style trajectory
    const frameTimer = setInterval(() => {
      if (frameIdx >= steps || !reply.raw.writable) {
        clearInterval(frameTimer);
        clearInterval(pingInterval);
        send({ frame: null, progress: 100, done: true });
        try { reply.raw.end(); } catch { /* already closed */ }
        simJobs.delete(jobId);
        return;
      }

      const t = (frameIdx / steps) * Math.PI * 4;
      const frame = {
        jointAngles: [
          Math.sin(t) * 45 + (Math.random() - 0.5) * 2,
          Math.cos(t) * 30 + (Math.random() - 0.5) * 1.5,
          Math.sin(t * 1.5) * 20 + (Math.random() - 0.5) * 1,
          Math.cos(t * 0.8) * 25 + (Math.random() - 0.5) * 1.5,
          Math.sin(t * 2) * 15 + (Math.random() - 0.5) * 0.8,
          Math.cos(t * 1.2) * 10 + (Math.random() - 0.5) * 0.5,
          Math.sin(t * 0.5) * 5 + (Math.random() - 0.5) * 0.3,
        ],
        poseLandmarks: [],
        aiPrediction: [],
        confidence: 0.85 - (frameIdx / steps) * 0.1,
        timestampMs: startTime + frameIdx * FRAME_INTERVAL_MS,
      };

      const progress = Math.round(((frameIdx + 1) / steps) * 100);
      send({ frame, progress });
      frameIdx++;
    }, FRAME_INTERVAL_MS);

    // Cleanup on client disconnect
    request.raw.on("close", () => {
      clearInterval(frameTimer);
      clearInterval(pingInterval);
    });

    // Keep the handler alive (Fastify needs the promise to not resolve)
    await new Promise<void>((resolve) => {
      reply.raw.on("finish", resolve);
      reply.raw.on("close", resolve);
    });
  });
}