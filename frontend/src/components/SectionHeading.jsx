import React from 'react'
import { FloralGarland } from '../brand/Ornaments.jsx'

export default function SectionHeading({ kicker, title, sub, center = true }) {
  return (
    <div className={`section-heading ${center ? 'center' : ''}`}>
      {kicker && <div className="section-kicker">{kicker}</div>}
      <div className="section-garland">
        <FloralGarland width={180} />
      </div>
      <h2>{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  )
}
