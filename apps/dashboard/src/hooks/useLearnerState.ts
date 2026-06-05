import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { useOnlineLearningStore } from '../store/onlineLearning';
import { OnlineLearnerState } from '@signverse/shared-types';

export function useLearnerState() {
  const setLearnerState = useOnlineLearningStore((state) => state.setLearnerState);

  const query = useQuery<OnlineLearnerState>({
    queryKey: ['online_state'],
    queryFn: () => apiClient.getOnlineState(),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (query.data) {
      setLearnerState(query.data);
    }
  }, [query.data, setLearnerState]);

  return query;
}
