import React from 'react'
import { Link } from 'react-router-dom'
import { datestampParts } from '../lib/format.js'
import { mediaUrl } from '../lib/api.js'
import { MapPin } from 'lucide-react'

export default function EventCard({ event }) {
  const { day, month, time } = datestampParts(event.start_at)
  const altar = event.category === 'Festival' || event.category === 'Music'
  return (
    <Link to={`/events/${event.id}`} className={`card event-card ${altar ? 'altar' : ''}`}>
      <div className="event-card-poster" style={{ backgroundImage: event.poster_url ? `url(${mediaUrl(event.poster_url)})` : undefined }}>
        {!event.poster_url && <div className="poster-placeholder">{event.title?.[0] || 'S'}</div>}
        <div className="datestamp">
          <span className="ds-day">{day}</span>
          <span className="ds-month">{month}</span>
          <span className="ds-time">{time}</span>
        </div>
        <span className={`pill pill-${(event.category || 'other').toLowerCase()}`}>{event.category}</span>
      </div>
      <div className="event-card-body">
        <h3>{event.title}</h3>
        <p className="event-card-venue"><MapPin size={14} strokeWidth={1.75} /> {event.venue_name}, {event.city}</p>
        <p className="event-card-tag">{event.tagline}</p>
      </div>
    </Link>
  )
}
