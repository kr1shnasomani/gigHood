import Link from 'next/link';
import { ArrowRight, LayoutDashboard, ShieldAlert, Wallet } from 'lucide-react';

const modules = [
  {
    title: 'Live Zone Monitoring',
    detail: 'Track disruption states, DCI thresholds, and zone-level event activity in one control surface.',
    icon: LayoutDashboard,
  },
  {
    title: 'Fraud Review Queue',
    detail: 'Inspect high-risk claims routed to manual verification and maintain decision traceability.',
    icon: ShieldAlert,
  },
  {
    title: 'Payout Operations',
    detail: 'Review payout lifecycle metrics and settlement status across policy tiers and city clusters.',
    icon: Wallet,
  },
];

export default function AdminDashboardLandingPage() {
  return (
    <main className="admin-site">
      <section className="admin-hero">
        <p className="project-kicker">Admin Dashboard Surface</p>
        <h1>Admin control plane is being assembled for production workflows.</h1>
        <p>
          This route is now active at <strong>/admin-dashboard</strong>. Full dashboards will be rolled out next
          with live zone map, claims triage, and payout operations modules.
        </p>
        <div className="admin-actions">
          <Link href="/worker-app/home" className="project-cta-main">
            Open Worker App
            <ArrowRight size={16} />
          </Link>
          <Link href="/" className="project-cta-secondary">
            Back to Project Website
          </Link>
        </div>
      </section>

      <section className="admin-module-grid">
        {modules.map((module) => (
          <article key={module.title}>
            <module.icon size={18} />
            <h2>{module.title}</h2>
            <p>{module.detail}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
