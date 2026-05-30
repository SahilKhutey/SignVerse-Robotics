export * from "./generated/client/index.js";
import { PrismaClient } from "./generated/client/index.js";
export const db = new PrismaClient();