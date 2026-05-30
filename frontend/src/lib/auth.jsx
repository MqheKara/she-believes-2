import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, getStoredUser, setStoredUser } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser())
  const [loading, setLoading] = useState(false)

  // Verify token on mount for customer (admin/organizer/gate users keep stored copy)
  useEffect(() => {
    const t = getToken()
    const u = getStoredUser()
    if (t && u && u.role === 'customer') {
      setLoading(true)
      api.get('/auth/me').then(({ data }) => {
        const fresh = { ...data, role: 'customer' }
        setStoredUser(fresh); setUser(fresh)
      }).catch(() => {
        setToken(null); setStoredUser(null); setUser(null)
      }).finally(() => setLoading(false))
    }
  }, [])

  function login({ token, user }) {
    setToken(token); setStoredUser(user); setUser(user)
  }
  function logout() {
    setToken(null); setStoredUser(null); setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
