'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/* ── Signal definitions ─────────────────────────────────── */
const signals = [
  {
    symbol: 'W',
    greek: 'α',
    label: 'Environmental',
    sublabel: 'Weather',
    detail: 'Heavy rainfall ≥ 35mm/hr, severe wind, or hazardous AQI > 300 via CPCB.',
    example: '120mm/hr rainfall · Mumbai',
    weight: 0.42,
    color: '#0284c7', // darker blue
    glow: 'rgba(2,132,199,0.05)',
    border: 'rgba(2,132,199,0.15)',
    bg: '#ffffff',
  },
  {
    symbol: 'T',
    greek: 'β',
    label: 'Traffic',
    sublabel: 'Gridlock',
    detail: 'Severe localized congestion preventing active delivery movement in the hex zone.',
    example: 'Ring Road jammed · Bengaluru',
    weight: 0.26,
    color: '#d97706', // darker amber
    glow: 'rgba(217,119,6,0.05)',
    border: 'rgba(217,119,6,0.15)',
    bg: '#ffffff',
  },
  {
    symbol: 'P',
    greek: 'γ',
    label: 'Platform',
    sublabel: 'Reliability',
    detail: 'Aggregator network latency or sudden API volume drop indicating dark store shutdown.',
    example: 'Swiggy API latency spike',
    weight: 0.20,
    color: '#7c3aed', // darker purple
    glow: 'rgba(124,58,237,0.05)',
    border: 'rgba(124,58,237,0.15)',
    bg: '#ffffff',
  },
  {
    symbol: 'S',
    greek: 'δ',
    label: 'Social',
    sublabel: 'Disruption',
    detail: 'Localized curfews, strikes, or civic blockades preventing worker mobility.',
    example: 'Bandh declared · Pune',
    weight: 0.12,
    color: '#dc2626', // darker red
    glow: 'rgba(220,38,38,0.05)',
    border: 'rgba(220,38,38,0.15)',
    bg: '#ffffff',
  },
];

/* ── Threshold states ───────────────────────────────────── */
const thresholds = [
  {
    label: 'Normal',
    range: 'DCI ≤ 0.65',
    desc: 'Standard operations. No payouts authorized. Workers operate under normal risk conditions.',
    color: '#16a34a', // darker green
    bg: '#ffffff',
    border: 'rgba(22,163,74,0.15)',
    dot: '#22c55e',
    bar: 65,
  },
  {
    label: 'Elevated Watch',
    range: '0.65 < DCI ≤ 0.85',
    desc: 'Risk is high. Worker apps display amber warning. Economic collapse threshold not yet met.',
    color: '#d97706', // darker amber
    bg: '#ffffff',
    border: 'rgba(217,119,6,0.15)',
    dot: '#f59e0b',
    bar: 77,
  },
  {
    label: 'Automated Claim',
    range: 'DCI > 0.85',
    desc: 'Verifiable demand collapse. Zero-touch settlement pipeline triggers instantly — GPS verified UPI payout.',
    color: '#dc2626', // darker red
    bg: '#ffffff',
    border: 'rgba(220,38,38,0.15)',
    dot: '#ef4444',
    bar: 92,
  },
];

/* ── Sigmoid curve points (pre-computed, 40 pts) ────────── */
function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}
const CURVE_W = 320;
const CURVE_H = 140;
const xMin = -6;
const xMax = 6;
const pts = Array.from({ length: 60 }, (_, i) => {
  const x = xMin + (i / 59) * (xMax - xMin);
  const y = sigmoid(x);
  const cx = ((x - xMin) / (xMax - xMin)) * CURVE_W;
  const cy = CURVE_H - y * CURVE_H;
  return `${cx},${cy}`;
});
const sigmoidPath = `M ${pts.join(' L ')}`;

