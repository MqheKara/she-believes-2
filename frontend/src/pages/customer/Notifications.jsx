import React, { useEffect, useState } from 'react'
import Layout from '../../components/Layout.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime } from '../../lib/format.js'

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/my/notifications').then(({ data }) => setItems(data.notifications || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="page-head">
          <div>
            <div className="crumb">Word from the ministry</div>
            <h1>Notifications</h1>
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState title="No notifications yet" body="Approvals, changes, and reminders will appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((n) => (
              <div key={n.id} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 14, margin: '0 0 4px', color: 'var(--sb-pink)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{n.kind?.replace(/_/g, ' ')}</h4>
                    <p style={{ margin: 0, color: 'var(--sb-ink)' }}>{n.body}</p>
                  </div>
                  <span className="caption">{fmtDateTime(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
