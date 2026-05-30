import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcryptjs";

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

// ─── JWT Plugin ───────────────────────────────────────────────────────────────
await server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "signverse-dev-secret-change-in-production",
  sign: {
    expiresIn: "15m",
  },
});

// ─── Auth Hook ────────────────────────────────────────────────────────────────
const authenticate = async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
  }
};

// ─── Health ───────────────────────────────────────────────────────────────────
server.get("/health", async () => ({
  status: "ok",
  service: "auth-service",
  timestamp: new Date().toISOString(),
}));

// ─── Register ─────────────────────────────────────────────────────────────────
server.post("/register", async (request, reply) => {
  const { email, password, role } = request.body as {
    email: string;
    password: string;
    role?: string;
  };

  if (!email || !password) {
    return reply.status(400).send({ error: "email and password are required" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Production: store in DB via @shared/database PrismaClient
  server.log.info({ email, role }, "User registered (stub)");

  return {
    message: "User registered successfully",
    email,
    role: role ?? "viewer",
    passwordHash: "[hidden]",
  };
});

// ─── Login ────────────────────────────────────────────────────────────────────
server.post("/login", async (request, reply) => {
  const { email, password } = request.body as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    return reply.status(400).send({ error: "email and password are required" });
  }

  // Production: lookup user from DB, verify password hash
  // Stub: simulate successful admin login
  const isValid = password.length > 0; // Replace with: bcrypt.compare(password, storedHash)
  if (!isValid) {
    return reply.status(401).send({ error: "Invalid credentials" });
  }

  const accessToken = server.jwt.sign({
    sub: "user-stub-id",
    email,
    role: "admin",
    type: "access",
  });

  const refreshToken = server.jwt.sign(
    { sub: "user-stub-id", email, type: "refresh" },
    { expiresIn: "7d" }
  );

  server.log.info({ email }, "User logged in");

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes
    tokenType: "Bearer",
  };
});

// ─── Token Refresh ────────────────────────────────────────────────────────────
server.post("/refresh", async (request, reply) => {
  const { refreshToken } = request.body as { refreshToken: string };
  if (!refreshToken) {
    return reply.status(400).send({ error: "refreshToken is required" });
  }

  try {
    const payload = server.jwt.verify(refreshToken) as any;
    if (payload.type !== "refresh") {
      return reply.status(401).send({ error: "Invalid token type" });
    }

    const newAccessToken = server.jwt.sign({
      sub: payload.sub,
      email: payload.email,
      role: "admin",
      type: "access",
    });

    return { accessToken: newAccessToken, expiresIn: 900, tokenType: "Bearer" };
  } catch {
    return reply.status(401).send({ error: "Invalid or expired refresh token" });
  }
});

// ─── Verify ───────────────────────────────────────────────────────────────────
server.get("/verify", { preHandler: [authenticate] }, async (request) => {
  const user = (request as any).user;
  return { valid: true, user };
});

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3001");
    await server.listen({ port, host: "0.0.0.0" });
    server.log.info(`🔐 Auth Service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();