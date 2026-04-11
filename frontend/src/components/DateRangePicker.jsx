import React, { useState, useMemo } from 'react'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isInRange(date, start, end) {
  if (!start || !end) return false
  return date >= start && date <= end
}

const styles = {
  wrapper: { position: 'relative', display: 'inline-block', width: '100%' },
  display: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border, #e2e8f0)',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: 'var(--text-primary, #1e293b)',
    background: 'var(--bg, #f5f7fa)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  displayActive: {
    borderColor: 'var(--primary, #1a73e8)',
    boxShadow: '0 0 0 3px rgba(26,115,232,0.1)',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 999,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 12px 36px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
    padding: '20px',
    minWidth: 320,
    border: '1px solid #e2e8f0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  dayNamesRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 0,
    marginBottom: 4,
  },
  dayName: {
    textAlign: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#94a3b8',
    padding: '6px 0',
    textTransform: 'uppercase',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
  },
  dayCell: {
    width: '100%',
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 500,
    borderRadius: 8,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: '#1e293b',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
    padding: 0,
    minHeight: 36,
  },
  dayDisabled: {
    color: '#cbd5e1',
    cursor: 'default',
  },
  dayToday: {
    fontWeight: 800,
    color: '#3b82f6',
  },
  dayStart: {
    background: '#1a73e8',
    color: '#fff',
    fontWeight: 700,
    borderRadius: '8px 0 0 8px',
  },
  dayEnd: {
    background: '#1a73e8',
    color: '#fff',
    fontWeight: 700,
    borderRadius: '0 8px 8px 0',
  },
  dayStartEnd: {
    background: '#1a73e8',
    color: '#fff',
    fontWeight: 700,
    borderRadius: 8,
  },
  dayInRange: {
    background: '#dbeafe',
    color: '#1e40af',
    borderRadius: 0,
  },
  dayHover: {
    background: '#eff6ff',
  },
  legend: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #f1f5f9',
    fontSize: '0.8rem',
    color: '#64748b',
  },
  legendItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  legendLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  legendValue: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#1e293b',
  },
  clearBtn: {
    display: 'block',
    width: '100%',
    marginTop: 12,
    padding: '8px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    color: '#64748b',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
  },
}

export default function DateRangePicker({ checkIn, checkOut, onChange, placeholder, minDate }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = checkIn ? parseDate(checkIn) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [hoverDate, setHoverDate] = useState(null)
  const [selectingEnd, setSelectingEnd] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minD = minDate ? parseDate(minDate) : today

  const startDate = parseDate(checkIn)
  const endDate = parseDate(checkOut)

  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d))
    return days
  }, [viewMonth])

  const handleDayClick = (date) => {
    if (!date || date < minD) return

    if (!selectingEnd || !startDate) {
      onChange(formatDate(date), '')
      setSelectingEnd(true)
      setHoverDate(null)
    } else {
      if (date <= startDate) {
        onChange(formatDate(date), '')
        setSelectingEnd(true)
      } else {
        onChange(checkIn, formatDate(date))
        setSelectingEnd(false)
        setTimeout(() => setOpen(false), 200)
      }
    }
  }

  const handleDayHover = (date) => {
    if (selectingEnd && startDate && date && date > startDate) {
      setHoverDate(date)
    }
  }

  const getDayStyle = (date) => {
    if (!date) return {}
    if (date < minD) return styles.dayDisabled

    const isStart = startDate && isSameDay(date, startDate)
    const isEnd = endDate && isSameDay(date, endDate)
    const isToday = isSameDay(date, today)

    if (isStart && isEnd) return styles.dayStartEnd
    if (isStart) return styles.dayStart
    if (isEnd) return styles.dayEnd

    if (startDate && endDate && isInRange(date, startDate, endDate)) return styles.dayInRange
    if (selectingEnd && startDate && hoverDate && isInRange(date, startDate, hoverDate) && !isStart) {
      return { ...styles.dayInRange, background: '#eff6ff' }
    }
    if (isToday) return styles.dayToday

    return {}
  }

  const prevMonth = () => {
    setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  const nextMonth = () => {
    setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  const formatDisplayDate = (str) => {
    if (!str) return '--'
    const d = parseDate(str)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const nightCount = startDate && endDate ? Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div style={styles.wrapper}>
      <button
        type="button"
        style={{ ...styles.display, ...(open ? styles.displayActive : {}) }}
        onClick={() => setOpen(!open)}
      >
        <span>
          {checkIn && checkOut
            ? `${formatDisplayDate(checkIn)} → ${formatDisplayDate(checkOut)} (${nightCount} night${nightCount !== 1 ? 's' : ''})`
            : checkIn
              ? `${formatDisplayDate(checkIn)} → Select check-out`
              : placeholder || 'Select dates'
          }
        </span>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{'\u{1F4C5}'}</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => { setOpen(false); setSelectingEnd(false) }} />
          <div style={styles.dropdown}>
            <div style={styles.header}>
              <button type="button" style={styles.navBtn} onClick={prevMonth}
                onMouseEnter={e => { e.target.style.background = '#f1f5f9' }}
                onMouseLeave={e => { e.target.style.background = '#fff' }}
              >{'\u2039'}</button>
              <span style={styles.monthTitle}>
                {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
              </span>
              <button type="button" style={styles.navBtn} onClick={nextMonth}
                onMouseEnter={e => { e.target.style.background = '#f1f5f9' }}
                onMouseLeave={e => { e.target.style.background = '#fff' }}
              >{'\u203A'}</button>
            </div>

            <div style={styles.dayNamesRow}>
              {DAY_NAMES.map(d => <div key={d} style={styles.dayName}>{d}</div>)}
            </div>

            <div style={styles.daysGrid}>
              {calendarDays.map((date, i) => (
                <button
                  key={i}
                  type="button"
                  style={{ ...styles.dayCell, ...getDayStyle(date) }}
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => handleDayHover(date)}
                  disabled={!date || date < minD}
                >
                  {date ? date.getDate() : ''}
                </button>
              ))}
            </div>

            <div style={styles.legend}>
              <div style={styles.legendItem}>
                <span style={styles.legendLabel}>Check-in</span>
                <span style={styles.legendValue}>{formatDisplayDate(checkIn)}</span>
              </div>
              <div style={styles.legendItem}>
                <span style={styles.legendLabel}>Check-out</span>
                <span style={styles.legendValue}>{formatDisplayDate(checkOut)}</span>
              </div>
              {nightCount > 0 && (
                <div style={styles.legendItem}>
                  <span style={styles.legendLabel}>Nights</span>
                  <span style={styles.legendValue}>{nightCount}</span>
                </div>
              )}
            </div>

            <button type="button" style={styles.clearBtn} onClick={() => {
              onChange('', '')
              setSelectingEnd(false)
              setHoverDate(null)
            }}>
              Clear Dates
            </button>
          </div>
        </>
      )}
    </div>
  )
}
