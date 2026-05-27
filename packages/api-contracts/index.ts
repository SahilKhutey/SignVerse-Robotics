import { z } from "zod";

export const TelemetrySchema = z.object({
  robotId: z.string(),
  batteryLevel: z.number(),
  cpuUsage: z.number(),
  gpuUsage: z.number(),
  temperature: z.number(),
  timestamp: z.number()
});

export type TelemetryPacket = z.infer<typeof TelemetrySchema>;
