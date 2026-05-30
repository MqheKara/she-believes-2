import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api } from '../../lib/api.js'
import { money } from '../../lib/format.js'
import { Inbox, Calendar, Users, DollarSign, Ticket, Gift, MessageSquare, Shield } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [])

  const cards = [
    { to: '/admin/order-requests', icon: <Inbox size={18} />, label: 'Order requests', val: stats?.pending_orders, sub: 'awaiting approval' },
    { to: '/admin/events', icon: <Calendar size={18} />, label: 'Events', val: stats?.active_events, sub: 'active gatherings' },
    { to: '/admin/walk-in', icon: <Ticket size={18} />, label: 'Walk-in tickets', val: stats?.walkin_today ?? '–', sub: 'today' },
    { to: '/admin/comp', icon: <Gift size={18} />, label: 'Comp tickets', val: '+', sub: 'issue free pass' },
    { to: '/admin/gate-staff', icon: <Users size={18} />, label: 'Gate staff', val: stats?.gate_staff_count, sub: 'manage PINs' },
    { to: '/admin/mock-inbox', icon: <MessageSquare size={18} />, label: 'Mock inbox', val: stats?.messages_today, sub: 'SMS / WhatsApp / Email' },
  ]

  return (
    <Layout>
      <div className="container">
        <div className="page-head">
          <div>
            <div className="crumb">Admin console</div>
            <h1>Mission control</h1>
          </div>
        </div>

        <div className="dash-stats">
          <div className="stat-card">
            <div className="stat-label">Revenue (USD)</div>
            <div className="stat-val">{money(stats?.revenue_usd ?? 0)}</div>
            <div className="stat-sub">across paid orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tickets sold</div>
            <div className="stat-val">{stats?.tickets_sold ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-val">{stats?.pending_orders ?? 0}</div>
            <div className="stat-sub">order requests</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active events</div>
            <div className="stat-val">{stats?.active_events ?? 0}</div>
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginTop: 32, marginBottom: 16 }}>Quick actions</h2>
        <div className="grid-3 stagger">
          {cards.map((c) => (
            <Link key={c.to} to={c.to} className="card card-pad" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sb-pink)', marginBottom: 8 }}>
                {c.icon}
                <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 13, margin: 0, color: 'var(--sb-ink)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{c.label}</h4>
              </div>
              <div className="stat-val">{c.val ?? '–'}</div>
              <div className="stat-sub">{c.sub}</div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  )
}
