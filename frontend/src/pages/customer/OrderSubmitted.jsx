import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { money } from '../../lib/format.js'
import { Phone, MessageCircle, Check } from 'lucide-react'

const POLL_MS = 8000
const ADMIN_WHATSAPP = '+263770000000' // demo placeholder, can be overridden later

export default function OrderSubmitted() {
  const { orderId } = useParams()
  const toast = useToast()
  const nav = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  async function poll() {
    try {
      const { data } = await api.get(`/orders/${orderId}`)
      setOrder(data)
      if (data.status === 'paid') {
        toast.success('Your ticket is ready, sister.')
        nav('/my-tickets', { replace: true })
      } else if (data.status === 'failed' || data.status === 'expired') {
        // remain on page so user can read banner
      }
    } catch (err) {
      // 404 means we lost the order — just stop
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [orderId])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>
  if (!order) return <Layout><div className="container section"><p>Order not found.</p></div></Layout>

  const ecoNumber = order.event?.ecocash_number || '+263 7XX XXX XXX'
  const waMsg = encodeURIComponent(
    `Hello SheBelieves. My order is ${order.id}. I have paid ${money(order.total_usd)} via EcoCash. My reference is: `
  )
  const waLink = `https://wa.me/${ADMIN_WHATSAPP.replace(/\D/g, '')}?text=${waMsg}`

  return (
    <Layout>
      <div className="container section">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="crumb">Order #{order.id?.slice(0, 8)}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 40, margin: '8px 0 12px' }}>
            Your seats are held. Now, EcoCash.
          </h1>
          <p className="soft" style={{ fontSize: 17, lineHeight: 1.55 }}>
            Send <strong>{money(order.total_usd)}</strong> via EcoCash to the number below, then drop us a WhatsApp with your transaction reference. We approve manually and your ticket appears here as soon as it's confirmed.
          </p>

          <div className="status-panel warning" style={{ marginTop: 20 }}>
            <div>
              <h3>Status: {order.status === 'pending' ? 'Awaiting payment confirmation' : order.status}</h3>
              <p>This page refreshes every few seconds. As soon as we approve your payment, you'll go straight to your tickets.</p>
            </div>
          </div>

          {order.status === 'pending' && (
            <div className="steps-list">
              <div className="step-card">
                <div className="step-num">1.</div>
                <h4>Open EcoCash</h4>
                <p>Send <strong>{money(order.total_usd)}</strong> to <strong>{ecoNumber}</strong></p>
              </div>
              <div className="step-card">
                <div className="step-num">2.</div>
                <h4>Note the reference</h4>
                <p>EcoCash will send you a transaction reference — copy it.</p>
              </div>
              <div className="step-card">
                <div className="step-num">3.</div>
                <h4>WhatsApp us</h4>
                <p>Send your order ID and reference to our number, and we'll approve.</p>
              </div>
              <div className="step-card">
                <div className="step-num">4.</div>
                <h4>Walk in with QR</h4>
                <p>Your ticket appears here and you'll be ready for the door.</p>
              </div>
            </div>
          )}

          {order.status === 'pending' && (
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <a href={`tel:${ecoNumber}`} className="btn btn-secondary"><Phone size={16} /> {ecoNumber}</a>
              <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-primary"><MessageCircle size={16} /> WhatsApp our team</a>
            </div>
          )}

          {order.status === 'failed' && (
            <div className="status-panel danger" style={{ marginTop: 20 }}>
              <div>
                <h3>Your payment couldn't be verified</h3>
                <p>Sometimes it's just a reference mismatch. WhatsApp our team and we'll sort it.</p>
              </div>
            </div>
          )}

          {order.status === 'expired' && (
            <div className="status-panel danger" style={{ marginTop: 20 }}>
              <div>
                <h3>This hold has expired</h3>
                <p>Your 24-hour seat hold ended. <Link to={`/events/${order.event_id}`}>Try reserving again →</Link></p>
              </div>
            </div>
          )}

          <div style={{ marginTop: 32 }}>
            <Link to="/my-orders" className="btn btn-ghost">View all my orders →</Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}
