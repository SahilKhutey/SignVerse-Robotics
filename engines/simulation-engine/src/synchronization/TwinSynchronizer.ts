import { world } from '../ecs/world';

export class TwinSynchronizer {
  public updateRobotState(telemetryPayload: any) {
    const { robotId, position, rotation } = telemetryPayload;
    
    // Find entity in ECS
    let entity = world.where((e) => e.id === robotId).first;
    
    if (!entity) {
      // Spawn new mirrored robot
      entity = world.add({
        id: robotId,
        type: 'robot',
        transform: { position: [0,0,0], rotation: [0,0,0,1] }
      });
    }

    // Update transform
    if (position && rotation) {
      entity.transform = { position, rotation };
    }
  }
}
