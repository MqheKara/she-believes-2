import React from 'react'
import { FloralGarland } from '../brand/Ornaments.jsx'

export default function EmptyState({ title, body, children }) {
  return (
    <div className="empty-state">
      <FloralGarland width={260} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {children}
    </div>
  )
}
