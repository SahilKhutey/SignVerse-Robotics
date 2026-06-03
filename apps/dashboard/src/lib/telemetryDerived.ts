import { TelemetryFrame } from '@signverse/shared-types';

/**
 * Converts degrees to radians.
 */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Derives joint angular velocities (in rad/s) given consecutive TelemetryFrames.
 * TelemetryFrame joint angles are stored in degrees.
 */
export function calculateVelocities(
  curr: TelemetryFrame,
  prev: TelemetryFrame | null
): number[] {
  const numJoints = 7;
  const velocities = new Array<number>(numJoints).fill(0);

  if (!prev) return velocities;

  const dtSeconds = (curr.timestampMs - prev.timestampMs) / 1000;
  
  // Guard against division by zero or negative time deltas
  if (dtSeconds <= 0) return velocities;

  const currAngles = curr.jointAngles || [];
  const prevAngles = prev.jointAngles || [];

  for (let i = 0; i < numJoints; i++) {
    const currDeg = currAngles[i] ?? 0;
    const prevDeg = prevAngles[i] ?? 0;

    // Convert degrees to radians
    const currRad = degToRad(currDeg);
    const prevRad = degToRad(prevDeg);

    // Compute velocity (rad/s)
    const velocity = (currRad - prevRad) / dtSeconds;
    
    // Clamp extreme velocity spikes due to latency jitter or socket drops
    velocities[i] = Math.max(-50, Math.min(50, parseFloat(velocity.toFixed(4))));
  }

  return velocities;
}
