import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { OnlineLearnerState } from '@signverse/shared-types';

export function useOnlinePause() {
  const queryClient = useQueryClient();

  const mutation = useMutation<OnlineLearnerState, Error, boolean>({
    mutationFn: (paused: boolean) => apiClient.setOnlinePause(paused),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online_state'] });
    },
  });

  return {
    setPause: mutation.mutate,
    isPending: mutation.isPending,
  };
}
