import React, { createContext, useContext, useCallback, useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'

const ToastCtx = createContext(null)

let counter = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((message, kind = 'info', ms = 3800) => {
    const id = ++counter
    setItems((prev) => [...prev, { id, message, kind }])
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id))
    }, ms)
  }, [])

  const ctx = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div
        style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 10,
          pointerEvents: 'none', maxWidth: 'calc(100vw - 48px)',
        }}
      >
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' && <Check size={18} strokeWidth={1.75} />}
            {t.kind === 'error' && <X size={18} strokeWidth={1.75} />}
            {t.kind === 'info' && <AlertCircle size={18} strokeWidth={1.75} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
