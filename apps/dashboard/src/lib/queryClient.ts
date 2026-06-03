import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { useToastStore } from '../store/toast';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      useToastStore.getState().addToast({
        message: error.message || 'An error occurred during query fetch',
        type: 'error',
        code: error.status ? `HTTP_${error.status}` : 'QUERY_ERROR',
        action: 'Check gateway connection or retry.',
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      useToastStore.getState().addToast({
        message: error.message || 'Operation failed',
        type: 'error',
        code: error.status ? `HTTP_${error.status}` : 'MUTATION_ERROR',
        action: 'Check inputs and connection, then retry.',
      });
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});
