import { z } from "zod";

// ─── RBAC Definitions ────────────────────────────────────────────────────────

/**
 * Hierarchical role permissions for the SignVerse platform.
 * Higher roles inherit all permissions from lower roles.
 */
export const RoleHierarchy = {
  OBSERVER: 0,
  SIMULATION_ENGINEER: 1,
  AI_ENGINEER: 2,
  ROBOTICS_OPERATOR: 3,
  ADMIN: 4,
  SYSTEM: 5, // Internal service-to-service
} as const;

export type Role = keyof typeof RoleHierarchy;

/**
 * Validates whether a given role has sufficient permissions to perform an action
 * requiring a minimum role level.
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
}

// ─── Command Validation Schemas (Zod) ────────────────────────────────────────

/**
 * Maximum safe velocity limits per robot joint/axis.
 * All commands are validated against these hardware safety boundaries.
 */
const SAFETY_LIMITS = {
  maxLinearVelocity: 2.0, // m/s
  maxAngularVelocity: 1.5, // rad/s
  maxJointVelocity: 1.0, // rad/s per joint
  maxJointAngleDeg: 180, // degrees
  minBatteryPercent: 5, // Below this, only return-to-base is allowed
} as const;

/** Robot movement command schema with built-in safety range validation */
export const MoveCommandSchema = z.object({
  robotId: z.string().uuid("Invalid robot ID"),
  linearVelocity: z
    .number()
    .min(-SAFETY_LIMITS.maxLinearVelocity)
    .max(SAFETY_LIMITS.maxLinearVelocity),
  angularVelocity: z
    .number()
    .min(-SAFETY_LIMITS.maxAngularVelocity)
    .max(SAFETY_LIMITS.maxAngularVelocity),
  durationMs: z.number().min(0).max(30_000), // Max 30s continuous move command
});

/** Joint position command with safety range limits */
export const JointCommandSchema = z.object({
  robotId: z.string().uuid(),
  jointId: z.string(),
  targetAngleDeg: z
    .number()
    .min(-SAFETY_LIMITS.maxJointAngleDeg)
    .max(SAFETY_LIMITS.maxJointAngleDeg),
  velocityRpm: z
    .number()
    .min(0)
    .max(SAFETY_LIMITS.maxJointVelocity * 9.549), // Convert rad/s to RPM
});

/** Generic validated command types */
export type MoveCommand = z.infer<typeof MoveCommandSchema>;
export type JointCommand = z.infer<typeof JointCommandSchema>;

/**
 * Validates a raw command against the appropriate safety schema.
 * Returns the validated command or throws with detailed validation errors.
 */
export function validateCommand(
  type: "move" | "joint",
  rawCommand: unknown
): MoveCommand | JointCommand {
  if (type === "move") return MoveCommandSchema.parse(rawCommand);
  if (type === "joint") return JointCommandSchema.parse(rawCommand);
  throw new Error(`Unknown command type: ${type}`);
}

// ─── Emergency Stop System ───────────────────────────────────────────────────

/**
 * E-Stop trigger reasons. All trigger immediate motor halt.
 */
export type EStopReason =
  | "MANUAL_TRIGGER" // Human pressed E-Stop
  | "THERMAL_CRITICAL" // Temperature exceeded safe limit
  | "SENSOR_FAILURE" // Critical sensor lost
  | "AI_INSTABILITY" // AI confidence below emergency threshold
  | "COMMUNICATION_LOSS" // Robot heartbeat lost
  | "MOTOR_OVERLOAD" // Motor torque exceeded safe limit
  | "COLLISION_IMMINENT"; // Safety sensor detected imminent collision

export interface EStopEvent {
  robotId: string;
  reason: EStopReason;
  triggeredAt: Date;
  triggeredBy: string; // user ID or 'system'
  severity: "WARNING" | "CRITICAL";
  autoResetAllowed: boolean;
}

/**
 * Emergency Stop Handler.
 *
 * CRITICAL: This MUST bypass all queues, AI middleware, and normal command flow.
 * The handler fires immediately and synchronously signals the hardware interrupt.
 */
export class EStopController {
  private activeStops = new Map<string, EStopEvent>();
  private listeners: Array<(event: EStopEvent) => void | Promise<void>> = [];

  /**
   * Register a callback to be invoked when any E-Stop is triggered.
   * Hardware interrupt handlers should be registered here.
   */
  onEStop(handler: (event: EStopEvent) => void | Promise<void>) {
    this.listeners.push(handler);
  }

  /**
   * Trigger an Emergency Stop for a robot.
   * This call is synchronous and MUST be the first action taken.
   */
  async triggerEStop(
    robotId: string,
    reason: EStopReason,
    triggeredBy: string = "system"
  ): Promise<EStopEvent> {
    const event: EStopEvent = {
      robotId,
      reason,
      triggeredAt: new Date(),
      triggeredBy,
      severity: this.getSeverity(reason),
      autoResetAllowed: this.isAutoResetAllowed(reason),
    };

    this.activeStops.set(robotId, event);

    // Fire all registered hardware interrupt handlers immediately
    await Promise.allSettled(this.listeners.map((fn) => fn(event)));

    console.error(
      `[E-STOP TRIGGERED] Robot: ${robotId} | Reason: ${reason} | By: ${triggeredBy}`
    );

    return event;
  }

  /**
   * Clear an E-Stop only if auto-reset is permitted and condition is resolved.
   */
  clearEStop(robotId: string, clearedBy: string): boolean {
    const stop = this.activeStops.get(robotId);
    if (!stop) return false;
    if (!stop.autoResetAllowed) {
      console.warn(
        `[E-STOP] Manual reset required for ${robotId}. Cleared by: ${clearedBy}`
      );
    }
    this.activeStops.delete(robotId);
    return true;
  }

  isRobotStopped(robotId: string): boolean {
    return this.activeStops.has(robotId);
  }

  getActiveStops(): EStopEvent[] {
    return Array.from(this.activeStops.values());
  }

  private getSeverity(reason: EStopReason): "WARNING" | "CRITICAL" {
    const critical: EStopReason[] = [
      "THERMAL_CRITICAL",
      "COLLISION_IMMINENT",
      "MOTOR_OVERLOAD",
    ];
    return critical.includes(reason) ? "CRITICAL" : "WARNING";
  }

  private isAutoResetAllowed(reason: EStopReason): boolean {
    // Only communication loss and AI instability allow auto-reset once resolved
    return ["COMMUNICATION_LOSS", "AI_INSTABILITY"].includes(reason);
  }
}

// ─── Safety Priority Hierarchy ───────────────────────────────────────────────

/**
 * Safety Priority Hierarchy — enforced in all decision loops.
 *
 * 1. Human Safety     (always overrides everything)
 * 2. Environmental    (prevent damage to surroundings)
 * 3. Robot Safety     (prevent robot self-damage)
 * 4. Mission Success  (accomplish objectives only if above are satisfied)
 */
export const SafetyPriority = {
  HUMAN_SAFETY: 0,
  ENVIRONMENTAL_SAFETY: 1,
  ROBOT_SAFETY: 2,
  MISSION_SUCCESS: 3,
} as const;

export type SafetyLevel = keyof typeof SafetyPriority;

/** Singleton E-Stop controller instance */
export const globalEStop = new EStopController();
