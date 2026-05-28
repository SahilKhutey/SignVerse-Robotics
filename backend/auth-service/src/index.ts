import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { db } from "@shared/database";

const server = Fastify({ logger: true });

server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "supersecret"
});

server.post("/login", async (request, reply) => {
  // Stub for JWT logic
  const token = server.jwt.sign({ role: "admin" });
  return { token };
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();