import { create } from "zustand";

interface Robot {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

interface RobotState {
  robots: Robot[];
  addRobot: (robot: Robot) => void;
}

export const useRobotStore = create<RobotState>((set) => ({
  robots: [],
  addRobot: (robot) => set((state) => ({ robots: [...state.robots, robot] })),
}));