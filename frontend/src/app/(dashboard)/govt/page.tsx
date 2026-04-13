'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, Search, ChevronRight } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type Scheme = {
  id: number;
  name: string;
  category: string;
  benefit: string;
  detail: string;
  link: string;
  icon: string;
  tags: string[];
};

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  all:            { label: 'All',             color: '#E2E8F0', bg: 'rgba(226,232,240,0.08)' },
  social_security:{ label: 'Social Security', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)'  },
  insurance:      { label: 'Insurance',       color: '#34D399', bg: 'rgba(52,211,153,0.1)'  },
  health:         { label: 'Health',          color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
  loan:           { label: 'Loans',           color: '#FBBF24', bg: 'rgba(251,191,36,0.1)'  },
  pension:        { label: 'Pension',         color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
  state:          { label: 'State',           color: '#FB923C', bg: 'rgba(251,146,60,0.1)'  },
};

function getCatCfg(cat: string) {
  return CATEGORY_CONFIG[cat] ?? { label: cat, color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' };
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SchemeSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 14, width: '55%' }} />
              <div className="skeleton" style={{ height: 11, width: '80%' }} />
              <div className="skeleton" style={{ height: 11, width: '40%' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function GovtSchemesPage() {
  const [schemes,    setSchemes]    = useState<Scheme[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [activecat,  setActivecat]  = useState('all');
  const [searchQ,    setSearchQ]    = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadSchemes = async (showSpinner = false) => {
    if (showSpinner) setFetching(true);
    try {
      const res = await fetch('/api/schemes');
      const data = await res.json();
      setSchemes(data);
    } catch { /* silent */ } finally {
      setLoading(false);
      setFetching(false);
    }
  };

  useEffect(() => { loadSchemes(); }, []);

  // derive unique categories from data
  const categories = useMemo(() => {
    const cats = Array.from(new Set(schemes.map(s => s.category)));
    return ['all', ...cats];
  }, [schemes]);

  const filtered = useMemo(() => {
    let list = activecat === 'all' ? schemes : schemes.filter(s => s.category === activecat);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.detail.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [schemes, activecat, searchQ]);

  // Stats
  const stats = useMemo(() => ({
    total:      schemes.length,
    insurance:  schemes.filter(s => s.category === 'insurance').length,
    health:     schemes.filter(s => s.category === 'health').length,
    free:       schemes.filter(s => s.tags.includes('free')).length,
  }), [schemes]);

  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '32px' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="stagger-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px' }}>
            🏛 Govt Schemes
          </h2>
          <p className="label-micro">Benefits designed for gig workers</p>
        </div>
        <button
          onClick={() => { navigator.vibrate?.(10); loadSchemes(true); }}
          disabled={fetching}
          style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: fetching ? 0.5 : 1, transition: 'all 0.2s', cursor: 'pointer',
          }}
          title="Refresh"
        >
          <RefreshCw
            size={16} color="var(--text-secondary)"
            style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }}
          />
        </button>
      </header>

      {/* ── Stats Strip ───────────────────────────────────────────────────── */}
      <section className="stagger-2 glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0 }}>
          {[
            { label: 'Schemes',   value: stats.total,     color: '#E2E8F0' },
            { label: 'Insurance', value: stats.insurance,  color: '#34D399' },
            { label: 'Health',    value: stats.health,     color: '#F87171' },
            { label: 'Free',      value: stats.free,       color: '#FBBF24' },
          ].map((stat, i, arr) => (
            <div
              key={stat.label}
              style={{
                display: 'flex', flexDirection: 'column', gap: '4px',
                paddingLeft: i > 0 ? '12px' : 0,
                paddingRight: i < arr.length - 1 ? '12px' : 0,
                borderRight: i < arr.length - 1 ? '1px solid var(--border-glass)' : 'none',
              }}
            >
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {stat.label}
              </span>
              <span className="tabular-nums" style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.3px', color: stat.color, lineHeight: 1.1 }}>
                {loading ? '—' : stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Info Banner ───────────────────────────────────────────────────── */}
      <div
        className="stagger-2"
        style={{
          padding: '12px 14px', borderRadius: '12px',
          background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.18)',
          fontSize: '12px', color: '#FDE68A', lineHeight: 1.5, marginTop: '-14px',
        }}
      >
        💡 Official government schemes — apply directly without paying any agent.
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div
        className="stagger-2"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
          borderRadius: '12px', padding: '10px 14px', marginTop: '-16px',
        }}
      >
        <Search size={15} color="var(--text-secondary)" />
        <input
          type="text"
          placeholder="Search schemes, tags…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '14px', color: 'var(--text-primary)', flex: 1,
          }}
        />
        {searchQ && (
          <button
            onClick={() => setSearchQ('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', padding: 0 }}
          >✕</button>
        )}
      </div>

      {/* ── Category Chips ────────────────────────────────────────────────── */}
      <div
        className="stagger-3"
        style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px', marginTop: '-16px' }}
      >
        {categories.map(cat => {
          const cfg    = getCatCfg(cat);
          const active = activecat === cat;
          return (
            <button
              key={cat}
              onClick={() => setActivecat(cat)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: '99px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                background: active ? cfg.bg    : 'rgba(255,255,255,0.04)',
                color:      active ? cfg.color : 'var(--text-secondary)',
                border: active ? ('1px solid ' + cfg.color + '55') : '1px solid var(--border-glass)',
                transition: 'all 0.2s ease',
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <section className="stagger-3" style={{ marginTop: '-8px' }}>
        <h3 className="label-micro" style={{ marginBottom: '14px' }}>
          {filtered.length} scheme{filtered.length !== 1 ? 's' : ''} available
        </h3>

        {loading ? (
          <SchemeSkeleton />
        ) : filtered.length === 0 ? (
          <div
            className="glass-panel"
            style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ fontSize: '40px' }}>🔍</div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '16px' }}>No schemes found</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Try a different category or search term</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((scheme, index) => {
                const catCfg  = getCatCfg(scheme.category);
                const isOpen  = expandedId === scheme.id;

                return (
                  <motion.div
                    key={scheme.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
                  >
                    <div
                      className="glass-panel interactive-card"
                      style={{ padding: '18px', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isOpen ? null : scheme.id)}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

                        {/* Icon bubble */}
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                          background: catCfg.bg, border: `1px solid ${catCfg.color}33`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '22px',
                        }}>
                          {scheme.icon}
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {scheme.name}
                            </h4>
                            <ChevronRight
                              size={16}
                              color="var(--text-secondary)"
                              style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
                            />
                          </div>

                          {/* Benefit badge */}
                          <div style={{ marginTop: '5px' }}>
                            <span style={{
                              fontSize: '12px', fontWeight: 700, color: catCfg.color,
                              background: catCfg.bg, border: `1px solid ${catCfg.color}44`,
                              padding: '3px 9px', borderRadius: '99px',
                            }}>
                              ✓ {scheme.benefit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                                {scheme.detail}
                              </p>

                              {/* Tags */}
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                {scheme.tags.map(tag => (
                                  <span key={tag} style={{
                                    fontSize: '10px', fontWeight: 600,
                                    padding: '3px 8px', borderRadius: '99px',
                                    background: 'rgba(99,102,241,0.1)', color: '#818CF8',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                  }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              {/* Apply button */}
                              <a
                                href={scheme.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                  padding: '11px 16px', borderRadius: '12px', textDecoration: 'none',
                                  background: catCfg.bg, border: `1px solid ${catCfg.color}55`,
                                  color: catCfg.color, fontSize: '13px', fontWeight: 700,
                                  transition: 'all 0.2s',
                                }}
                              >
                                Apply on official site
                                <ExternalLink size={14} />
                              </a>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Footer disclaimer ────────────────────────────────────────────── */}
      {!loading && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, opacity: 0.7 }}>
          GigHood curates these for gig workers. Always verify on official govt sites before applying.
        </p>
      )}
    </div>
  );
}
