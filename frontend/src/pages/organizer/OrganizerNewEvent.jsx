import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError, mediaUrl } from '../../lib/api.js'
import { useToast } from '../../lib/toast.jsx'
import { Plus, Trash2 } from 'lucide-react'

const CATS = ['Church', 'Music', 'Arts', 'Festival', 'Other']

export default function OrganizerNewEvent() {
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({
    title: '', tagline: '', category: 'Church', description: '',
    venue_name: '', city: '', start_at: '', end_at: '',
  })
  const [types, setTypes] = useState([
    { name: 'General', price_usd: 5, quantity_total: 100, description: '' },
  ])
  const [posterUrl, setPosterUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  function setF(k, v) { setForm({ ...form, [k]: v }) }
  function setT(i, k, v) {
    const next = [...types]
    next[i] = { ...next[i], [k]: v }
    setTypes(next)
  }

  async function uploadPoster(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/uploads/poster', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      // Backend returns { poster_url, poster_thumb_url } — NOT { url }. Earlier
      // code used data.url which was always undefined, so uploads silently failed
      // to attach to the event. Fixed here.
      setPosterUrl(data.poster_url)
      toast.success('Poster uploaded.')
    } catch (err) {
      toast.error(apiError(err, 'Could not upload poster.'))
    } finally {
      setUploading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (types.length === 0) { toast.error('Add at least one ticket type.'); return }
    setBusy(true)
    try {
      const payload = {
        ...form,
        poster_url: posterUrl || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        ticket_types: types.map((t) => ({
          name: t.name,
          description: t.description || null,
          price_usd: Number(t.price_usd),
          quantity_total: Number(t.quantity_total),
        })),
      }
      const { data } = await api.post('/organizer/events', payload)
      toast.success('Submitted for approval.')
      nav(`/org/events/${data.event.id}`)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div className="container section">
        <div className="crumb"><Link to="/org">← Back to dashboard</Link></div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, margin: '8px 0 24px' }}>New gathering</h1>

        <form onSubmit={submit} className="card card-pad" style={{ maxWidth: 820 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 12px' }}>The basics</h3>
          <div className="field">
            <label>Title</label>
            <input className="input" value={form.title} onChange={(e) => setF('title', e.target.value)} required />
          </div>
          <div className="field">
            <label>Tagline (optional, shown in italics)</label>
            <input className="input" value={form.tagline} onChange={(e) => setF('tagline', e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Category</label>
              <select className="input" value={form.category} onChange={(e) => setF('category', e.target.value)}>
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>City</label>
              <input className="input" value={form.city} onChange={(e) => setF('city', e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Venue name</label>
            <input className="input" value={form.venue_name} onChange={(e) => setF('venue_name', e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Starts at</label>
              <input className="input" type="datetime-local" value={form.start_at} onChange={(e) => setF('start_at', e.target.value)} required />
            </div>
            <div className="field">
              <label>Ends at</label>
              <input className="input" type="datetime-local" value={form.end_at} onChange={(e) => setF('end_at', e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="input textarea" rows="6" value={form.description} onChange={(e) => setF('description', e.target.value)} />
          </div>
          <div className="field">
            <label>Poster</label>
            <input type="file" accept="image/*" onChange={uploadPoster} />
            {uploading && <span className="caption">Uploading…</span>}
            {posterUrl && <img src={mediaUrl(posterUrl)} alt="Poster" style={{ marginTop: 10, maxHeight: 200, borderRadius: 12 }} />}
          </div>

          <hr className="hairline" style={{ margin: '24px 0' }} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 12px' }}>Ticket types</h3>
          {types.map((t, i) => (
            <div key={i} className="card" style={{ background: 'var(--sb-blush-bg)', padding: 16, marginBottom: 12 }}>
              <div className="grid-2">
                <div className="field">
                  <label>Name</label>
                  <input className="input" value={t.name} onChange={(e) => setT(i, 'name', e.target.value)} required />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Price (USD)</label>
                    <input className="input" type="number" step="0.01" min="0" value={t.price_usd} onChange={(e) => setT(i, 'price_usd', e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Total qty</label>
                    <input className="input" type="number" min="1" value={t.quantity_total} onChange={(e) => setT(i, 'quantity_total', e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <input className="input" value={t.description} onChange={(e) => setT(i, 'description', e.target.value)} />
              </div>
              {types.length > 1 && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setTypes(types.filter((_, j) => j !== i))}>
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTypes([...types, { name: '', price_usd: 0, quantity_total: 100, description: '' }])}>
            <Plus size={14} /> Add ticket type
          </button>

          <hr className="hairline" style={{ margin: '24px 0' }} />
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </button>
          <p className="caption" style={{ marginTop: 12 }}>An admin will review and approve before it goes live.</p>
        </form>
      </div>
    </Layout>
  )
}
