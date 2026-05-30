import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Modal from '../../components/Modal.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { money, fmtDateTime } from '../../lib/format.js'
import { MessageCircle } from 'lucide-react'

export default function AdminOrderRequests() {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(null) // order
  const [rejecting, setRejecting] = useState(null)
  const [code, setCode] = useState('')
  const [reason, setReason] = useState('')

  function load() {
    setLoading(true)
    api.get('/admin/order-requests').then(({ data }) => setOrders(data.orders || data || []))
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function approve() {
    if (!approving) return
    try {
      await api.post(`/admin/order-requests/${approving.id}/approve`, { ecocash_code: code })
      toast.success('Approved. Tickets are minting.')
      setApproving(null); setCode(''); load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }
  async function reject() {
    if (!rejecting) return
    try {
      await api.post(`/admin/order-requests/${rejecting.id}/reject`, { reason })
      toast.info('Rejected.')
      setRejecting(null); setReason(''); load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to="/admin">← Admin</Link></div>
        <div className="page-head">
          <h1>Order requests</h1>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : orders.length === 0 ? (
          <p className="soft">No pending requests right now.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Order</th><th>Gathering</th><th>Buyer</th><th>Items</th><th>Total</th><th>Placed</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const waPhone = (o.buyer_phone || '').replace(/\D/g, '')
                  const waMsg = encodeURIComponent(`SheBelieves: your order ${o.id.slice(0,8)} for ${money(o.total_usd)} — please share your EcoCash reference.`)
                  return (
                    <tr key={o.id}>
                      <td><code style={{ fontSize: 12 }}>{o.id.slice(0, 8)}</code></td>
                      <td>{o.event_title}</td>
                      <td>
                        <div>{o.buyer_name}</div>
                        <div className="caption">{o.buyer_phone}</div>
                      </td>
                      <td>{o.item_count} ticket{o.item_count === 1 ? '' : 's'}</td>
                      <td>{money(o.total_usd)}</td>
                      <td className="caption">{fmtDateTime(o.created_at)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {waPhone && <a href={`https://wa.me/${waPhone}?text=${waMsg}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><MessageCircle size={12} /> WA</a>}
                        <button className="btn-ghost btn-sm" onClick={() => setApproving(o)}>Approve</button>
                        <button className="btn-ghost btn-sm" onClick={() => setRejecting(o)}>Reject</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!approving}
        onClose={() => setApproving(null)}
        title="Approve order"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setApproving(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={approve}>Approve & mint tickets</button>
        </>}
      >
        <p>Enter the EcoCash transaction code for this payment (optional but recommended).</p>
        <div className="field" style={{ marginTop: 12 }}>
          <label>EcoCash code</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. EC1234567" />
        </div>
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject order"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={reject}>Reject</button>
        </>}
      >
        <p>Reason (optional). The customer will see this in their notifications.</p>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Reason</label>
          <textarea className="input textarea" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </Layout>
  )
}
