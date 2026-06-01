import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { api, apiError } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { useToast } from '../../lib/toast.jsx'
import { LogOut, Check, AlertCircle, X } from 'lucide-react'

const DEVICE_KEY = 'sb_gate_device_id'
const DEBOUNCE_MS = 2500

function getDeviceId() {
  let d = localStorage.getItem(DEVICE_KEY)
  if (!d) {
    d = 'gate-' + (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now())
    localStorage.setItem(DEVICE_KEY, d)
  }
  return d
}

export default function GateScan() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const scannerRef = useRef(null)
  const lastScanRef = useRef({ code: '', at: 0 })
  const [running, setRunning] = useState(false)
  const [manual, setManual] = useState('')
  const [result, setResult] = useState(null)
  const [recent, setRecent] = useState([])

  async function startCamera() {
    if (running) return
    try {
      const qr = new Html5Qrcode('qr-reader')
      scannerRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => handleScan(decoded),
        () => {}
      )
      setRunning(true)
    } catch (err) {
      toast.error('Camera not available. Use manual entry below.')
    }
  }

  async function stopCamera() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
        scannerRef.current = null
      }
    } catch {}
    setRunning(false)
  }

  useEffect(() => {
    startCamera()
    return () => { stopCamera() }
    // eslint-disable-next-line
  }, [])

  async function handleScan(qrCode) {
    const now = Date.now()
    if (qrCode === lastScanRef.current.code && now - lastScanRef.current.at < DEBOUNCE_MS) return
    lastScanRef.current = { code: qrCode, at: now }
    try {
      const { data } = await api.post('/gate/checkin', {
        qr_code: qrCode,
        device_id: getDeviceId(),
        scanned_at: new Date().toISOString(),
      })
      // Backend returns a FLAT response: { status, message, attendee_name, ticket_type }.
      // Normalize it into the { result, ticket, message } shape this component renders.
      const r = data.status || 'valid'
      const ticket = data.attendee_name
        ? { attendee_name: data.attendee_name, ticket_type_name: data.ticket_type }
        : null
      setResult({ result: r, ticket, message: data.message })
      setRecent((prev) => [{ id: now, result: r, name: data.attendee_name || '—' }, ...prev].slice(0, 12))
    } catch (err) {
      const d = err?.response?.data || {}
      const r = d.status || 'invalid'
      const ticket = d.attendee_name
        ? { attendee_name: d.attendee_name, ticket_type_name: d.ticket_type }
        : null
      setResult({ result: r, ticket, message: d.message || apiError(err, 'Invalid QR.') })
      setRecent((prev) => [{ id: now, result: r, name: d.attendee_name || '—' }, ...prev].slice(0, 12))
    }
  }

  function manualSubmit(e) {
    e.preventDefault()
    if (!manual.trim()) return
    handleScan(manual.trim())
    setManual('')
  }

  function doLogout() { logout(); nav('/gate/login', { replace: true }) }

  const resultClass = result?.result === 'valid' ? 'valid' : result?.result === 'duplicate' || result?.result === 'used' ? 'duplicate' : 'invalid'

  return (
    <div className="gate-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 480, margin: '0 auto 12px', width: '100%' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-headline)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sb-pink)' }}>Gate · {user?.event_title || 'station'}</div>
          <div style={{ fontWeight: 700 }}>{user?.name}</div>
        </div>
        <button className="btn-ghost btn-sm" style={{ color: '#fff' }} onClick={doLogout}><LogOut size={14} /> End shift</button>
      </div>

      <div className="scan-frame">
        <div id="qr-reader" style={{ width: '100%', height: '100%' }} />
      </div>

      {result && (
        <div className={`gate-result ${resultClass}`}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            {resultClass === 'valid' ? <Check size={36} /> : resultClass === 'duplicate' ? <AlertCircle size={36} /> : <X size={36} />}
          </div>
          <h2 style={{ textTransform: 'uppercase' }}>{result.result}</h2>
          {result.ticket && (
            <>
              <p style={{ fontSize: 18, margin: '4px 0 2px' }}><strong>{result.ticket.attendee_name}</strong></p>
              <p style={{ fontSize: 13, opacity: 0.9 }}>{result.ticket.ticket_type_name}</p>
            </>
          )}
          {result.message && <p style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>{result.message}</p>}
        </div>
      )}

      <form onSubmit={manualSubmit} style={{ maxWidth: 480, margin: '12px auto', width: '100%', display: 'flex', gap: 8 }}>
        <input className="input" placeholder="Or paste QR code manually" value={manual} onChange={(e) => setManual(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary" type="submit">Check</button>
      </form>

      {recent.length > 0 && (
        <>
          <div style={{ maxWidth: 480, margin: '16px auto 6px', width: '100%', fontFamily: 'var(--font-headline)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Recent</div>
          <div className="gate-recent" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
            {recent.map((r) => (
              <span key={r.id} className={`chip ${r.result === 'valid' ? 'valid' : r.result === 'duplicate' || r.result === 'used' ? 'duplicate' : 'invalid'}`}>
                {r.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
