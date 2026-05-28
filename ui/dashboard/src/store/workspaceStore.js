import { create } from 'zustand';

export const useWorkspaceStore = create((set) => ({
  activeProject: {
    id: 'proj_alpha_01',
    name: 'Alpha Grasp Dataset 01',
  },
  activeRobotId: 'unitree_h1',
  activeDatasetId: null,
  activeTrainingRunId: null,

  setProject: (project) => set({ activeProject: project }),
  setRobot: (robotId) => set({ activeRobotId: robotId }),
  setDataset: (datasetId) => set({ activeDatasetId: datasetId }),
  setTrainingRun: (runId) => set({ activeTrainingRunId: runId }),
}));
