'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const flowSteps = [
  {
    step: '01',
    phase: 'Registration',
    label: 'Spatial Hashing',
    detail: 'Dark store zone → H3 Hex ID via deterministic lat/lng conversion.',
    accent: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.22)',
  },
  {
    step: '02',
    phase: 'Lazy Trigger',
    label: 'GET /me/policy',
    detail: 'First dashboard load fires the policy check. No active policy → triggers create_policy().',
    accent: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.22)',
  },
  {
    step: '03',
    phase: 'Risk Profiling',
    label: 'Data Fusion',
    detail: 'DCI history (12 entries), city flood score, seasonality flag, and claim frequency are pulled.',
    accent: '#06b6d4',
    bg: 'rgba(6,182,212,0.08)',
    border: 'rgba(6,182,212,0.22)',
  },
  {
    step: '04',
    phase: 'ML + Rules',
    label: 'Hybrid Tier Decision',
    detail: 'XGBoost predicts base tier. Rule guardrails run in parallel. Stricter of the two wins.',
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.22)',
  },
  {
    step: '05',
    phase: 'Activity Guard',
    label: 'Ghost-Worker Check',
    detail: 'Fewer than 5 active delivery days in 30d → tier is downgraded once to prevent fraud.',
    accent: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.22)',
  },
  {
    step: '06',
    phase: 'Assignment',
    label: 'Policy Persisted',
    detail: 'Final tier, premium, coverage cap, and Monday–Sunday bounds written to the policies table.',
    accent: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.22)',
  },
];

const tierCards = [
  {
    tier: 'A',
    label: 'Standard Cover',
    cap: '₹600/day',
    premium: '₹20/week',
    monsoon: '₹28 in monsoon',
    desc: 'Low DCI zones, no monsoon flag, healthy claim history.',
    color: '#16a34a',
    bg: '#ffffff',
  },
  {
    tier: 'B',
    label: 'Enhanced Cover',
    cap: '₹700/day',
    premium: '₹30/week',
    monsoon: 'flat — no multiplier',
    desc: 'Moderate disruption or elevated flood proximity score.',
    color: '#d97706',
    bg: '#ffffff',
  },
  {
    tier: 'C',
    label: 'High-Risk Cover',
    cap: '₹800/day',
    premium: '₹42/week',
    monsoon: 'flat — no multiplier',
    desc: 'DCI ≥ 0.65 AND flood score ≥ 0.70 — severe disruption zone.',
    color: '#dc2626',
    bg: '#ffffff',
  },
];

const exampleTrace = [
  { key: 'City', value: 'Bengaluru' },
  { key: 'Zone', value: 'Swiggy Indiranagar' },
  { key: 'Hex ID', value: '8861892a23fffff' },
  { key: 'Flood Score', value: '0.35' },
  { key: 'DCI Avg', value: '0.42' },
  { key: 'Season', value: 'Not Monsoon' },
  { key: 'ML Tier', value: 'A' },
  { key: 'Rules Tier', value: 'A' },
  { key: 'Active Days', value: '0 (new)' },
  { key: 'Downgrade?', value: 'No (already A)' },
  { key: 'Final Tier', value: 'A' },
  { key: 'Coverage Cap', value: '₹600/day' },
  { key: 'Waiting Period', value: '7 days' },
];

export function PolicyAssignmentVisual() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-10% 0px' });

  return (
    <section ref={sectionRef} id="policy-assignment" className="gh-policy-section">
      {/* Layered background */}
      <div className="gh-policy-bg" />
      <div className="gh-policy-bg-shine" />

      <div className="gh-policy-shell">
        {/* Header */}
        <motion.div
          className="gh-policy-header"
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="gh-policy-kicker">Automatic Policy Issuance</span>
          <h2>
            From sign-up to coverage
            <br />
            <span>in a single API round-trip.</span>
          </h2>
          <p>
            The moment a worker hits their dashboard, gigHood silently profiles their risk, runs an
            XGBoost model against rule-based guardrails, and writes a personalised weekly policy —
            no manual underwriting, no blank states.
          </p>
        </motion.div>

        {/* 6-step flow */}
        <div className="gh-policy-flow">
          {flowSteps.map((s, i) => (
            <motion.div
              key={s.step}
              className="gh-policy-flow-step"
              style={
                {
                  '--step-accent': s.accent,
                  '--step-bg': s.bg,
                  '--step-border': s.border,
                } as React.CSSProperties
              }
              initial={{ opacity: 0, y: 28 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.12 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="gh-policy-flow-num">{s.step}</div>
              <div className="gh-policy-flow-body">
                <span className="gh-policy-flow-phase">{s.phase}</span>
                <p className="gh-policy-flow-label">{s.label}</p>
                <p className="gh-policy-flow-detail">{s.detail}</p>
              </div>
              {i < flowSteps.length - 1 && (
                <ArrowRight size={16} className="gh-policy-flow-arrow" />
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom grid: tiers + live trace */}
        <div className="gh-policy-bottom">
          {/* Tier cards */}
          <motion.div
            className="gh-policy-tiers"
            initial={{ opacity: 0, x: -24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="gh-policy-bottom-label">Tier Outcomes</p>
            <div className="gh-policy-tier-grid">
              {tierCards.map((t) => (
                <div
                  key={t.tier}
                  className="gh-policy-tier-card"
                  style={{ background: t.bg }}
                >
                  <div
                    className="gh-policy-tier-badge"
                    style={{ color: t.color, borderColor: t.color }}
                  >
                    Tier {t.tier}
                  </div>
                  <p className="gh-policy-tier-cap" style={{ color: t.color }}>
                    {t.cap}
                  </p>
                  <p className="gh-policy-tier-label">{t.label}</p>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: t.color, margin: '4px 0 2px' }}>
                    {t.premium}
                    <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '11px', marginLeft: 4 }}>({t.monsoon})</span>
                  </p>
                  <p className="gh-policy-tier-desc">{t.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Live execution trace */}
          <motion.div
            className="gh-policy-trace"
            initial={{ opacity: 0, x: 24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="gh-policy-bottom-label">Real Execution — Bengaluru, Apr 23</p>
            <div className="gh-policy-trace-card">
              <div className="gh-policy-trace-dots">
                <span />
                <span />
                <span />
                <p>gighood_policy_engine · live trace</p>
              </div>
              <div className="gh-policy-trace-rows">
                {exampleTrace.map((row, i) => (
                  <motion.div
                    key={row.key}
                    className="gh-policy-trace-row"
                    initial={{ opacity: 0, x: 8 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{
                      duration: 0.38,
                      delay: 0.62 + i * 0.045,
                      ease: 'easeOut',
                    }}
                  >
                    <span className="gh-policy-trace-key">{row.key}</span>
                    <span
                      className="gh-policy-trace-val"
                      data-highlight={
                        row.key === 'Final Tier' ||
                          row.key === 'Coverage Cap' ||
                          row.key === 'Waiting Period'
                          ? 'true'
                          : undefined
                      }
                    >
                      {row.value}
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="gh-policy-trace-footer">
                <span className="gh-policy-trace-status">POLICY ISSUED</span>
                <span>Week: Apr 27 → May 3</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
