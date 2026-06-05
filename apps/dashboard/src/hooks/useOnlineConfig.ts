import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { OnlineLearnerState } from '@signverse/shared-types';

export function useOnlineConfig() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    OnlineLearnerState,
    Error,
    { learning_rate?: number; ewc_lambda?: number; replay_ratio?: number }
  >({
    mutationFn: (cfg) => apiClient.updateOnlineConfig(cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online_state'] });
    },
  });

  return {
    updateConfig: mutation.mutate,
    isPending: mutation.isPending,
  };
}
