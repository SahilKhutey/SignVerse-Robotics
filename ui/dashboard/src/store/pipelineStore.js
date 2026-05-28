import { create } from 'zustand';

export const usePipelineStore = create((set) => ({
  activeJobs: [],
  nodes: [], // Will store ReactFlow nodes
  edges: [], // Will store ReactFlow edges
  pipelineStatus: 'IDLE', // IDLE, RUNNING, ERROR

  addJob: (job) => set((state) => ({ activeJobs: [...state.activeJobs, job] })),
  removeJob: (jobId) => set((state) => ({ activeJobs: state.activeJobs.filter(j => j.id !== jobId) })),
  updateJobProgress: (jobId, progress) => 
    set((state) => ({
      activeJobs: state.activeJobs.map(j => 
        j.id === jobId ? { ...j, progress } : j
      )
    })),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
}));
