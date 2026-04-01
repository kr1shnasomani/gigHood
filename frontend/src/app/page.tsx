import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  SiDocker,
  SiFastapi,
  SiGooglecloud,
  SiReact,
  SiSupabase,
} from '@icons-pack/react-simple-icons';
import { PipelineVisual } from '@/components/landing/PipelineVisual';
import { TechStackMarquee } from '@/components/landing/TechStackMarquee';

const architectureCards = [
  {
    icon: SiSupabase,
    title: 'Supabase + Postgres',
    text: 'Policy, worker, and payout states are modeled with deterministic storage so disruption decisions stay auditable.',
    tone: 'tone-indigo',
  },
  {
    icon: SiFastapi,
    title: 'FastAPI + Risk Engine',
    text: 'Signal fetchers, DCI computation, fraud gates, and payout orchestration run in one policy-safe backend pipeline.',
    tone: 'tone-cyan',
  },
  {
    icon: SiGooglecloud,
    title: 'Model + Retrieval Layer',
    text: 'Claim context and disruption evidence are retrieved from high-dimensional vector neighborhoods to support deterministic payout decisions.',
    tone: 'tone-red',
  },
  {
    icon: SiReact,
    title: 'React Worker Portal',
    text: 'Workers and operations teams get low-latency portal surfaces for filing, validating, and tracking disruption claims with full transparency.',
    tone: 'tone-emerald',
  },
  {
    icon: SiDocker,
    title: 'Sandbox Simulation',
    text: 'Candidate payout actions are executed in isolated simulation environments before release to prevent destructive side effects.',
    tone: 'tone-amber',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud + Trust Layers',
    text: 'Every claim is routed through layered validation before payout, preserving speed for honest workers and control for operations.',
    tone: 'tone-rose',
  },
];

export default function RootPage() {
  return (
    <main className="project-site">
      <header className="project-topbar project-navbar">
        <div className="project-navbar-inner">
        <div className="project-brand-wrap">
          <span className="project-logo-chip">G</span>
          <p className="project-brand">gigHood</p>
        </div>
        <nav className="project-links project-nav-center">
          <a href="#architecture">Architecture</a>
          <a href="#features">Features</a>
          <a href="#pipeline">How it works</a>
        </nav>
        <div className="project-actions">
          <Link href="/worker-app/login" className="project-link-ghost">
            Submit a claim
          </Link>
          <Link href="/worker-app/login" className="project-link-primary project-link-primary-dark">
            Agent Dashboard
            <ArrowRight size={14} />
          </Link>
        </div>
        </div>
      </header>

      <section className="project-hero project-hero-template">
        <p className="project-announcement">
          <span className="project-announcement-dot" />
          gigHood raises resilience for gig workers with a 5-layer payout pipeline
          <ArrowRight size={13} />
        </p>
        <h1>
          Resolve every disruption claim.
        </h1>
        <p className="project-subtext">
          gigHood helps your team protect earnings by auto-resolving disruption events with mathematically
          proven safety and human-in-the-loop oversight.
        </p>
        <div className="project-cta-row">
          <Link href="/worker-app/register" className="project-pill-btn project-hero-primary">
            Get started
          </Link>
          <Link href="/admin-dashboard" className="project-pill-btn project-hero-secondary">
            See agent portal
          </Link>
        </div>
      </section>

      <TechStackMarquee />

      <section className="project-section project-architecture" id="architecture">
        <div className="project-architecture-shell">
          <div className="project-section-head">
            <h2>Build a foundation with technology that enables immediate scale</h2>
            <Link href="#pipeline" className="project-link-primary project-inline-cta">
              View the pipeline
              <ArrowRight size={15} />
            </Link>
          </div>
          <p className="project-section-lead">
            From vector-ready storage to layered decision logic, the stack is engineered for reliability,
            explainability, and low-latency disruption response.
          </p>
          <div className="project-arch-grid" id="features">
            {architectureCards.map((card) => (
              <article key={card.title} className="project-arch-card">
                <div className={`project-arch-visual ${card.tone}`}>
                  <div className="project-arch-icon-wrap">
                    <card.icon size={78} />
                  </div>
                  <div className="project-arch-badge">
                    <card.icon size={16} />
                    <p>{card.title}</p>
                  </div>
                </div>
                <div className="project-arch-copy">
                  <p>{card.text}</p>
                  <span>Explore component <ArrowRight size={14} /></span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PipelineVisual />

      <section className="project-section project-dual" id="portals">
        <svg className="project-dual-rays" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
          <g>
            <path d="M500,0 L200,500" />
            <path d="M500,0 L300,500" />
            <path d="M500,0 L400,500" />
            <path d="M500,0 L500,500" />
            <path d="M500,0 L600,500" />
            <path d="M500,0 L700,500" />
            <path d="M500,0 L800,500" />
          </g>
        </svg>
        <div className="project-dual-shell">
          <h2>Solutions for Workers and Operations Teams</h2>
          <div className="project-dual-grid">
            <Link href="/worker-app/register" className="project-dual-card left">
              <div>
                <p className="tag">FOR WORKERS</p>
                <h3>Recover earning losses faster with automated disruption payouts.</h3>
              </div>
              <span>Open Portal <ArrowRight size={14} /></span>
            </Link>
            <Link href="/admin-dashboard" className="project-dual-card right">
              <div>
                <p className="tag">FOR OPERATIONS</p>
                <h3>Multiply your team&apos;s payout oversight and risk visibility overnight.</h3>
              </div>
              <span>Open Dashboard <ArrowRight size={14} /></span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="project-footer project-footer-template">
        <div className="project-footer-shell">
          <div className="project-footer-grid">
            <div className="project-footer-brand-block">
              <span className="project-footer-cross corner-left" />
              <span className="project-footer-cross corner-right" />
              <div className="project-footer-brand">
                <span className="project-logo-chip">G</span>
                <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer">gigHood</a>
              </div>
            </div>

            <div className="project-footer-columns">
              <span className="project-footer-cross columns-left" />
              <span className="project-footer-cross columns-right" />
              <div>
                <p>Product</p>
                <Link href="/worker-app/register">Worker Portal</Link>
                <Link href="/worker-app/login">Agent Dashboard</Link>
                <a href="#pipeline">Disruption Claim Flow</a>
              </div>
              <div>
                <p>Platform</p>
                <a href="#pipeline">Payout Pipeline</a>
                <a href="#architecture">System Architecture</a>
                <a href="#portals">Worker and Ops Portals</a>
              </div>
              <div>
                <p>Information</p>
                <a href="https://github.com/Vishnugupta2711/gigHood/blob/main/API.md" target="_blank" rel="noopener noreferrer">API Documentation</a>
                <a href="https://github.com/Vishnugupta2711/gigHood/blob/main/DATABASE.md" target="_blank" rel="noopener noreferrer">Database Design</a>
                <a href="https://github.com/Vishnugupta2711/gigHood/blob/main/README.md" target="_blank" rel="noopener noreferrer">Project Overview</a>
              </div>
              <div>
                <p>Developers</p>
                <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer">Abhay Kumar</a>
                <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer">Ananya Agarwal</a>
                <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer">Krishna Somani</a>
                <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer">Praveen Kumar</a>
                <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer">Vishnu Gupta</a>
              </div>
            </div>
          </div>

          <div className="project-footer-bottom">
            <span className="project-footer-cross bottom-left" />
            <span className="project-footer-cross bottom-right" />
            <p>© 2026 gigHood Inc.</p>
            <a href="https://github.com/Vishnugupta2711/gigHood" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <svg viewBox="0 0 24 24" className="project-footer-github" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
