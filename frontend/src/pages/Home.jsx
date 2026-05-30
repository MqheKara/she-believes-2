import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import EventCard from '../components/EventCard.jsx'
import { CrownMark, Sparkle } from '../brand/Ornaments.jsx'
import { api } from '../lib/api.js'

export default function Home() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/events').then(({ data }) => {
      setEvents((data.events || data || []).slice(0, 6))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <section className="hero wash-blush">
        <div className="container hero-inner stagger">
          <div>
            <div className="eyebrow">Sisterhood · Prayer · Gathering</div>
            <h1>
              Come <span className="script">expectant.</span><br />
              Leave <span className="accent">renewed.</span>
            </h1>
            <p className="hero-sub">
              SheBelieves gathers women across Zimbabwe for prayer, song, and shared faith.
              Find a gathering near you — book your seat, send EcoCash, walk in with your QR.
            </p>
            <div className="hero-cta">
              <Link to="/events" className="btn btn-primary btn-lg">See gatherings</Link>
              <Link to="/signup" className="btn btn-secondary btn-lg">Create account</Link>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-art-inner">
              <CrownMark size={64} color="#fff" />
              <div className="script-flourish" style={{ marginTop: 18 }}>Prayer Works.</div>
              <Sparkle size={22} color="#fff" />
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <SectionHeading
          kicker="Coming up"
          title="Upcoming gatherings"
          sub="Some sisters travel hours to be in the room. Choose yours."
        />
        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : events.length === 0 ? (
          <div className="empty-state"><p>No gatherings are listed just yet — check back soon, sister.</p></div>
        ) : (
          <div className="grid-3 stagger">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link to="/events" className="btn btn-secondary">See all gatherings</Link>
        </div>
      </section>

      <section className="section container">
        <SectionHeading
          kicker="How it works"
          title="Three steps. One seat saved for you."
        />
        <div className="grid-3 stagger" style={{ marginTop: 16 }}>
          <div className="card card-pad">
            <div className="step-num">1.</div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '4px 0 8px' }}>Choose your gathering</h4>
            <p className="soft">Browse upcoming events, pick the seats you want, and add the names of the sisters joining you.</p>
          </div>
          <div className="card card-pad">
            <div className="step-num">2.</div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '4px 0 8px' }}>Send EcoCash</h4>
            <p className="soft">Send your payment via EcoCash to the number we share, then drop a quick WhatsApp with your reference.</p>
          </div>
          <div className="card card-pad">
            <div className="step-num">3.</div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '4px 0 8px' }}>Walk in with your QR</h4>
            <p className="soft">Once approved, your ticket appears in your account. Show the QR at the door and come expectant.</p>
          </div>
        </div>
      </section>
    </Layout>
  )
}
