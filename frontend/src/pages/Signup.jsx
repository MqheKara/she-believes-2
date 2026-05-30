import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { api, apiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'
import { Wordmark } from '../brand/Ornaments.jsx'

export default function Signup() {
  const { login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const loc = useLocation()
  const next = loc.state?.next || '/my-tickets'
  const [form, setForm] = useState({ full_name: '', email: '', phone: '+263', password: '' })
  const [busy, setBusy] = useState(false)

  function update(k, v) { setForm({ ...form, [k]: v }) }

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (!form.phone.startsWith('+263')) {
      toast.error('Phone must start with +263.')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/auth/signup', form)
      login({ token: data.token, user: { ...data.user, role: 'customer' } })
      toast.success(`Welcome, sister.`)
      nav(next, { replace: true })
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
          <h1>Join the sisterhood</h1>
          <p className="sub">Create your account to reserve seats, save tickets, and stay close to the gatherings.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Your name</label>
              <input className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            </div>
            <div className="field">
              <label>Phone (+263 …)</label>
              <input className="input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
            </div>
            <div className="field">
              <label>Password (min 8)</label>
              <input className="input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <div className="alt">Already a sister? <Link to="/login">Sign in</Link></div>
        </div>
      </div>
    </Layout>
  )
}
