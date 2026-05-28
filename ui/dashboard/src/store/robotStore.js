import { create } from 'zustand';

export const useRobotStore = create((set) => ({
  connectedRobots: [],
  activeRobot: null,
  robotState: {
    joints: [],
    endEffector: { x: 0, y: 0, z: 0 },
    status: 'DISCONNECTED',
  },
  livePose: null,
  robotAngles: null,
  liveGesture: null,

  setActiveRobot: (robot) => set({ activeRobot: robot }),
  updateRobotState: (stateUpdate) => 
    set((state) => ({ robotState: { ...state.robotState, ...stateUpdate } })),
  setLivePose: (poseData) => set({ livePose: poseData }),
  setRobotAngles: (angles) => set({ robotAngles: angles }),
  setLiveGesture: (gesture) => set({ liveGesture: gesture }),
  connectRobot: (robot) => 
    set((state) => ({ connectedRobots: [...state.connectedRobots, robot] })),
  disconnectRobot: (robotId) => 
    set((state) => ({ connectedRobots: state.connectedRobots.filter(r => r.id !== robotId) })),
}));
