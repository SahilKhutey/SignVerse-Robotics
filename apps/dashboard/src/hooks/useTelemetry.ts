import { useTelemetryStore } from '../store/telemetry';

export function useTelemetry() {
  const frame = useTelemetryStore((state) => state.frame);
  const hz = useTelemetryStore((state) => state.hz);
  const wsState = useTelemetryStore((state) => state.wsState);
  const activeRobotId = useTelemetryStore((state) => state.activeRobotId);
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);

  return {
    frame,
    hz,
    wsState,
    activeRobotId,
    isEstopTriggered,
  };
}