/* ── Animated bar ──────────────────────────────────────── */
function WeightBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="gh-dci-weight-track">
      <motion.div
        className="gh-dci-weight-fill"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${pct * 100}%` } : {}}
        transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function DCIEngineVisual() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-8% 0px' });

  return (
    <section ref={sectionRef} id="dci-engine" className="gh-dci-section">
      {/* Background layers */}
      <div className="gh-dci-bg" />
      <div className="gh-dci-bg-grid" />
      <div className="gh-dci-bg-glow" />

      <div className="gh-dci-shell">

        {/* ── Header ── */}
        <motion.div
          className="gh-dci-header"
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="gh-dci-kicker">Demand Collapse Index · DCI Engine</span>
          <h2>
            Deterministic disruption scoring,
            <br />
            <span>not weather guesses.</span>
          </h2>
          <p>
            Traditional insurance relies on subjective human investigation. gigHood replaces this
            with the DCI — a mathematically rigorous engine that measures true economic disruption
            at hyper-local H3 Hex resolution.
          </p>
        </motion.div>

        {/* ── Formula block ── */}
        <motion.div
          className="gh-dci-formula-block"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="gh-dci-formula-label">Core Formula</p>

          {/* LaTeX-styled formula rendered in CSS */}
          <div className="gh-dci-formula">
            <span className="gh-dci-f-text">DCI</span>
            <span className="gh-dci-f-eq">=</span>
            <span className="gh-dci-f-sigma">σ</span>
            <span className="gh-dci-f-paren">(</span>
            <span className="gh-dci-f-term" style={{ color: '#38bdf8' }}>αW</span>
            <span className="gh-dci-f-plus">+</span>
            <span className="gh-dci-f-term" style={{ color: '#f59e0b' }}>βT</span>
            <span className="gh-dci-f-plus">+</span>
            <span className="gh-dci-f-term" style={{ color: '#a78bfa' }}>γP</span>
            <span className="gh-dci-f-plus">+</span>
            <span className="gh-dci-f-term" style={{ color: '#f87171' }}>δS</span>
            <span className="gh-dci-f-paren">)</span>
          </div>

          {/* Sigmoid sub-formula */}
          <div className="gh-dci-sigmoid-sub">
            <span className="gh-dci-f-sigma-small">σ(x)</span>
            <span className="gh-dci-f-eq-small">=</span>
            <span className="gh-dci-fraction">
              <span className="gh-dci-num">1</span>
              <span className="gh-dci-frac-line" />
              <span className="gh-dci-den">1 + e<sup>−x</sup></span>
            </span>
            <span className="gh-dci-sigmoid-note">→ bounds output strictly to [0.00, 1.00]</span>
          </div>
        </motion.div>

        {/* ── 4 signal cards + sigmoid curve ── */}
        <div className="gh-dci-mid">
          {/* Signal cards */}
          <div className="gh-dci-signals">
            {signals.map((sig, i) => (
              <motion.div
                key={sig.symbol}
                className="gh-dci-signal-card"
                style={
                  {
                    '--sig-color': sig.color,
                    '--sig-glow': sig.glow,
                    '--sig-border': sig.border,
                    background: sig.bg,
                  } as React.CSSProperties
                }
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.55, delay: 0.22 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Symbol badge */}
                <div className="gh-dci-signal-top">
                  <div className="gh-dci-signal-symbol" style={{ color: sig.color, borderColor: sig.border, boxShadow: `0 0 18px ${sig.glow}` }}>
                    {sig.symbol}
                  </div>
                  <div className="gh-dci-signal-meta">
                    <span className="gh-dci-signal-greek" style={{ color: sig.color }}>{sig.greek}</span>
                    <span className="gh-dci-signal-type">{sig.label} · {sig.sublabel}</span>
                  </div>
                </div>

                <p className="gh-dci-signal-detail">{sig.detail}</p>

                <div className="gh-dci-signal-example">
                  <span className="gh-dci-signal-eg-dot" style={{ background: sig.color }} />
                  <span>{sig.example}</span>
                </div>

                {/* Weight bar */}
                <div className="gh-dci-weight-row">
                  <span className="gh-dci-weight-label">Signal Weight</span>
                  <span className="gh-dci-weight-pct" style={{ color: sig.color }}>
                    {Math.round(sig.weight * 100)}%
                  </span>
                </div>
                <WeightBar pct={sig.weight} color={sig.color} delay={0.3 + i * 0.09} />
              </motion.div>
            ))}
          </div>

          {/* Sigmoid card */}
          <motion.div
            className="gh-dci-curve-card"
            initial={{ opacity: 0, x: 24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="gh-dci-curve-label">Sigmoid Activation σ(x)</p>
            <p className="gh-dci-curve-sub">
              Compresses any weighted sum into a bounded [0, 1] score — making the DCI
              auditable, comparable, and manipulation-resistant.
            </p>

            <div className="gh-dci-curve-wrap">
              <svg
                viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
                preserveAspectRatio="none"
                className="gh-dci-curve-svg"
              >
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((v) => (
                  <line
                    key={v}
                    x1="0" y1={CURVE_H - v * CURVE_H}
                    x2={CURVE_W} y2={CURVE_H - v * CURVE_H}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                ))}

                {/* 0.65 threshold line */}
                <line
                  x1={CURVE_W * 0.616} y1="0"
                  x2={CURVE_W * 0.616} y2={CURVE_H}
                  stroke="rgba(245,158,11,0.35)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                {/* 0.85 threshold line */}
                <line
                  x1={CURVE_W * 0.758} y1="0"
                  x2={CURVE_W * 0.758} y2={CURVE_H}
                  stroke="rgba(239,68,68,0.35)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />

                {/* Glow path (thick, blurred) */}
                <path
                  d={sigmoidPath}
                  fill="none"
                  stroke="rgba(99,102,241,0.25)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Main curve */}
                <path
                  d={sigmoidPath}
                  fill="none"
                  stroke="url(#dci-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <defs>
                  <linearGradient id="dci-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Axis labels */}
              <div className="gh-dci-curve-y-labels">
                <span>1.0</span>
                <span>0.5</span>
                <span>0.0</span>
              </div>
            </div>

            <div className="gh-dci-curve-thresholds">
              <span className="gh-dci-curve-thr" style={{ color: '#f59e0b' }}>
                <i style={{ background: '#f59e0b' }} /> 0.65 Elevated
              </span>
              <span className="gh-dci-curve-thr" style={{ color: '#ef4444' }}>
                <i style={{ background: '#ef4444' }} /> 0.85 Auto-Claim
              </span>
            </div>

            {/* Key properties */}
            <div className="gh-dci-curve-props">
              {[
                { label: 'Output Range', value: '[0.00 → 1.00]' },
                { label: 'Monotonically', value: 'Increasing' },
                { label: 'False-Positive', value: 'Resistant' },
              ].map((p) => (
                <div key={p.label} className="gh-dci-curve-prop">
                  <span className="gh-dci-prop-label">{p.label}</span>
                  <span className="gh-dci-prop-val">{p.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Threshold logic strip ── */}
        <motion.div
          className="gh-dci-thresholds"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="gh-dci-thr-heading">Threshold Logic — Zero-Touch Payouts</p>
          <div className="gh-dci-thr-grid">
            {thresholds.map((t, i) => (
              <div
                key={t.label}
                className="gh-dci-thr-card"
                style={
                  {
                    '--thr-color': t.color,
                    '--thr-bg': t.bg,
                    '--thr-border': t.border,
                    background: t.bg,
                    borderColor: t.border,
                  } as React.CSSProperties
                }
              >
                <div className="gh-dci-thr-top">
                  <span
                    className="gh-dci-thr-dot"
                    style={{ background: t.dot, boxShadow: `0 0 10px ${t.dot}` }}
                  />
                  <div>
                    <p className="gh-dci-thr-label" style={{ color: t.color }}>{t.label}</p>
                    <code className="gh-dci-thr-range">{t.range}</code>
                  </div>
                  <span className="gh-dci-thr-index">0{i + 1}</span>
                </div>
                <p className="gh-dci-thr-desc">{t.desc}</p>

                {/* Gauge bar */}
                <div className="gh-dci-thr-gauge">
                  <motion.div
                    className="gh-dci-thr-fill"
                    style={{ background: t.color, opacity: 0.7 }}
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${t.bar}%` } : {}}
                    transition={{ duration: 0.9, delay: 0.58 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <span className="gh-dci-thr-val" style={{ color: t.color }}>{t.bar / 100}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
