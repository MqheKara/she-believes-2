import React from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { FloralGarland } from '../brand/Ornaments.jsx'

export default function NotFound() {
  return (
    <Layout>
      <div className="container section" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--sb-pink-300)', marginBottom: 12 }}>
          <FloralGarland width={280} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 64, margin: '0 0 4px', color: 'var(--sb-pink)' }}>404</h1>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: '0 0 12px' }}>This way doesn't lead anywhere yet</h2>
        <p className="soft" style={{ maxWidth: 460, margin: '0 auto 24px' }}>The page you're looking for doesn't exist or has moved. Let's get you back to the gatherings.</p>
        <Link to="/" className="btn btn-primary">Take me home</Link>
      </div>
    </Layout>
  )
}
