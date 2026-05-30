import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime } from '../../lib/format.js'
import { Check, AlertCircle, XCircle } from 'lucide-react'

const ICONS = {
  valid: <Check size={16} />,
  used: <Check size={16} />,
  void: <XCircle size={16} />,
}

export default function MyTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/my/tickets').then(({ data }) => setTickets(data.tickets || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="page-head">
          <div>
            <div className="crumb">Your gathering pass</div>
            <h1>My Tickets</h1>
          </div>
          <Link to="/events" className="btn btn-secondary">Find another gathering</Link>
        </div>

        {tickets.length === 0 ? (
          <EmptyState
            title="Your tickets will live here"
            body="Once you reserve a seat and we confirm payment, your QR will appear here, ready for the door."
          >
            <Link to="/events" className="btn btn-primary">Browse gatherings</Link>
          </EmptyState>
        ) : (
          <div className="grid-3 stagger">
            {tickets.map((t) => (
              <Link key={t.id} to={`/my-tickets/${t.id}`} className="card card-pad" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={`pill pill-${t.status === 'valid' ? 'soft' : t.status === 'used' ? 'success' : 'muted'}`}>
                    {ICONS[t.status] || <AlertCircle size={14} />} {t.status}
                  </span>
                  <span className="caption">{t.ticket_type_name}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, margin: '0 0 4px' }}>{t.event_title}</h3>
                <p className="soft" style={{ fontSize: 13, margin: '0 0 8px' }}>{fmtDateTime(t.event_start_at)}</p>
                <p className="caption" style={{ marginTop: 8 }}>Attendee · {t.attendee_name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
