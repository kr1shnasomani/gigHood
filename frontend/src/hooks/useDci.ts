import { useQuery } from '@tanstack/react-query';
import { getDci, DciData } from '@/lib/worker';

export function useDci() {
  const query = useQuery<DciData>({
    queryKey: ['worker', 'dci'],
    queryFn: getDci,
    refetchInterval: 60000, // Poll every minute
  });

  return {
    dci: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
