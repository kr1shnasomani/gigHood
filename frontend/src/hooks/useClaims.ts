import { useQuery } from '@tanstack/react-query';
import { getClaims, Claim } from '@/lib/worker';

export function useClaims() {
  const query = useQuery<Claim[]>({
    queryKey: ['worker', 'claims'],
    queryFn: getClaims,
    staleTime: 5 * 60 * 1000,
  });

  const claims = query.data || [];
  
  // Example derived stats
  const totalPaid = claims
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + (typeof c.payout_amount === 'number' ? c.payout_amount : 0), 0);

  const pendingCount = claims.filter(c => c.status === 'pending').length;

  return {
    claims,
    totalPaid,
    pendingCount,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
