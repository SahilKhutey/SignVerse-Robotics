import { World } from 'miniplex';

export type Entity = {
  id: string;
  type?: 'robot' | 'sensor' | 'obstacle';
  transform?: {
    position: [number, number, number];
    rotation: [number, number, number, number];
  };
  robotState?: any;
  physicsBody?: any;
};

export const world = new World<Entity>();
