import { create } from 'zustand';
import { LandmarkData } from '@signverse/shared-types';

interface LandmarksState {
  landmarks: LandmarkData | null;
  setLandmarks: (landmarks: LandmarkData | null) => void;
}

export const useLandmarksStore = create<LandmarksState>((set) => ({
  landmarks: null,
  setLandmarks: (landmarks) => set({ landmarks }),
}));
