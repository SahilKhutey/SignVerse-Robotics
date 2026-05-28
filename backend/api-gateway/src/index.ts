import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";

const server = Fastify({ logger: true });
server.register(fastifyWebsocket);

server.get("/", async (request, reply) => {
  return { status: "SignVerse API Gateway Online" };
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