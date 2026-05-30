import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { useToast } from '../../lib/toast.jsx'
import { Wordmark } from '../../brand/Ornaments.jsx'

export default function OrganizerAcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const toast = useToast()
  const { login } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ full_name: '', phone: '+263', password: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) toast.error('Missing invite token.')
  }, [token])

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 10) {
      toast.error('Organizer password must be at least 10 characters.')
      return
    }
    if (!form.phone.startsWith('+263')) {
      toast.error('Phone must start with +263.')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/organizer/accept-invite', { token, ...form })
      login({ token: data.token, user: data.user })
      toast.success('Welcome aboard. Let\'s build something beautiful.')
      nav('/org', { replace: true })
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div className="auth-shell">
        <div className="auth-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Wordmark height={26} /></div>
          <h1>Accept your invite</h1>
          <p className="sub">You've been invited to organize gatherings with SheBelieves.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Your full name</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Phone (+263 …)</label>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="field">
              <label>Password (min 10)</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || !token}>
              {busy ? 'Setting up…' : 'Accept invite & sign in'}
            </button>
          </form>
          <div className="alt"><Link to="/staff/login">Already set up? Sign in →</Link></div>
        </div>
      </div>
    </Layout>
  )
}
