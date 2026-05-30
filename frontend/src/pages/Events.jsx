import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import EventCard from '../components/EventCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { api } from '../lib/api.js'

const CATS = ['All', 'Church', 'Music', 'Arts', 'Festival', 'Other']

export default function Events() {
  const [events, setEvents] = useState([])
  const [cat, setCat] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = cat === 'All' ? {} : { category: cat }
    api.get('/events', { params }).then(({ data }) => {
      setEvents(data.events || data || [])
    }).catch(() => setEvents([])).finally(() => setLoading(false))
  }, [cat])

  return (
    <Layout>
      <section className="section container">
        <SectionHeading
          kicker="All gatherings"
          title="Find your seat"
          sub="Filter by what calls you — prayer night, music ministry, art evening, or a full weekend festival."
        />

        <div className="filter-strip" role="tablist">
          {CATS.map((c) => (
            <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        {loading ? (
          <div className="center-spinner"><span className="spinner" /></div>
        ) : events.length === 0 ? (
          <EmptyState
            title="No gatherings in this category yet"
            body="Try another category, or check back soon — new gatherings are added often."
          />
        ) : (
          <div className="grid-3 stagger">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>
    </Layout>
  )
}
