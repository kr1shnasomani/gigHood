'use client';

import { usePathname } from 'next/navigation';

type AppRouteShellProps = {
  children: React.ReactNode;
};

const WORKER_PATHS = new Set(['/login', '/register', '/home', '/chat', '/payouts', '/profile']);

function isWorkerRoute(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/worker-app')) return true;
  return WORKER_PATHS.has(pathname);
}

export default function AppRouteShell({ children }: AppRouteShellProps) {
  const pathname = usePathname();

  if (isWorkerRoute(pathname)) {
    return (
      <div className="worker-theme">
        <div className="app-shell">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
}
