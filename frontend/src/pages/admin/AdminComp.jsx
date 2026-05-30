import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { money } from '../../lib/format.js'
import { Plus, Trash2 } from 'lucide-react'

export default function AdminComp() {
  const [params] = useSearchParams()
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState(params.get('event_id') || '')
  const [event, setEvent] = useState(null)
  const [items, setItems] = useState([{ ticket_type_id: '', attendee_name: '' }])
  const [recipient, setRecipient] = useState({ name: '', phone: '+263', email: '' })
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/admin/events', { params: { status: 'active' } }).then(({ data }) => setEvents(data.events || data || []))
  }, [])
  useEffect(() => {
    if (eventId) api.get(`/admin/events/${eventId}`).then(({ data }) => setEvent(data))
    else setEvent(null)
  }, [eventId])

  function setItem(i, k, v) {
    const next = [...items]; next[i] = { ...next[i], [k]: v }; setItems(next)
  }

  async function submit() {
    if (!eventId) { toast.error('Choose an event.'); return }
    for (const it of items) {
      if (!it.ticket_type_id || !it.attendee_name.trim()) {
        toast.error('Each comp ticket needs a type and attendee name.'); return
      }
    }
    setBusy(true)
    try {
      const { data } = await api.post('/admin/comp-tickets', {
        event_id: eventId,
        items,
        recipient_name: recipient.name || null,
        recipient_phone: recipient.phone || null,
        recipient_email: recipient.email || null,
        reason: reason || null,
      })
      toast.success(`Issued ${data.tickets?.length || items.length} comp tickets.`)
      setItems([{ ticket_type_id: '', attendee_name: '' }])
      setRecipient({ name: '', phone: '+263', email: '' })
      setReason('')
    } catch (err) {
      toast.error(apiError(err))
    } finally { setBusy(false) }
  }

  return (
    <Layout>
      <div className="container section">
        <div className="crumb"><Link to="/admin">← Admin</Link></div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, margin: '8px 0 8px' }}>Comp tickets</h1>
        <p className="soft" style={{ marginBottom: 24 }}>Issue free passes for ministry partners, press, or guests. Comps still count against capacity.</p>

        <div className="card card-pad" style={{ maxWidth: 820 }}>
          <div className="field">
            <label>Event</label>
            <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Choose an event…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>

          {event && (
            <>
              <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 13, color: 'var(--sb-pink)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '12px 0 8px' }}>Comp tickets</h4>
              {items.map((it, i) => (
                <div key={i} className="card" style={{ background: 'var(--sb-blush-bg)', padding: 14, marginBottom: 10 }}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Ticket type</label>
                      <select className="input" value={it.ticket_type_id} onChange={(e) => setItem(i, 'ticket_type_id', e.target.value)} required>
                        <option value="">Choose…</option>
                        {(event.ticket_types || []).map((t) => (
                          <option key={t.id} value={t.id} disabled={(t.quantity_remaining ?? 0) === 0}>
                            {t.name} · {money(t.price_usd)} · {t.quantity_remaining ?? 0} left
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Attendee name</label>
                      <input className="input" value={it.attendee_name} onChange={(e) => setItem(i, 'attendee_name', e.target.value)} required />
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button className="btn-ghost btn-sm" type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={12} /> Remove</button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setItems([...items, { ticket_type_id: '', attendee_name: '' }])}><Plus size={12} /> Add comp ticket</button>

              <hr className="hairline" style={{ margin: '20px 0' }} />
              <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 13, color: 'var(--sb-pink)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>Recipient (optional)</h4>
              <div className="grid-2">
                <div className="field"><label>Name</label><input className="input" value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} /></div>
                <div className="field"><label>Phone</label><input className="input" value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} /></div>
              </div>
              <div className="field"><label>Email</label><input className="input" type="email" value={recipient.email} onChange={(e) => setRecipient({ ...recipient, email: e.target.value })} /></div>
              <div className="field"><label>Reason (audit trail)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Worship team, press, volunteer" /></div>

              <button className="btn btn-primary btn-block btn-lg" onClick={submit} disabled={busy} style={{ marginTop: 16 }}>
                {busy ? 'Issuing…' : `Issue ${items.length} comp ticket${items.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
