import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Modal from '../../components/Modal.jsx'
import { api, apiError } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { fmtDateTime } from '../../lib/format.js'
import { Plus, RotateCw, Trash2 } from 'lucide-react'

export default function AdminGateStaff() {
  const toast = useToast()
  const [staff, setStaff] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showPin, setShowPin] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '+263', event_id: '' })

  function load() {
    setLoading(true)
    Promise.all([
      api.get('/admin/gate-staff'),
      api.get('/admin/events', { params: { status: 'active' } }),
    ]).then(([s, e]) => {
      setStaff(s.data.gate_staff || s.data || [])
      setEvents(e.data.events || e.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function create() {
    if (!form.full_name || !form.phone || !form.event_id) {
      toast.error('Name, phone, and event are required.'); return
    }
    try {
      const { data } = await api.post('/admin/gate-staff', form)
      setShowPin({ pin: data.pin, name: data.gate_staff?.full_name || form.full_name })
      setCreating(false)
      setForm({ full_name: '', phone: '+263', event_id: '' })
      load()
    } catch (err) { toast.error(apiError(err)) }
  }
  async function regen(id) {
    try {
      const { data } = await api.post(`/admin/gate-staff/${id}/regenerate-pin`)
      setShowPin({ pin: data.pin, name: data.gate_staff?.full_name })
      load()
    } catch (err) { toast.error(apiError(err)) }
  }
  async function remove(id) {
    if (!confirm('Remove this gate staff member?')) return
    try {
      await api.delete(`/admin/gate-staff/${id}`)
      toast.info('Removed.')
      load()
    } catch (err) { toast.error(apiError(err)) }
  }

  return (
    <Layout>
      <div className="container">
        <div className="crumb"><Link to="/admin">← Admin</Link></div>
        <div className="page-head">
          <h1>Gate staff</h1>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add gate staff</button>
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : staff.length === 0 ? (
          <p className="soft">No gate staff yet. Add one for the next gathering.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Phone</th><th>Event</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.full_name}</strong></td>
                    <td>{s.phone}</td>
                    <td>{s.event_title || '—'}</td>
                    <td className="caption">{fmtDateTime(s.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-ghost btn-sm" onClick={() => regen(s.id)}><RotateCw size={12} /> New PIN</button>
                      <button className="btn-ghost btn-sm" onClick={() => remove(s.id)}><Trash2 size={12} /> Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add gate staff"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </>}
      >
        <div className="field"><label>Full name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="field"><label>Phone (+263 …)</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="field">
          <label>Event</label>
          <select className="input" value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })}>
            <option value="">Choose…</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <p className="caption">A 4-digit PIN will be generated. They sign in at <code>/gate/login</code> with their phone and PIN.</p>
      </Modal>

      <Modal
        open={!!showPin}
        onClose={() => setShowPin(null)}
        title="PIN issued"
        footer={<button className="btn btn-primary" onClick={() => setShowPin(null)}>Done</button>}
      >
        <p>Share this PIN with <strong>{showPin?.name}</strong> securely (in person or WhatsApp). It will not be shown again.</p>
        <div style={{ textAlign: 'center', margin: '24px 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, letterSpacing: '0.2em', color: 'var(--sb-pink)' }}>
          {showPin?.pin}
        </div>
      </Modal>
    </Layout>
  )
}
