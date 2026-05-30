import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import Layout from '../../components/Layout.jsx'
import Modal from '../../components/Modal.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { fmtDateTime, money, paymentDisplay } from '../../lib/format.js'

export default function AdminTicketDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')

  function load() {
    setLoading(true)
    api.get(`/admin/tickets/${id}`).then(({ data }) => setTicket(data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id])

  async function doVoid() {
    try {
      await api.post(`/admin/tickets/${id}/void`, { reason })
      toast.success('Ticket voided.')
      setVoiding(false); setReason(''); load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!ticket) return <Layout><div className="container section"><p>Ticket not found.</p></div></Layout>

  const checkins = ticket.checkins || ticket.scans || []

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to={`/admin/events/${ticket.event_id}`}>← Event</Link></div>
        <div className="page-head">
          <div>
            <h1>Ticket</h1>
            <p className="soft">#{ticket.id?.slice(0, 8)} · {ticket.event_title}</p>
          </div>
          {ticket.status === 'valid' && (
            <button className="btn btn-danger btn-sm" onClick={() => setVoiding(true)}>Void ticket</button>
          )}
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 14px' }}>Details</h3>
            <div className="stub-line"><span className="label">Status</span><span className="val"><span className={`pill pill-${ticket.status === 'valid' ? 'soft' : ticket.status === 'used' ? 'success' : 'muted'}`}>{ticket.status}</span></span></div>
            <div className="stub-line"><span className="label">Attendee</span><span className="val">{ticket.attendee_name}</span></div>
            <div className="stub-line"><span className="label">Ticket type</span><span className="val">{ticket.ticket_type_name}</span></div>
            <div className="stub-line"><span className="label">Source</span><span className="val">{ticket.source}</span></div>
            <div className="stub-line"><span className="label">Buyer</span><span className="val">{ticket.buyer_name || '—'}</span></div>
            <div className="stub-line"><span className="label">Buyer phone</span><span className="val">{ticket.buyer_phone || '—'}</span></div>
            <div className="stub-line"><span className="label">Order</span><span className="val"><code style={{ fontSize: 12 }}>{ticket.order_id?.slice(0, 8) || '—'}</code></span></div>
            <div className="stub-line"><span className="label">Paid</span><span className="val">{money(ticket.price_paid_usd || 0)}</span></div>
            <div className="stub-line"><span className="label">Payment</span><span className="val">{paymentDisplay(ticket.payment_ref)}</span></div>
            <div className="stub-line"><span className="label">Issued</span><span className="val">{fmtDateTime(ticket.created_at)}</span></div>
          </div>

          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 14px' }}>QR code</h3>
            {ticket.qr_code ? (
              <div className="qr-frame" style={{ margin: 0 }}>
                <QRCodeCanvas value={ticket.qr_code} size={220} fgColor="#1A1124" includeMargin level="M" />
              </div>
            ) : <p className="soft">No QR yet.</p>}
            <p className="caption" style={{ marginTop: 12 }}>For gate scanning only — handle with care.</p>
          </div>
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '32px 0 12px' }}>Check-in history</h3>
        {checkins.length === 0 ? (
          <p className="soft">Not yet scanned.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>Result</th><th>Gate staff</th><th>Device</th></tr></thead>
              <tbody>
                {checkins.map((c, i) => (
                  <tr key={c.id || i}>
                    <td>{fmtDateTime(c.scanned_at)}</td>
                    <td><span className={`pill pill-${c.result === 'valid' ? 'success' : c.result === 'duplicate' ? 'warning' : 'muted'}`}>{c.result}</span></td>
                    <td>{c.gate_staff_name || '—'}</td>
                    <td className="caption">{c.device_id?.slice(0, 8) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={voiding}
        onClose={() => setVoiding(false)}
        title="Void this ticket"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setVoiding(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={doVoid}>Void</button>
        </>}
      >
        <p>Voiding cannot be undone. The QR will no longer scan at the gate.</p>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </Layout>
  )
}
