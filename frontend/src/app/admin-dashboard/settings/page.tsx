'use client'

import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { fetchKPIs, AdminKPIs } from '@/lib/admin/adminClient'

export default function Settings() {
  const [kpis, setKpis] = useState<AdminKPIs | null>(null)

  const [criticalThreshold, setCriticalThreshold] = useState(12)
  const [alertThreshold, setAlertThreshold] = useState(5)
  const [payoutMode, setPayoutMode] = useState('instant')

  useEffect(() => {
    fetchKPIs().then(setKpis).catch(console.error)
  }, [])

  const lossRatio = kpis?.system_loss_ratio ?? 0.71

  const systemHealth =
    lossRatio > 0.75
      ? 'CRITICAL'
      : lossRatio > 0.65
      ? 'WARNING'
      : 'STABLE'

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          System Orchestration
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure the core logic and operational thresholds for parametric risk distribution and ledger integrity.
        </p>
      </div>

      {/* CONFIG + API */}
      <div className="grid grid-cols-3 gap-6">
        {/* PLATFORM CONFIG */}
        <div className="col-span-2 bg-card p-6 rounded-xl border border-border space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-lg font-bold text-foreground">
              ⚙ Platform Configuration
            </h2>
            <button
              onClick={() => {
                setCriticalThreshold(12)
                setAlertThreshold(5)
                setPayoutMode('instant')
              }}
              className="text-sm text-primary font-semibold hover:underline"
            >
              Reset Defaults
            </button>
          </div>

          {/* DCI Thresholds */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              DCI Threshold Levels (%)
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Critical Trigger
                </p>
                <input
                  type="number"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Alert Threshold
                </p>
                <input
                  type="number"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                />
              </div>
            </div>

            {/* SYSTEM FEEDBACK */}
            <div className="mt-4 text-xs text-muted-foreground">
              Current system loss ratio: 
              <span className="font-bold text-foreground ml-1">
                {lossRatio.toFixed(2)}
              </span>{' '}
              →{' '}
              <span
                className={
                  systemHealth === 'CRITICAL'
                    ? 'text-red-500'
                    : systemHealth === 'WARNING'
                    ? 'text-yellow-500'
                    : 'text-green-500'
                }
              >
                {systemHealth}
              </span>
            </div>
          </div>

          {/* Payout Mode */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              Payout Timing
            </label>

            <div className="space-y-2">
              {[
                { id: 'instant', label: 'Instant Ledger Settlement (Real-time)' },
                { id: 'batch', label: 'Batch Processing (EOD)' },
                { id: 'manual', label: 'Manual Verification Queue' },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payout"
                    checked={payoutMode === opt.id}
                    onChange={() => setPayoutMode(opt.id)}
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* APPLY */}
          <button
            onClick={() => {
              console.log({
                criticalThreshold,
                alertThreshold,
                payoutMode,
              })
              alert('Configuration applied (frontend only)')
            }}
            className="w-full px-4 py-3 bg-foreground text-background rounded-lg font-semibold hover:bg-opacity-90 transition"
          >
            Apply Configurations
          </button>
        </div>

        {/* API KEYS */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h2 className="text-lg font-bold text-white mb-4">🔑 API Keys</h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-2">PRODUCTION KEY</p>

              <div className="bg-slate-800 p-3 rounded flex items-center justify-between group">
                <code className="text-xs text-green-400 font-mono">
                  kl_live_9428..._xBz
                </code>

                <button
                  onClick={() => navigator.clipboard.writeText('kl_live_9428..._xBz')}
                  className="opacity-0 group-hover:opacity-100 transition"
                >
                  <Copy size={16} className="text-gray-400" />
                </button>
              </div>
            </div>

            <button className="w-full px-3 py-2 bg-slate-800 text-white rounded text-sm font-semibold hover:bg-slate-700">
              Rotate Secret Key
            </button>
          </div>
        </div>
      </div>

      {/* USER MANAGEMENT */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <h2 className="text-lg font-bold text-foreground">👥 User Management</h2>
          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold">
            + Invite Member
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-3 text-left">ADMIN</th>
              <th className="py-3 text-left">ROLE</th>
              <th className="py-3 text-left">STATUS</th>
            </tr>
          </thead>

          <tbody>
            {[
              { name: 'Julian Draxler', role: 'Admin' },
              { name: 'Sarah Chen', role: 'Security' },
            ].map((u, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-3 text-foreground">{u.name}</td>
                <td className="py-3 text-foreground">{u.role}</td>
                <td className="py-3">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    ACTIVE
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SYSTEM HEALTH */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h2 className="text-lg font-bold text-foreground mb-4">🔧 System Health</h2>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Loss Ratio</span>
            <span className="font-semibold">{lossRatio.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>Status</span>
            <span
              className={
                systemHealth === 'CRITICAL'
                  ? 'text-red-500'
                  : systemHealth === 'WARNING'
                  ? 'text-yellow-500'
                  : 'text-green-500'
              }
            >
              {systemHealth}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Throughput</span>
            <span>~2.4k txn/s</span>
          </div>
        </div>
      </div>
    </div>
  )
}