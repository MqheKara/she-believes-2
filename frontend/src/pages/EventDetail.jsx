import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { api, apiError, mediaUrl } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'
import { fmtDateTime, money, countdown } from '../lib/format.js'
import { CrownMark } from '../brand/Ornaments.jsx'
import { Calendar, MapPin, Clock } from 'lucide-react'

export default function EventDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/events/${id}`).then(({ data }) => setEvent(data)).catch((e) => {
      toast.error(apiError(e, 'Could not load this gathering.'))
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!event) return <Layout><div className="container section"><p>This gathering could not be found.</p></div></Layout>

  const altar = event.category === 'Festival' || event.category === 'Music'
  const surface = altar ? 'altar' : 'blush'
  const types = event.ticket_types || []
  const anyAvail = types.some((t) => (t.quantity_remaining ?? 0) > 0)

  function goCheckout() {
    if (!user) {
      nav('/login', { state: { next: `/checkout/${event.id}` } })
      return
    }
    nav(`/checkout/${event.id}`)
  }

  return (
    <Layout surface={surface}>
      <div className={`container event-detail ${altar ? 'altar' : ''}`}>
        <div>
          <div className="crumb"><Link to="/events">← All gatherings</Link></div>
          <div
            className="event-detail-hero"
            style={{ backgroundImage: event.poster_url ? `url(${mediaUrl(event.poster_url)})` : undefined }}
          >
            {!event.poster_url && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CrownMark size={96} color={altar ? '#D4A537' : '#EC1E79'} />
              </div>
            )}
          </div>
          <span className={`pill pill-${(event.category || 'other').toLowerCase()}`}>{event.category}</span>
          <h1>{event.title}</h1>
          {event.tagline && <p className="tagline">{event.tagline}</p>}

          <div className="event-meta">
            <div className="event-meta-row"><Calendar size={16} /> {fmtDateTime(event.start_at)}</div>
            <div className="event-meta-row"><Clock size={16} /> ends {fmtDateTime(event.end_at)}</div>
            <div className="event-meta-row"><MapPin size={16} /> {event.venue_name}, {event.city}</div>
            <div className="event-meta-row">⏳ {countdown(event.start_at)} to go</div>
          </div>

          {event.description && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, marginBottom: 12 }}>About this gathering</h3>
              <div className="about-block">{event.description}</div>
            </div>
          )}
        </div>

        <aside>
          <div className="ticket-panel">
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginTop: 0 }}>Reserve your seat</h3>

            {types.length === 0 ? (
              <p className="soft">Ticket types coming soon.</p>
            ) : (
              <div>
                {types.map((t) => {
                  const rem = t.quantity_remaining ?? 0
                  return (
                    <div key={t.id} className="ticket-type">
                      <div style={{ flex: 1 }}>
                        <h4 className="ticket-type-name">{t.name}</h4>
                        {t.description && <p className="ticket-type-desc">{t.description}</p>}
                        <span className="ticket-type-rem">
                          {rem === 0 ? 'Sold out' : rem <= 10 ? `Only ${rem} left` : `${rem} available`}
                        </span>
                      </div>
                      <div className="ticket-type-price">{money(t.price_usd)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              className={altar ? 'btn btn-altar btn-block btn-lg' : 'btn btn-primary btn-block btn-lg'}
              onClick={goCheckout}
              disabled={!anyAvail}
              style={{ marginTop: 18 }}
            >
              {anyAvail ? 'Reserve seats' : 'Sold out'}
            </button>
            <p className={altar ? 'caption' : 'caption'} style={{ marginTop: 12, opacity: 0.85 }}>
              After you choose your seats, we'll share the EcoCash details and confirm your ticket on WhatsApp.
            </p>
          </div>
        </aside>
      </div>
    </Layout>
  )
}
