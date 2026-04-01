'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Home, MessageSquare, User } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [pathname, router]);

  const navItems = [
    { href: '/home', label: 'Home', icon: Home },
    { href: '/payouts', label: 'Payouts', icon: Shield },
    { href: '/chat', label: 'Copilot', icon: MessageSquare },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main className={`page-content ${pathname === '/chat' ? 'page-content-chat' : ''}`}>
        {children}
      </main>

      <nav className="glass-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="nav-icon-wrapper">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
