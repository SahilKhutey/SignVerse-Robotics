import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { SystemStatus, SessionRecord, TrainingStatus } from '@signverse/shared-types';

export function useSystemStatus() {
  return useQuery<SystemStatus, Error>({
    queryKey: ['systemStatus'],
    queryFn: () => apiClient.get<SystemStatus>('/api/system/status'),
    refetchInterval: 5000,
  });
}

export function useSessions() {
  return useQuery<SessionRecord[], Error>({
    queryKey: ['sessions'],
    queryFn: () => apiClient.get<SessionRecord[]>('/api/sessions'),
  });
}

export function useTrainingStatus(isTrainingActive: boolean) {
  return useQuery<TrainingStatus, Error>({
    queryKey: ['trainingStatus'],
    queryFn: () => apiClient.get<TrainingStatus>('/api/training/status'),
    refetchInterval: isTrainingActive ? 2000 : false,
  });
}
