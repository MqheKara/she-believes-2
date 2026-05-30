import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime, money } from '../../lib/format.js'
import { Plus } from 'lucide-react'

const STATUS_PILL = {
  draft: 'pill-muted',
  pending_approval: 'pill-warning',
  approved: 'pill-success',
  rejected: 'pill-muted',
  active: 'pill-soft',
  cancelled: 'pill-muted',
  past: 'pill-muted',
}

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/organizer/events').then(({ data }) => setEvents(data.events || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="page-head">
          <div>
            <div className="crumb">Organizer console</div>
            <h1>Your gatherings</h1>
          </div>
          <Link to="/org/new" className="btn btn-primary"><Plus size={16} /> New gathering</Link>
        </div>

        {events.length === 0 ? (
          <EmptyState title="No gatherings yet" body="Create your first gathering and submit it for approval.">
            <Link to="/org/new" className="btn btn-primary">Create gathering</Link>
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Title</th><th>When</th><th>Venue</th><th>Sold</th><th>Revenue</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.title}</strong><div className="caption">{e.category}</div></td>
                    <td>{fmtDateTime(e.start_at)}</td>
                    <td>{e.venue_name}, {e.city}</td>
                    <td>{e.tickets_sold ?? 0}</td>
                    <td>{money(e.revenue_usd ?? 0)}</td>
                    <td><span className={`pill ${STATUS_PILL[e.status] || 'pill-muted'}`}>{e.status?.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right' }}><Link to={`/org/events/${e.id}`} className="btn-ghost btn-sm">Manage →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
