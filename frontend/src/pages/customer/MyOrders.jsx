import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { api } from '../../lib/api.js'
import { money, fmtDateTime, paymentDisplay } from '../../lib/format.js'

const STATUS_PILL = {
  pending: 'pill-warning',
  paid: 'pill-success',
  failed: 'pill-muted',
  expired: 'pill-muted',
  comp: 'pill-gold',
}

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/my/orders').then(({ data }) => setOrders(data.orders || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Layout><div className="center-spinner"><span className="spinner" /></div></Layout>

  return (
    <Layout>
      <div className="container">
        <div className="page-head">
          <div>
            <div className="crumb">A record of every booking</div>
            <h1>My Orders</h1>
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            body="When you reserve seats, your orders will appear here."
          >
            <Link to="/events" className="btn btn-primary">Browse gatherings</Link>
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Gathering</th><th>Placed</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.event_title || 'Gathering'}</strong>
                      <div className="caption">#{o.id?.slice(0, 8)}</div>
                    </td>
                    <td>{fmtDateTime(o.created_at)}</td>
                    <td>{money(o.total_usd)}</td>
                    <td className="caption">{paymentDisplay(o.payment_ref)}</td>
                    <td><span className={`pill ${STATUS_PILL[o.status] || 'pill-muted'}`}>{o.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {o.status === 'pending'
                        ? <Link to={`/orders/${o.id}/submitted`} className="btn-ghost btn-sm">Continue →</Link>
                        : <Link to="/my-tickets" className="btn-ghost btn-sm">View tickets →</Link>}
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
