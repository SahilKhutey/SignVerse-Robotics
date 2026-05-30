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
}