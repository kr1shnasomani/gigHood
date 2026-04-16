'use client'

import { ReactNode, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Map,
  FileText,
  AlertTriangle,
  Shield,
  Banknote,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  Search,
  ChevronRight,
} from 'lucide-react'

import api from '@/lib/api'
import icon from '@/app/icon.jpg'

const SIDEBAR_NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview',        href: '/admin-dashboard',          section: 'Overview' },
  { icon: Map,             label: 'H3 Hex Map',      href: '/admin-dashboard/map',      section: 'Monitoring' },
  { icon: AlertTriangle,   label: 'Fraud Monitor',   href: '/admin-dashboard/fraud',    section: 'Monitoring' },
  { icon: FileText,        label: 'Claims',          href: '/admin-dashboard/claims',   section: 'Operations' },
  { icon: Shield,          label: 'Active Policies', href: '/admin-dashboard/policies', section: 'Operations' },
  { icon: Banknote,        label: 'Payout Summary',  href: '/admin-dashboard/payouts',  section: 'Operations' },
]

/* ─────────────────────────────────────────────────
   SIDEBAR — Glassmorphism dark shell, Lexora-style
───────────────────────────────────────────────── */
const Sidebar = () => {
  const pathname = usePathname()
  const router   = useRouter()

  const isActive = (href: string) =>
    href === '/admin-dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')

  useEffect(() => {
    SIDEBAR_NAV_ITEMS.forEach(item => {
      router.prefetch(item.href)
    })
    router.prefetch('/admin-dashboard/settings')
  }, [router])

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gighood_jwt')
      localStorage.removeItem('gighood-auth-store')
      localStorage.removeItem('gighood-language-store')
    }
    router.replace('/')
  }

  return (
    <div
      className="w-64 flex flex-col h-screen fixed left-0 top-0 z-[600] overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #1A1612 0%, #1F1A15 60%, #241E18 100%)',
        borderRight: '1px solid rgba(249,115,22,0.12)',
      }}
    >
      {/* Orange radial glow top */}
      <div
        className="absolute -top-16 -left-16 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 65%)' }}
      />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Logo ── */}
      <div
        className="relative px-5 py-5 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0"
          style={{ boxShadow: '0 0 0 1.5px rgba(249,115,22,0.5), 0 0 20px rgba(249,115,22,0.2)' }}
        >
          <Image src={icon} alt="gigHood logo" fill sizes="36px" className="object-cover" />
        </div>
        <div>
          <h1 className="font-black text-white text-[15px] tracking-tight leading-none">gigHood</h1>
          <p className="text-[10px] text-stone-500 uppercase tracking-[0.18em] mt-0.5">Ops Center</p>
        </div>

        {/* live pip */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-orange-400 opacity-60" />
            <span className="relative h-2 w-2 rounded-full bg-orange-500" />
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-5 scrollbar-none">
        {(['Overview', 'Monitoring', 'Operations'] as const).map(section => (
          <div key={section}>
            <p className="px-3 pb-1.5 text-[9px] font-black text-stone-600 uppercase tracking-[0.22em]">
              {section}
            </p>
            <div className="space-y-0.5">
              {SIDEBAR_NAV_ITEMS.filter(i => i.section === section).map(item => {
                const Icon   = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                      active
                        ? 'text-orange-300'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-white/[0.04]'
                    }`}
                    style={
                      active
                        ? {
                            background:
                              'linear-gradient(90deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(249,115,22,0.2)',
                          }
                        : {}
                    }
                  >
                    {/* Active left accent bar */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: '#f97316', boxShadow: '0 0 8px rgba(249,115,22,0.6)' }}
                      />
                    )}

                    <span
                      className={`shrink-0 rounded-lg p-1.5 transition-colors ${
                        active
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'text-stone-500 group-hover:text-stone-300 group-hover:bg-white/[0.06]'
                      }`}
                    >
                      <Icon size={14} strokeWidth={2.2} />
                    </span>

                    <span className="text-[13px] font-semibold leading-none">{item.label}</span>

                    {active && (
                      <ChevronRight size={12} className="ml-auto text-orange-400/50" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User Card ── */}
      <div
        className="mx-3 mb-3 rounded-xl p-3 flex items-center gap-3"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            boxShadow: '0 0 12px rgba(249,115,22,0.4)',
          }}
        >
          A
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-stone-200 truncate">Admin</p>
          <p className="text-[10px] text-stone-500">Super Admin</p>
        </div>
        <button
          onClick={handleSignOut}
          className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* ── Bottom links ── */}
      <div
        className="px-3 pb-4 flex gap-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Link
          href="/admin-dashboard/settings"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/[0.04] transition-all text-[11px] font-medium"
        >
          <Settings size={13} /> Settings
        </Link>
        <Link
          href="#"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/[0.04] transition-all text-[11px] font-medium"
        >
          <HelpCircle size={13} /> Help
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   HEADER — Fixed, centered search, glass effect
───────────────────────────────────────────────── */
const Header = () => {
  const [alerts, setAlerts] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const alertRes = await api.get('/admin/alerts/count')
        setAlerts(alertRes.data.count)
      } catch { /* noop */ }
    }
    load()
  }, [])

  useEffect(() => {
    if (!search) return
    const id = setTimeout(async () => {
      try { await api.get(`/admin/search?q=${search}`) } catch { /* noop */ }
    }, 400)
    return () => clearTimeout(id)
  }, [search])

  return (
    <div
      className="sticky top-0 z-[500] w-full flex h-16 items-center px-6 gap-4"
      style={{
        background: 'rgba(250, 250, 248, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(249,115,22,0.10)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <div className="flex-1 max-w-xl mx-auto relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
          size={16}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          type="text"
          placeholder="Search claims, workers, zones…"
          className="w-full h-10 pl-11 pr-4 rounded-xl bg-white border border-stone-200 text-[13px] text-stone-800 placeholder-stone-400 focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 shadow-sm transition-all"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications Only (Removed redundant settings, live badge, and avatar) */}
        <button
          className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-stone-200 text-stone-500 hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition-all shadow-sm"
        >
          <Bell size={18} />
          {alerts > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white border-2 border-white leading-none">
              {alerts}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   LAYOUT
───────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#FAFAF8' }}>
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 relative">
          {children}
        </main>
      </div>
    </div>
  )
}