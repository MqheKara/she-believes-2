import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { fmtDateTime } from '../../lib/format.js'

const STATUSES = ['all', 'pending_approval', 'approved', 'active', 'rejected', 'cancelled', 'past']

export default function AdminEvents() {
  const toast = useToast()
  const [status, setStatus] = useState('all')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    const params = status === 'all' ? {} : { status }
    api.get('/admin/events', { params }).then(({ data }) => setEvents(data.events || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [status])

  async function act(id, action) {
    try {
      await api.post(`/admin/events/${id}/${action}`)
      toast.success(`Event ${action}d.`)
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <Layout>
      <div className="container">
        <div className="page-head">
          <div>
            <div className="crumb"><Link to="/admin">← Admin</Link></div>
            <h1>Events</h1>
          </div>
        </div>

        <div className="filter-strip">
          {STATUSES.map((s) => (
            <button key={s} className={s === status ? 'on' : ''} onClick={() => setStatus(s)}>{s.replace(/_/g, ' ')}</button>
          ))}
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : events.length === 0 ? (
          <p className="soft">No events in this status.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Title</th><th>When</th><th>Organizer</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.title}</strong><div className="caption">{e.category} · {e.venue_name}, {e.city}</div></td>
                    <td>{fmtDateTime(e.start_at)}</td>
                    <td>{e.organizer_name}</td>
                    <td><span className="pill pill-soft">{e.status?.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/admin/events/${e.id}`} className="btn-ghost btn-sm">View →</Link>
                      {e.status === 'pending_approval' && (
                        <>
                          <button className="btn-ghost btn-sm" onClick={() => act(e.id, 'approve')}>Approve</button>
                          <button className="btn-ghost btn-sm" onClick={() => act(e.id, 'reject')}>Reject</button>
                        </>
                      )}
                      {(e.status === 'approved' || e.status === 'active') && (
                        <button className="btn-ghost btn-sm" onClick={() => act(e.id, 'cancel')}>Cancel</button>
                      )}
                    </td>
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
