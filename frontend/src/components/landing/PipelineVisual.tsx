'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, MapPinned, Search } from 'lucide-react';

type Stage = {
  num: string;
  label: string;
  sublabel: string;
  bgColor: string;
  textColor: string;
  visual: ReactNode;
  what: string;
  description: string;
};

const stages: Stage[] = [
  {
    num: '01',
    label: 'Claim Intake',
    sublabel: 'ENTRY GATE',
    bgColor: '#93C5FD',
    textColor: '#0F172A',
    visual: (
      <div className="gh-pipeline-code-card gh-pipeline-code-card-tilt">
        <div className="gh-pipeline-code-dots">
          <span />
          <span />
          <span />
        </div>
        <p><strong>if</strong> claim.worker_id is null:</p>
        <p className="gh-pipeline-code-indent"><strong>return</strong> reject(&apos;missing_identity&apos;)</p>
        <p><strong>if</strong> duplicate_window(claim) is true:</p>
        <p className="gh-pipeline-code-indent"><strong>return</strong> review_queue(&apos;dup_claim&apos;)</p>
        <p className="gh-pipeline-code-note"># Required payload and idempotency check</p>
      </div>
    ),
    what: 'Required claim structure is validated first.',
    description:
      'gigHood validates worker identity, ride/session linkage, timestamp integrity, and duplicate claim windows so malformed or replayed requests never move forward.',
  },
  {
    num: '02',
    label: 'Policy Eligibility',
    sublabel: 'RULE LAYER',
    bgColor: '#FDE047',
    textColor: '#0F172A',
    visual: (
      <div className="gh-pipeline-retrieval-card gh-pipeline-retrieval-card-tilt">
        <div className="gh-pipeline-retrieval-head">
          <Search size={18} />
          <div />
        </div>
        {[0.99, 0.96, 0.92].map((score) => (
          <div key={score} className="gh-pipeline-score-row">
            <span>{score}</span>
            <div>
              <i />
              <i />
            </div>
          </div>
        ))}
      </div>
    ),
    what: 'Deterministic rules decide basic eligibility.',
    description:
      'Program terms, payout windows, jurisdiction constraints, and product-specific conditions are evaluated before signal models to enforce hard compliance boundaries.',
  },
  {
    num: '03',
    label: 'Signal Fusion',
    sublabel: 'CONTEXT ENGINE',
    bgColor: '#F9A8D4',
    textColor: '#831843',
    visual: (
      <div className="gh-pipeline-novelty-card">
        <MapPinned size={52} />
        <p>DCI 0.78</p>
        <span>ZONE DISRUPTION CONFIRMED</span>
      </div>
    ),
    what: 'Location and disruption signals are fused into DCI.',
    description:
      'Weather, AQI, traffic, platform outage signals, and geo-tagged event streams are fused at H3 resolution to compute a disruption confidence index per claim.',
  },
  {
    num: '04',
    label: 'Fraud + Trust Layer',
    sublabel: 'RISK SCREEN',
    bgColor: '#A7F3D0',
    textColor: '#064E3B',
    visual: (
      <div className="gh-pipeline-meter-card">
        {[
          { label: 'Identity Match', val: 94 },
          { label: 'Behavior Pattern', val: 89 },
          { label: 'Claim Uniqueness', val: 96 },
        ].map((metric) => (
          <div key={metric.label} className="gh-pipeline-meter-row">
            <div>
              <span>{metric.label}</span>
              <span>{metric.val}%</span>
            </div>
            <i>
              <b style={{ width: `${metric.val}%` }} />
            </i>
          </div>
        ))}
        <footer>
          <span>OVERALL STATUS</span>
          <em>APPROVED</em>
        </footer>
      </div>
    ),
    what: 'Trust scoring protects against abuse.',
    description:
      'Account reputation, device/behavior anomalies, and historical abuse fingerprints are evaluated together; high-risk claims route directly to manual operations review.',
  },
  {
    num: '05',
    label: 'Decision Router',
    sublabel: 'CONFIDENCE GATE',
    bgColor: '#C4B5FD',
    textColor: '#2E1065',
    visual: (
      <div className="gh-pipeline-code-card gh-pipeline-code-card-right-tilt">
        <p className="gh-pipeline-code-command">$ route_decision --claim 8f3d21</p>
        <p>[ok] confidence {'>'} threshold <strong>PASS</strong></p>
        <p>[ok] trust risk {'<'} limit <strong>PASS</strong></p>
        <p>[ok] policy flags clear <strong>PASS</strong></p>
        <p className="gh-pipeline-code-result"><ArrowRight size={14} /> AUTO TRACK SELECTED</p>
      </div>
    ),
    what: 'Claims are routed to auto-track or review-track.',
    description:
      'When policy, DCI, and trust signals align, claims move to automated payout. Borderline or conflicting evidence claims are routed to human agents with full context.',
  },
  {
    num: '06',
    label: 'Sandbox Settlement',
    sublabel: 'LIVE PROOF',
    bgColor: '#FBCFE8',
    textColor: '#831843',
    visual: (
      <div className="gh-pipeline-code-card">
        <p className="gh-pipeline-code-command">$ simulate_payout --claim 8f3d21</p>
        <p>[ok] ledger route check <strong>OK</strong></p>
        <p>[ok] duplicate payout lock <strong>OK</strong></p>
        <p>[ok] rollback guardrails <strong>OK</strong></p>
        <p className="gh-pipeline-code-result"><ArrowRight size={14} /> SAFE TO RELEASE</p>
      </div>
    ),
    what: 'Payout execution is tested before funds move.',
    description:
      'gigHood dry-runs settlement flows to verify account routing, lock behavior, and side effects so no destructive payout path reaches production.',
  },
  {
    num: '07',
    label: 'Release + Audit Trail',
    sublabel: 'CLOSED LOOP',
    bgColor: '#BFDBFE',
    textColor: '#1E3A8A',
    visual: (
      <div className="gh-pipeline-meter-card">
        {[
          { label: 'Payout Released', val: 100 },
          { label: 'Evidence Hashed', val: 100 },
          { label: 'Review Log Synced', val: 100 },
        ].map((metric) => (
          <div key={metric.label} className="gh-pipeline-meter-row">
            <div>
              <span>{metric.label}</span>
              <span>{metric.val}%</span>
            </div>
            <i>
              <b style={{ width: `${metric.val}%` }} />
            </i>
          </div>
        ))}
        <footer>
          <span>FINAL STATE</span>
          <em>SETTLED</em>
        </footer>
      </div>
    ),
    what: 'Every decision is explainable and auditable.',
    description:
      'Approved payouts are released with immutable evidence snapshots, while reviewed claims keep full decision lineage for compliance, appeals, and operations analytics.',
  },
];

