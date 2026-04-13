// ============================================================================
// SingleDatePicker — 단일 날짜 선택기
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - DateRangePicker 의 단일 날짜 버전. 한 번 클릭해서 날짜 하나만 고른다.
//   - 값은 'YYYY-MM-DD' 문자열로만 입출력한다.
//   - minDate 이전은 비활성. 선택 직후 150ms 뒤 팝업 자동 닫기.
//
// 사용처: SearchBar(티켓/패키지 탭), TicketDetail, PackageDetail.
//
// 주의:
//   - parseDate 는 로컬 타임존으로 복원해 타임존 경계 버그를 피한다.
//   - DateRangePicker 와 날짜 유틸을 의도적으로 중복 유지(작은 피커 단독 재사용).
// ============================================================================

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
    minWidth: 300,
    border: '1px solid #e2e8f0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' },
  navBtn: {
    width: 32, height: 32, borderRadius: '50%',
    border: '1px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#475569', fontFamily: 'inherit',
  },
  dayNamesRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 },
  dayName: { textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', padding: '6px 0', textTransform: 'uppercase' },
  daysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 },
  dayCell: {
    width: '100%', aspectRatio: '1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.85rem', fontWeight: 500, borderRadius: 8,
    cursor: 'pointer', border: 'none', background: 'transparent',
    color: '#1e293b', fontFamily: 'inherit', minHeight: 36, padding: 0,
  },
  daySelected: { background: '#1a73e8', color: '#fff', fontWeight: 700 },
  dayToday: { fontWeight: 800, color: '#3b82f6' },
  dayDisabled: { color: '#cbd5e1', cursor: 'default' },
  clearBtn: {
    display: 'block', width: '100%', marginTop: 12, padding: '8px',
    border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
    color: '#64748b', fontSize: '0.8rem', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
  },
}

/**
 * 단일 날짜 피커(Controlled).
 *
 * @param {object} props
 * @param {string} props.value       - 'YYYY-MM-DD' 선택된 날짜
 * @param {Function} props.onChange  - 새 값을 받아가는 콜백
 * @param {string} [props.placeholder]
 * @param {string} [props.minDate]   - 선택 가능한 최소일. 기본 오늘.
 *
 * 부작용: 선택 직후 setTimeout 으로 팝업 자동 닫기, onChange 호출.
 */
export default function SingleDatePicker({ value, onChange, placeholder, minDate }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? parseDate(value) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minD = minDate ? parseDate(minDate) : today
  const selected = parseDate(value)

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
    onChange(formatDate(date))
    setTimeout(() => setOpen(false), 150)
  }

  const prevMonth = () => {
    setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  const nextMonth = () => {
    setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  const formatDisplayDate = (str) => {
    if (!str) return ''
    const d = parseDate(str)
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`
  }

  return (
    <div style={styles.wrapper}>
      <button
        type="button"
        style={{ ...styles.display, ...(open ? styles.displayActive : {}) }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ color: value ? '#1e293b' : '#94a3b8' }}>
          {value ? formatDisplayDate(value) : (placeholder || 'Select date')}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{'\u{1F4C5}'}</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={styles.dropdown}>
            <div style={styles.header}>
              <button type="button" style={styles.navBtn} onClick={prevMonth}>{'\u2039'}</button>
              <span style={styles.monthTitle}>{MONTH_NAMES[viewMonth.month]} {viewMonth.year}</span>
              <button type="button" style={styles.navBtn} onClick={nextMonth}>{'\u203A'}</button>
            </div>
            <div style={styles.dayNamesRow}>
              {DAY_NAMES.map(d => <div key={d} style={styles.dayName}>{d}</div>)}
            </div>
            <div style={styles.daysGrid}>
              {calendarDays.map((date, i) => {
                const isSelected = date && selected && isSameDay(date, selected)
                const isToday = date && isSameDay(date, today)
                const disabled = !date || date < minD
                return (
                  <button
                    key={i}
                    type="button"
                    style={{
                      ...styles.dayCell,
                      ...(disabled ? styles.dayDisabled : {}),
                      ...(isSelected ? styles.daySelected : {}),
                      ...(!isSelected && isToday ? styles.dayToday : {}),
                    }}
                    onClick={() => handleDayClick(date)}
                    disabled={disabled}
                  >
                    {date ? date.getDate() : ''}
                  </button>
                )
              })}
            </div>
            <button type="button" style={styles.clearBtn} onClick={() => { onChange(''); setOpen(false) }}>
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  )
}
