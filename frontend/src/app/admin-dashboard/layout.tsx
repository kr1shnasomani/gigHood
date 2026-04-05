'use client'

import { ReactNode, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Grid3x3,
  Map,
  FileText,
  AlertTriangle,
  Shield,
  DollarSign,
  Settings,
  HelpCircle,
  Bell,
  Search,
} from 'lucide-react'

import api from '@/lib/api'
import icon from '@/app/icon.jpg'

/* =========================
   SIDEBAR
========================= */

const Sidebar = () => {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const navItems = [
    { icon: Grid3x3, label: 'Overview', href: '/admin-dashboard' },
    { icon: Map, label: 'H3 Hex Map', href: '/admin-dashboard/map' },
    { icon: FileText, label: 'Claims', href: '/admin-dashboard/claims' },
    { icon: AlertTriangle, label: 'Fraud Monitor', href: '/admin-dashboard/fraud' },
    { icon: Shield, label: 'Active Policies', href: '/admin-dashboard/policies' },
    { icon: DollarSign, label: 'Payout Summary', href: '/admin-dashboard/payouts' },
  ]

  return (
    <div className="w-56 bg-[#0B1220] text-gray-300 flex flex-col h-screen fixed left-0 top-0 border-r border-white/5">
      
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden">
            <Image src={icon} alt="GigHood logo" fill sizes="32px" className="object-cover" />
          </div>
          <div>
            <h1 className="font-semibold text-orange-400 text-sm tracking-wide">
              gigHood
            </h1>
            <p className="text-[10px] text-gray-500">
              PARAMETRIC CONTROL
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                active
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-400/20 shadow-[0_0_0_1px_rgba(251,146,60,0.15)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/5 p-4 space-y-2">
        <Link
          href="/admin-dashboard/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
        >
          <Settings size={20} />
          <span className="text-sm">Settings</span>
        </Link>

        <Link
          href="#"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
        >
          <HelpCircle size={20} />
          <span className="text-sm">Support</span>
        </Link>
      </div>
    </div>
  )
}

/* =========================
   HEADER
========================= */

const Header = () => {
  const [user, setUser] = useState<{ name?: string } | null>(null)
  const [alerts, setAlerts] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        const userRes = await api.get('/auth/me')
        setUser(userRes.data)

        const alertRes = await api.get('/admin/alerts/count')
        setAlerts(alertRes.data.count)
      } catch (err) {
        console.log('Header load failed', err)
      }
    }

    fetchHeaderData()
  }, [])

  useEffect(() => {
    if (!search) return

    const timeout = setTimeout(async () => {
      try {
        await api.get(`/admin/search?q=${search}`)
      } catch (err) {
        console.log(err)
      }
    }, 400)

    return () => clearTimeout(timeout)
  }, [search])

  return (
    <div className="ml-56 bg-white border-b flex items-center justify-between px-6 py-4 sticky top-0 z-10">
      
      {/* SEARCH */}
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Search claims, workers..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-400 bg-gray-50"
          />
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4">
        
        {/* LIVE STATUS */}
        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
          ● LIVE
        </div>

        {/* NOTIFICATIONS */}
        <button className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell size={20} />
          {alerts > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
              {alerts}
            </span>
          )}
        </button>

        {/* SETTINGS */}
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Settings size={20} />
        </button>

        {/* USER */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
            {user?.name?.[0] || 'U'}
          </div>
          <span className="text-sm font-medium">
            {user?.name || 'Admin'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* =========================
   LAYOUT
========================= */

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />

      <div className="flex-1">
        <Header />

        <main className="ml-56 bg-[#F8FAFC] min-h-[calc(100vh-73px)] overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}