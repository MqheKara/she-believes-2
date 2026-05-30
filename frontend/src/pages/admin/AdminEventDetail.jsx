import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, getToken, API_BASE } from '../../lib/api.js'
import { fmtDateTime, money } from '../../lib/format.js'
import { Download } from 'lucide-react'

const FILTERS = ['All', 'Online', 'Walk-in', 'Comp', 'Checked-in', 'Not']

export default function AdminEventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [summary, setSummary] = useState(null)
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/admin/events/${id}`),
      api.get(`/admin/events/${id}/attendees`),
    ]).then(([e, a]) => {
      setEvent(e.data)
      setAttendees(a.data.attendees || [])
      setSummary(a.data.summary || null)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const filtered = useMemo(() => {
    return attendees.filter((a) => {
      switch (filter) {
        case 'Online': return a.source === 'online'
        case 'Walk-in': return a.source === 'walkin'
        case 'Comp': return a.source === 'comp'
        case 'Checked-in': return !!a.checked_in_at
        case 'Not': return !a.checked_in_at
        default: return true
      }
    })
  }, [attendees, filter])

  function downloadCsv() {
    const token = getToken()
    // CSV is served with bearer auth, so do an XHR fetch + blob
    // Raw fetch (not axios) because we want a Blob response for the CSV download.
    // Must prefix with API_BASE so this hits the backend in production — without
    // it, in prod this would request the static-site's own domain and 404.
    fetch(`${API_BASE}/api/admin/events/${id}/attendees.csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendees-${event?.title || id}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!event) return <Layout><div className="container section"><p>Not found.</p></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to="/admin/events">← Events</Link></div>
        <div className="page-head">
          <div>
            <h1>{event.title}</h1>
            <p className="soft">{fmtDateTime(event.start_at)} · {event.venue_name}, {event.city}</p>
          </div>
          <div className="head-actions">
            <Link to={`/admin/walk-in?event_id=${id}`} className="btn btn-secondary btn-sm">Issue walk-in</Link>
            <Link to={`/admin/comp?event_id=${id}`} className="btn btn-secondary btn-sm">Issue comp</Link>
            <button className="btn btn-primary btn-sm" onClick={downloadCsv}><Download size={14} /> CSV</button>
          </div>
        </div>

        {summary && (
          <div className="dash-stats">
            <div className="stat-card"><div className="stat-label">Online</div><div className="stat-val">{summary.online}</div></div>
            <div className="stat-card"><div className="stat-label">Walk-in</div><div className="stat-val">{summary.walkin}</div></div>
            <div className="stat-card"><div className="stat-label">Comp</div><div className="stat-val">{summary.comp}</div></div>
            <div className="stat-card"><div className="stat-label">Checked in</div><div className="stat-val">{summary.checked_in}</div></div>
          </div>
        )}

        <div className="filter-strip">
          {FILTERS.map((f) => <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}
        </div>

        {filtered.length === 0 ? (
          <p className="soft">No attendees match this filter.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Attendee</th><th>Ticket type</th><th>Buyer</th><th>Source</th><th>Status</th><th>Checked in</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.ticket_id}>
                    <td>{a.attendee_name}</td>
                    <td>{a.ticket_type_name}</td>
                    <td>
                      <div>{a.buyer_name || '—'}</div>
                      <div className="caption">{a.buyer_phone || ''}</div>
                    </td>
                    <td className="caption">{a.source}</td>
                    <td><span className={`pill pill-${a.status === 'valid' ? 'soft' : a.status === 'used' ? 'success' : 'muted'}`}>{a.status}</span></td>
                    <td>{a.checked_in_at ? fmtDateTime(a.checked_in_at) : '—'}</td>
                    <td style={{ textAlign: 'right' }}><Link to={`/admin/tickets/${a.ticket_id}`} className="btn-ghost btn-sm">Open →</Link></td>
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
