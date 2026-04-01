import { useQuery } from '@tanstack/react-query';
import { getMe, getMyPolicy, WorkerProfile, PolicyData } from '@/lib/worker';

export function useWorkerProfile() {
  const profileQuery = useQuery<WorkerProfile>({
    queryKey: ['worker', 'me'],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
  });

  const policyQuery = useQuery<PolicyData>({
    queryKey: ['worker', 'policy'],
    queryFn: getMyPolicy,
    staleTime: 5 * 60 * 1000,
  });

  return {
    profile: profileQuery.data,
    policy: policyQuery.data,
    isLoading: profileQuery.isLoading || policyQuery.isLoading,
    isError: profileQuery.isError || policyQuery.isError,
    refetchAll: () => {
      profileQuery.refetch();
      policyQuery.refetch();
    },
  };
}
