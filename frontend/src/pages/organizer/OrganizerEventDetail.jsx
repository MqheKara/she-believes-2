import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api } from '../../lib/api.js'
import { money, fmtDateTime } from '../../lib/format.js'

export default function OrganizerEventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [sales, setSales] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/organizer/events/${id}`),
      api.get(`/organizer/events/${id}/sales`),
      api.get(`/organizer/events/${id}/attendees`),
    ]).then(([e, s, a]) => {
      setEvent(e.data); setSales(s.data); setAttendees(a.data.attendees || a.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!event) return <Layout><div className="container section"><p>Not found.</p></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to="/org">← Back to dashboard</Link></div>
        <div className="page-head">
          <div>
            <h1>{event.title}</h1>
            <p className="soft">{fmtDateTime(event.start_at)} · {event.venue_name}, {event.city}</p>
          </div>
          <span className="pill pill-soft">{event.status?.replace(/_/g, ' ')}</span>
        </div>

        <div className="dash-stats">
          <div className="stat-card">
            <div className="stat-label">Tickets sold</div>
            <div className="stat-val">{sales?.tickets_sold ?? 0}</div>
            <div className="stat-sub">of {sales?.capacity ?? 0} seats</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Revenue</div>
            <div className="stat-val">{money(sales?.revenue_usd ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Checked in</div>
            <div className="stat-val">{sales?.checked_in ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending orders</div>
            <div className="stat-val">{sales?.pending_orders ?? 0}</div>
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 24 }}>Attendees</h2>
        {attendees.length === 0 ? (
          <p className="soft">No attendees yet.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Ticket type</th><th>Source</th><th>Status</th><th>Checked in</th></tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.ticket_id || a.id}>
                    <td>{a.attendee_name}</td>
                    <td>{a.ticket_type_name}</td>
                    <td className="caption">{a.source}</td>
                    <td><span className={`pill pill-${a.status === 'valid' ? 'soft' : a.status === 'used' ? 'success' : 'muted'}`}>{a.status}</span></td>
                    <td>{a.checked_in_at ? fmtDateTime(a.checked_in_at) : '—'}</td>
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
