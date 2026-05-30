import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) {
    // route to correct login surface
    if (roles?.includes('admin') || roles?.includes('organizer')) {
      return <Navigate to="/staff/login" state={{ from: loc.pathname }} replace />
    }
    if (roles?.includes('gate_staff')) {
      return <Navigate to="/gate/login" state={{ from: loc.pathname }} replace />
    }
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
