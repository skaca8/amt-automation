// ============================================================================
// DateRangePicker — 체크인/체크아웃 범위 달력 피커
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 버튼을 누르면 팝업 달력을 열어, 두 번 클릭(시작일→종료일)으로 날짜
//     범위를 고른다. 외부로는 'YYYY-MM-DD' 문자열 두 개(checkIn/checkOut)만
//     공개한다.
//   - minDate 이전 날짜는 회색 처리 + disabled.
//   - 범위 선택 중에는 hover 위치까지 연한 색으로 "미리보기" 한다.
//   - 드롭다운 바깥을 클릭하거나 종료일을 찍으면 자동으로 닫힌다.
//
// 사용처: SearchBar(호텔 탭), HotelDetail 등.
//
// 주의:
//   - 내부 state 는 Date 객체로 다루지만 부모에는 반드시 'YYYY-MM-DD'
//     문자열로만 넘긴다(JSON 직렬화 용이 + 타임존 이슈 회피).
//   - parseDate 는 로컬 타임존으로 복원한다. new Date('YYYY-MM-DD') 를
//     그대로 쓰면 UTC 로 파싱돼 하루가 어긋나는 버그가 나니 유의.
// ============================================================================

import React, { useState, useMemo } from 'react'

// 달력 헤더에 쓸 영어 월 이름. (i18n 대상은 아니고 피커 내부 전용.)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
// 일~토 요일 헤더.
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Date → 'YYYY-MM-DD' 문자열. 외부 계약 형식. */
function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 'YYYY-MM-DD' → 로컬 Date.
 * new Date('YYYY-MM-DD') 가 아니라 숫자 분해로 만들어 UTC 해석을 피한다.
 */
function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 두 Date 가 같은 날(연/월/일 동일) 인지. */
function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** date 가 [start, end] 구간에 포함되는지(경계 포함). */
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

/**
 * 날짜 범위 피커(Controlled Component).
 *
 * @param {object} props
 * @param {string} props.checkIn      - 'YYYY-MM-DD' 시작일 (부모 state)
 * @param {string} props.checkOut     - 'YYYY-MM-DD' 종료일 (부모 state)
 * @param {Function} props.onChange   - (checkIn, checkOut) 를 부모로 전달
 * @param {string} [props.placeholder]- 아무것도 안 골랐을 때 표시할 문구
 * @param {string} [props.minDate]    - 선택 가능한 최소일. 기본 오늘.
 *
 * UI 요약:
 *   - 트리거 버튼 + 팝업 달력(한 달 단위 스크롤) + 하단 summary/Clear 버튼.
 *
 * 부작용:
 *   - onChange 콜백 호출, 200ms 지연 후 팝업 자동 닫기.
 *   - 바깥 클릭 capture 를 위한 fixed full-screen overlay.
 */
export default function DateRangePicker({ checkIn, checkOut, onChange, placeholder, minDate }) {
  // 달력 팝업 열림 여부.
  const [open, setOpen] = useState(false)
  // 현재 화면에 보이는 연/월. 초기값은 기존 checkIn 이 있으면 그 월, 없으면 오늘.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = checkIn ? parseDate(checkIn) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  // 범위 선택 중 hover 한 날짜. 미리보기 색칠용.
  const [hoverDate, setHoverDate] = useState(null)
  // true 면 "이제 종료일을 고르는 중". 첫 클릭 이후 토글된다.
  const [selectingEnd, setSelectingEnd] = useState(false)

  // 오늘 날짜(시간은 0으로 잘라내서 같은 날 비교에 방해되지 않게).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // 선택 가능한 최소일. minDate prop 이 없으면 오늘.
  const minD = minDate ? parseDate(minDate) : today

  const startDate = parseDate(checkIn)
  const endDate = parseDate(checkOut)

  // 현재 월의 달력 그리드 배열. 첫 주 공백은 null 로 채운다.
  // viewMonth 가 바뀔 때만 재계산.
  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    // 첫 주 앞쪽의 빈 칸(이전 달 자리)을 null 로 채운다.
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d))
    return days
  }, [viewMonth])

  /**
   * 날짜 클릭 핸들러.
   * 1) 아무것도 안 골랐거나 지금 시작일을 고르는 중이면: 시작일만 세팅.
   * 2) 시작일 이후인 날짜가 찍히면: 종료일로 세팅하고 200ms 뒤 팝업 닫기.
   * 3) 시작일과 같거나 더 이른 날을 찍으면: 시작일을 새로 세팅(범위 리셋).
   */
  const handleDayClick = (date) => {
    // 비활성 칸 또는 minDate 미만은 무시.
    if (!date || date < minD) return

    if (!selectingEnd || !startDate) {
      onChange(formatDate(date), '')
      setSelectingEnd(true)
      setHoverDate(null)
    } else {
      if (date <= startDate) {
        // 역주행 클릭 → 시작일을 새로 잡는다.
        onChange(formatDate(date), '')
        setSelectingEnd(true)
      } else {
        onChange(checkIn, formatDate(date))
        setSelectingEnd(false)
        // 종료일 확정 피드백을 주기 위해 200ms 뒤 닫는다.
        setTimeout(() => setOpen(false), 200)
      }
    }
  }

  // 종료일을 고르는 중에만 미리보기 색을 칠한다.
  const handleDayHover = (date) => {
    if (selectingEnd && startDate && date && date > startDate) {
      setHoverDate(date)
    }
  }

  // 날짜 셀별 스타일을 합성한다. 시작/종료/범위내/오늘/비활성 순으로 분기.
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

  // 선택된 범위가 몇 박인지. (end - start) ms 를 일로 환산.
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
