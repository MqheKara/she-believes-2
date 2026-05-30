// Money in USD as "$12.50"
export function money(usd) {
  const n = Number(usd ?? 0)
  return `$${n.toFixed(2)}`
}

const FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Harare',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const FMT_SHORT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Harare',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const FMT_DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Harare',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function safeDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function fmtDateTime(iso) {
  const d = safeDate(iso)
  if (!d) return '—'
  return FMT.format(d)
}
export function fmtShort(iso) {
  const d = safeDate(iso)
  if (!d) return '—'
  return FMT_SHORT.format(d)
}
export function fmtDay(iso) {
  const d = safeDate(iso)
  if (!d) return '—'
  return FMT_DAY.format(d)
}

// "DD/MMM" and "HH:mm" parts for the datestamp component
export function datestampParts(iso) {
  const d = safeDate(iso)
  if (!d) return { day: '--', month: '---', time: '--:--' }
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Harare', day: '2-digit',
  }).format(d)
  const month = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Harare', month: 'short',
  }).format(d).toUpperCase()
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return { day, month, time }
}

// Countdown to ISO date — returns "3d 14h" or "2h 14m" or "Now" or "Past"
export function countdown(iso) {
  const d = safeDate(iso)
  if (!d) return '—'
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return 'Started'
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// Strip payment reference prefix for display
export function paymentDisplay(ref) {
  if (!ref) return ''
  if (ref === 'COMP') return 'Comp'
  if (ref === 'WALKIN:CASH') return 'Cash (walk-in)'
  if (ref === 'ECOCASH-MANUAL') return 'EcoCash (approved)'
  if (ref.startsWith('ECOCASH-MANUAL:')) return `EcoCash — ${ref.slice('ECOCASH-MANUAL:'.length)}`
  if (ref.startsWith('WALKIN:')) return `Walk-in — ${ref.slice('WALKIN:'.length)}`
  if (ref.startsWith('INTENT:')) return 'Awaiting payment'
  return ref
}
