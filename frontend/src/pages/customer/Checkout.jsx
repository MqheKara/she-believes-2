import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { money, fmtDateTime } from '../../lib/format.js'
import { Minus, Plus } from 'lucide-react'

const MAX_TICKETS = 10

export default function Checkout() {
  const { eventId } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [event, setEvent] = useState(null)
  const [qty, setQty] = useState({}) // ticket_type_id -> count
  const [names, setNames] = useState({}) // "ticket_type_id:index" -> name
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/events/${eventId}`).then(({ data }) => setEvent(data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [eventId])

  const totalQty = useMemo(() => Object.values(qty).reduce((a, b) => a + b, 0), [qty])
  const total = useMemo(() => {
    if (!event) return 0
    let t = 0
    for (const tt of event.ticket_types || []) {
      t += (qty[tt.id] || 0) * Number(tt.price_usd || 0)
    }
    return t
  }, [event, qty])

  function setQ(ttId, n, max) {
    const next = Math.max(0, Math.min(n, max ?? 0))
    const projected = totalQty - (qty[ttId] || 0) + next
    if (projected > MAX_TICKETS) {
      toast.error(`Up to ${MAX_TICKETS} tickets per order.`)
      return
    }
    setQty({ ...qty, [ttId]: next })
    // Prune name fields beyond new count
    const newNames = { ...names }
    Object.keys(newNames).forEach((k) => {
      const [tid, idxStr] = k.split(':')
      if (tid === String(ttId) && Number(idxStr) >= next) delete newNames[k]
    })
    setNames(newNames)
  }

  function setName(ttId, idx, val) {
    setNames({ ...names, [`${ttId}:${idx}`]: val })
  }

  async function submit() {
    if (totalQty === 0) {
      toast.error('Please choose at least one seat.')
      return
    }
    const items = []
    for (const tt of event.ticket_types) {
      const n = qty[tt.id] || 0
      for (let i = 0; i < n; i++) {
        const nm = (names[`${tt.id}:${i}`] || '').trim()
        if (!nm) {
          toast.error('Please add an attendee name for each ticket.')
          return
        }
        items.push({ ticket_type_id: tt.id, attendee_name: nm })
      }
    }
    setBusy(true)
    try {
      const { data } = await api.post('/orders', { event_id: event.id, items })
      nav(`/orders/${data.order.id}/submitted`, { replace: true })
    } catch (err) {
      if (err?.response?.data?.error === 'sold_out') {
        toast.error('Some seats just sold out, sister. Please adjust your order.')
      } else {
        toast.error(apiError(err))
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!event) return <Layout><div className="container section"><p>Gathering not found.</p></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to={`/events/${event.id}`}>← Back to {event.title}</Link></div>
        <div className="checkout-grid">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, margin: '0 0 6px' }}>Reserve your seats</h1>
            <p className="soft" style={{ marginBottom: 24 }}>{event.title} · {fmtDateTime(event.start_at)}</p>

            <div className="card card-pad">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, margin: '0 0 16px' }}>Choose your seats</h3>
              {(event.ticket_types || []).map((tt) => {
                const rem = tt.quantity_remaining ?? 0
                const n = qty[tt.id] || 0
                return (
                  <div key={tt.id} className="ticket-type">
                    <div style={{ flex: 1 }}>
                      <h4 className="ticket-type-name">{tt.name}</h4>
                      {tt.description && <p className="ticket-type-desc">{tt.description}</p>}
                      <div className="ticket-type-rem">
                        {rem === 0 ? 'Sold out' : `${rem} available · ${money(tt.price_usd)} each`}
                      </div>
                    </div>
                    <div className="qty-row">
                      <button className="qty-btn" disabled={n === 0} onClick={() => setQ(tt.id, n - 1, rem)} aria-label="Decrease"><Minus size={14} /></button>
                      <span className="qty-num">{n}</span>
                      <button className="qty-btn" disabled={n >= rem || totalQty >= MAX_TICKETS} onClick={() => setQ(tt.id, n + 1, rem)} aria-label="Increase"><Plus size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalQty > 0 && (
              <div className="card card-pad" style={{ marginTop: 20 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>Who's coming?</h3>
                <p className="soft" style={{ marginBottom: 4 }}>Name on each ticket — for the door list.</p>
                <div className="attendees-list">
                  {(event.ticket_types || []).flatMap((tt) =>
                    Array.from({ length: qty[tt.id] || 0 }).map((_, i) => (
                      <div key={`${tt.id}:${i}`} className="attendee-card">
                        <div className="attendee-num">{i + 1}</div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <span className="caption" style={{ color: 'var(--sb-pink)', fontWeight: 700, marginBottom: 4 }}>{tt.name}</span>
                          <input
                            placeholder="Full name"
                            value={names[`${tt.id}:${i}`] || ''}
                            onChange={(e) => setName(tt.id, i, e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="ticket-panel" style={{ position: 'sticky', top: 96 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, margin: '0 0 12px' }}>Order summary</h3>
              {totalQty === 0 ? (
                <p className="soft">No seats chosen yet.</p>
              ) : (
                <>
                  {(event.ticket_types || []).map((tt) => {
                    const n = qty[tt.id] || 0
                    if (!n) return null
                    return (
                      <div key={tt.id} className="summary-line">
                        <span>{tt.name} × {n}</span>
                        <span>{money(n * Number(tt.price_usd))}</span>
                      </div>
                    )
                  })}
                  <div className="summary-line total">
                    <span>Total (USD)</span>
                    <span>{money(total)}</span>
                  </div>
                </>
              )}
              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={submit}
                disabled={busy || totalQty === 0}
                style={{ marginTop: 16 }}
              >
                {busy ? 'Reserving…' : 'Reserve & continue to payment'}
              </button>
              <p className="caption" style={{ marginTop: 12 }}>
                Your seats will be held for 24 hours while you send EcoCash and confirm on WhatsApp.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
