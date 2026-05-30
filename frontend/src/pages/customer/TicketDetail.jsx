import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { fmtDateTime } from '../../lib/format.js'
import { Send } from 'lucide-react'

export default function TicketDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    api.get(`/my/tickets/${id}`).then(({ data }) => setTicket(data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }, [id])

  async function resend() {
    setResending(true)
    try {
      await api.post(`/my/tickets/${id}/resend`)
      toast.success('Resent to your WhatsApp and email.')
    } catch (e) {
      toast.error(apiError(e))
    } finally {
      setResending(false)
    }
  }

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!ticket) return <Layout><div className="container section"><p>Ticket not found.</p></div></Layout>

  return (
    <Layout>
      <div className="container section">
        <div className="crumb"><Link to="/my-tickets">← My tickets</Link></div>
        <div className="ticket-stub">
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span className={`pill pill-${ticket.status === 'valid' ? 'soft' : ticket.status === 'used' ? 'success' : 'muted'}`}>{ticket.status}</span>
          </div>
          <h1 style={{ textAlign: 'center' }}>{ticket.event_title}</h1>
          <p className="center soft" style={{ marginBottom: 8 }}>{fmtDateTime(ticket.event_start_at)}</p>
          <p className="center soft">{ticket.venue_name}{ticket.venue_city ? `, ${ticket.venue_city}` : ''}</p>

          <div className="qr-frame">
            {ticket.qr_code ? (
              <QRCodeCanvas value={ticket.qr_code} size={260} fgColor="#1A1124" bgColor="#FFFFFF" includeMargin level="M" />
            ) : (
              <p className="soft">QR not yet issued.</p>
            )}
          </div>

          <div className="stub-line"><span className="label">Attendee</span><span className="val">{ticket.attendee_name}</span></div>
          <div className="stub-line"><span className="label">Ticket type</span><span className="val">{ticket.ticket_type_name}</span></div>
          <div className="stub-line"><span className="label">Ticket ID</span><span className="val" style={{ fontFamily: 'monospace', fontSize: 12 }}>{ticket.id?.slice(0, 8)}</span></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={resend} disabled={resending}>
            <Send size={16} /> {resending ? 'Resending…' : 'Resend to WhatsApp & email'}
          </button>
        </div>

        <p className="caption center" style={{ marginTop: 24 }}>
          Show this QR at the door. Come expectant, sister.
        </p>
      </div>
    </Layout>
  )
}
