import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime } from '../../lib/format.js'

const CHANNELS = ['All', 'SMS', 'WhatsApp', 'Email']

export default function AdminMockInbox() {
  const [items, setItems] = useState([])
  const [channel, setChannel] = useState('All')
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    const params = channel === 'All' ? {} : { channel: channel.toLowerCase() }
    api.get('/admin/mock-messages', { params }).then(({ data }) => setItems(data.messages || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [channel])

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to="/admin">← Admin</Link></div>
        <div className="page-head">
          <h1>Mock inbox</h1>
          <p className="soft">Every SMS, WhatsApp, and email the system has "sent" in this demo.</p>
        </div>

        <div className="filter-strip">
          {CHANNELS.map((c) => <button key={c} className={c === channel ? 'on' : ''} onClick={() => setChannel(c)}>{c}</button>)}
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : items.length === 0 ? (
          <p className="soft">No messages in this channel yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((m) => (
              <div key={m.id} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`pill pill-${m.channel === 'email' ? 'teal' : m.channel === 'whatsapp' ? 'soft' : 'gold'}`}>{m.channel}</span>
                    <strong>{m.to}</strong>
                  </div>
                  <span className="caption">{fmtDateTime(m.created_at)}</span>
                </div>
                {m.subject && <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-headline)', fontWeight: 700, color: 'var(--sb-ink)' }}>{m.subject}</p>}
                <p style={{ margin: 0, color: 'var(--sb-ink-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
