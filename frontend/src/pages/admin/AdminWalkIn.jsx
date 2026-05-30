import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { money } from '../../lib/format.js'
import { Plus, Trash2 } from 'lucide-react'

const MAX_WALKIN = 20

export default function AdminWalkIn() {
  const [params] = useSearchParams()
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState(params.get('event_id') || '')
  const [event, setEvent] = useState(null)
  const [items, setItems] = useState([{ ticket_type_id: '', attendee_name: '', price_override: '' }])
  const [buyer, setBuyer] = useState({ name: '', phone: '+263', email: '', method: 'cash', code: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/admin/events', { params: { status: 'active' } }).then(({ data }) => setEvents(data.events || data || []))
  }, [])

  useEffect(() => {
    if (eventId) {
      api.get(`/admin/events/${eventId}`).then(({ data }) => setEvent(data))
    } else {
      setEvent(null)
    }
  }, [eventId])

  function setItem(i, k, v) {
    const next = [...items]
    next[i] = { ...next[i], [k]: v }
    setItems(next)
  }

  async function submit() {
    if (!eventId) { toast.error('Choose an event.'); return }
    if (items.length === 0) { toast.error('Add at least one ticket.'); return }
    for (const it of items) {
      if (!it.ticket_type_id || !it.attendee_name.trim()) {
        toast.error('Each ticket needs a type and attendee name.')
        return
      }
    }
    setBusy(true)
    try {
      const payload = {
        event_id: eventId,
        items: items.map((i) => ({
          ticket_type_id: i.ticket_type_id,
          attendee_name: i.attendee_name,
          price_override: i.price_override === '' ? null : Number(i.price_override),
        })),
        buyer_name: buyer.name || null,
        buyer_phone: buyer.phone || null,
        buyer_email: buyer.email || null,
        payment_method: buyer.method,
        payment_code: buyer.code || null,
      }
      const { data } = await api.post('/admin/walk-in-tickets', payload)
      toast.success(`Issued ${data.tickets?.length || items.length} walk-in tickets.`)
      setItems([{ ticket_type_id: '', attendee_name: '', price_override: '' }])
      setBuyer({ name: '', phone: '+263', email: '', method: 'cash', code: '' })
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div className="container section">
        <div className="crumb"><Link to="/admin">← Admin</Link></div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, margin: '8px 0 8px' }}>Walk-in tickets</h1>
        <p className="soft" style={{ marginBottom: 24 }}>Issue tickets in person at the door. Up to {MAX_WALKIN} per order.</p>

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
              <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 13, color: 'var(--sb-pink)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '12px 0 8px' }}>Tickets</h4>
              {items.map((it, i) => (
                <div key={i} className="card" style={{ background: 'var(--sb-blush-bg)', padding: 14, marginBottom: 10 }}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Ticket type</label>
                      <select className="input" value={it.ticket_type_id} onChange={(e) => setItem(i, 'ticket_type_id', e.target.value)} required>
                        <option value="">Choose…</option>
                        {(event.ticket_types || []).map((t) => (
                          <option key={t.id} value={t.id}>{t.name} · {money(t.price_usd)} · {t.quantity_remaining} left</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid-2">
                      <div className="field">
                        <label>Attendee name</label>
                        <input className="input" value={it.attendee_name} onChange={(e) => setItem(i, 'attendee_name', e.target.value)} required />
                      </div>
                      <div className="field">
                        <label>Price override (USD)</label>
                        <input className="input" type="number" step="0.01" min="0" placeholder="—" value={it.price_override} onChange={(e) => setItem(i, 'price_override', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button className="btn-ghost btn-sm" type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={12} /> Remove</button>
                  )}
                </div>
              ))}
              {items.length < MAX_WALKIN && (
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setItems([...items, { ticket_type_id: '', attendee_name: '', price_override: '' }])}>
                  <Plus size={12} /> Add ticket
                </button>
              )}

              <hr className="hairline" style={{ margin: '20px 0' }} />
              <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: 13, color: 'var(--sb-pink)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>Buyer (optional)</h4>
              <div className="grid-2">
                <div className="field"><label>Name</label><input className="input" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} /></div>
                <div className="field"><label>Phone</label><input className="input" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} /></div>
              </div>
              <div className="grid-2">
                <div className="field"><label>Email</label><input className="input" type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} /></div>
                <div className="grid-2">
                  <div className="field"><label>Method</label><select className="input" value={buyer.method} onChange={(e) => setBuyer({ ...buyer, method: e.target.value })}><option value="cash">Cash</option><option value="ecocash">EcoCash</option></select></div>
                  <div className="field"><label>EcoCash code (if any)</label><input className="input" value={buyer.code} onChange={(e) => setBuyer({ ...buyer, code: e.target.value })} /></div>
                </div>
              </div>

              <button className="btn btn-primary btn-block btn-lg" onClick={submit} disabled={busy} style={{ marginTop: 16 }}>
                {busy ? 'Issuing…' : `Issue ${items.length} ticket${items.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
