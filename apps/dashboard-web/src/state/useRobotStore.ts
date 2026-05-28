import { create } from "zustand";

interface RobotState {
  robots: any[];
  addRobot: (robot: any) => void;
}

export const useRobotStore = create<RobotState>((set) => ({
  robots: [],
  addRobot: (robot) => set((state) => ({ robots: [...state.robots, robot] })),
}));