import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Wordmark, SBMonogram, FloralGarland } from '../brand/Ornaments.jsx'
import { useAuth } from '../lib/auth.jsx'
import { Menu, X, LogOut } from 'lucide-react'
import DemoBadge from './DemoBadge.jsx'

export default function Layout({ children, surface = 'blush', hideHeader = false, hideFooter = false }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = React.useState(false)

  function doLogout() {
    logout()
    nav('/')
  }

  return (
    <div className={`sb-screen wash-${surface}`}>
      {!hideHeader && (
        <header className="sb-header">
          <div className="container sb-header-inner">
            <Link to="/" className="sb-brand" aria-label="SheBelieves home">
              <SBMonogram size={36} />
              <Wordmark height={20} />
            </Link>
            <button
              className="sb-burger"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <nav className={`sb-nav ${open ? 'open' : ''}`}>
              <NavLink to="/events" onClick={() => setOpen(false)}>Events</NavLink>
              {user?.role === 'customer' && (
                <>
                  <NavLink to="/my-tickets" onClick={() => setOpen(false)}>My Tickets</NavLink>
                  <NavLink to="/my-orders" onClick={() => setOpen(false)}>Orders</NavLink>
                  <NavLink to="/notifications" onClick={() => setOpen(false)}>Notifications</NavLink>
                </>
              )}
              {user?.role === 'admin' && (
                <NavLink to="/admin" onClick={() => setOpen(false)}>Admin</NavLink>
              )}
              {user?.role === 'organizer' && (
                <NavLink to="/org" onClick={() => setOpen(false)}>Organizer</NavLink>
              )}
              {!user ? (
                <>
                  <NavLink to="/login" onClick={() => setOpen(false)}>Sign in</NavLink>
                  <Link to="/signup" className="btn-primary btn-sm" onClick={() => setOpen(false)}>Join us</Link>
                </>
              ) : (
                <button className="btn-ghost btn-sm" onClick={doLogout}>
                  <LogOut size={14} /> Sign out
                </button>
              )}
            </nav>
          </div>
        </header>
      )}

      <main className="sb-main">{children}</main>

      {!hideFooter && (
        <footer className="sb-footer">
          <div className="container sb-footer-inner">
            <div className="sb-footer-garland">
              <FloralGarland width={220} />
            </div>
            <div className="sb-footer-grid">
              <div>
                <Wordmark height={22} />
                <p className="footer-tag">Prayer Works.</p>
                <p className="footer-fine">A sisterhood gathering across Zimbabwe — for prayer, song, and shared faith.</p>
              </div>
              <div>
                <h4>Gather</h4>
                <Link to="/events">All events</Link>
                <Link to="/signup">Create account</Link>
                <Link to="/login">Sign in</Link>
              </div>
              <div>
                <h4>Help</h4>
                <Link to="/my-orders">Check an order</Link>
                <Link to="/staff/login">Staff sign in</Link>
                <Link to="/gate/login">Gate sign in</Link>
              </div>
            </div>
            <div className="sb-footer-bar">
              <span>© SheBelieves Ministry · Harare · Bulawayo · Mutare</span>
              <span className="sb-footer-script">She believes — and so it is.</span>
            </div>
          </div>
        </footer>
      )}

      <DemoBadge />
    </div>
  )
}
