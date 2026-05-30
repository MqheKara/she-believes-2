import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import { api, apiError } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { useToast } from '../../lib/toast.jsx'
import { Wordmark } from '../../brand/Ornaments.jsx'

export default function StaffLogin() {
  const { login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const loc = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/auth/login', form)
      const role = data.user?.role
      if (role !== 'admin' && role !== 'organizer') {
        toast.error('Use the customer sign-in for that account.')
        return
      }
      login({ token: data.token, user: data.user })
      toast.success(`Signed in as ${role}.`)
      const fallback = role === 'admin' ? '/admin' : '/org'
      nav(loc.state?.from || fallback, { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Could not sign in.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div className="auth-shell">
        <div className="auth-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Wordmark height={26} /></div>
          <h1>Staff sign in</h1>
          <p className="sub">For admins and organizers.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="alt"><Link to="/login">Customer sign in →</Link></div>
          <div className="alt" style={{ marginTop: 6 }}><Link to="/gate/login">Gate staff sign in →</Link></div>
        </div>
      </div>
    </Layout>
  )
}
