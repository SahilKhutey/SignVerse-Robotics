import { FastifyInstance } from "fastify";
export default async function v1Routes(fastify: FastifyInstance) {
  fastify.get("/status", async () => {
    return { version: "1.0", status: "operational" };
  });
}