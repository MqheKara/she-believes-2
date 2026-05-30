import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, apiError } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { useToast } from '../../lib/toast.jsx'
import { Wordmark } from '../../brand/Ornaments.jsx'

export default function GateLogin() {
  const { login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [phone, setPhone] = useState('+263')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pin.length !== 4) { toast.error('PIN must be 4 digits.'); return }
    setBusy(true)
    try {
      const { data } = await api.post('/auth/staff/login', { phone, pin })
      const user = { ...data.user, role: 'gate_staff' }
      login({ token: data.token, user })
      toast.success(`Signed in. Steady hands, ${data.user?.full_name?.split(' ')[0] || 'sister'}.`)
      nav('/gate/scan', { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Invalid phone or PIN.'))
    } finally { setBusy(false) }
  }

  return (
    <div className="gate-shell">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 36, maxWidth: 400, width: '100%', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18, filter: 'invert(1) hue-rotate(180deg)' }}>
            <Wordmark height={26} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, margin: '0 0 6px', color: '#fff', textAlign: 'center' }}>Gate sign in</h1>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', margin: '0 0 24px', fontSize: 14 }}>Phone & 4-digit PIN.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label style={{ color: 'rgba(255,255,255,0.7)' }}>Phone (+263 …)</label>
              <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="field">
              <label style={{ color: 'rgba(255,255,255,0.7)' }}>PIN</label>
              <input className="input" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} required style={{ fontSize: 24, letterSpacing: '0.4em', textAlign: 'center' }} />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
            <Link to="/staff/login" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin/organizer →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