function StageCard({
  stage,
  index,
  total,
}: {
  stage: Stage;
  index: number;
  total: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start start', 'end start'],
  });

  const stackOffsetY = index * 16;
  const targetScale = 1 - (total - index - 1) * 0.04;
  const y = useTransform(
    scrollYProgress,
    [0, 0.7, 1],
    [70 + stackOffsetY, stackOffsetY, stackOffsetY - 12]
  );
  const scale = useTransform(scrollYProgress, [0, 0.7, 1], [1, targetScale, targetScale]);

  return (
    <div ref={cardRef} style={{ position: 'relative' }} className={`gh-pipeline-stage-wrap ${index === total - 1 ? 'gh-pipeline-stage-last' : ''}`}>
      <div className="gh-pipeline-stage-sticky">
        <motion.article
          style={{
            y,
            scale,
            backgroundColor: stage.bgColor,
            color: stage.textColor,
            zIndex: index + 1,
          }}
          className="gh-pipeline-stage-card"
        >
          <div className="gh-pipeline-stage-copy">
            <span className="gh-pipeline-stage-chip">
              {stage.num} · {stage.sublabel}
            </span>

            <h3>{stage.label}</h3>
            <p className="gh-pipeline-stage-what">{stage.what}</p>
            <p className="gh-pipeline-stage-description">{stage.description}</p>
          </div>

          <div className="gh-pipeline-stage-visual">{stage.visual}</div>
        </motion.article>
      </div>
    </div>
  );
}

export function PipelineVisual() {
  return (
    <section id="pipeline" className="gh-pipeline-section">
      <div className="gh-pipeline-bg-base" />
      <div className="gh-pipeline-bg-gradient" />
      <div className="gh-pipeline-bg-shine" />

      <div className="gh-pipeline-shell">
        <div className="gh-pipeline-header">
          <h2>
            How gigHood decides.
            <br />
            <span>Seven gated checks in sequence.</span>
          </h2>
          <p>
            Each disruption claim moves through intake, eligibility rules, signal fusion, fraud screening,
            confidence routing, sandbox validation, and auditable settlement release.
          </p>
        </div>

        <div className="gh-pipeline-stages">
          {stages.map((stage, index) => (
            <StageCard key={stage.num} stage={stage} index={index} total={stages.length} />
          ))}
        </div>
      </div>
    </section>
  );
}
