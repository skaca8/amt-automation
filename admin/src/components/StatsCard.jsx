// ============================================================================
// Admin — 대시보드 통계 카드 StatsCard
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 단일 KPI(예: "총 예약 수", "이번 달 매출")를 보여 주는 카드 타일.
//   2) 좌측에 색상 배경을 가진 아이콘 박스, 우측에 제목/값/증감률을 표시.
//
// Props:
//   - title   : 카드 상단의 라벨 텍스트 ("TOTAL BOOKINGS" 등).
//   - value   : 본문에 크게 표시할 값 (문자열/숫자 모두 가능).
//   - change  : (선택) 증감률(%). '-' 로 시작하면 감소로 판단해 빨간색.
//   - icon    : 아이콘(이모지 또는 ReactNode).
//   - color   : colorMap 키 중 하나. 배경/포인트 색상을 결정. 기본 'blue'.
//
// 사용처: Dashboard.jsx 상단의 요약 타일 그리드.
// ============================================================================

import React from 'react'

// 카드 색상 테마 맵. 새로운 색이 필요하면 여기에 추가한 뒤 color prop 으로 지정.
const colorMap = {
  blue: { bg: '#dbeafe', icon: '#3b82f6' },
  green: { bg: '#dcfce7', icon: '#22c55e' },
  amber: { bg: '#fef3c7', icon: '#f59e0b' },
  red: { bg: '#fee2e2', icon: '#ef4444' },
  purple: { bg: '#f3e8ff', icon: '#a855f7' },
  cyan: { bg: '#cffafe', icon: '#06b6d4' },
}

const styles = {
  card: {
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    padding: 20,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    border: '1px solid #f1f5f9',
    transition: 'all 0.2s ease',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  value: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1e293b',
    lineHeight: 1.2,
  },
  change: {
    fontSize: '0.8rem',
    fontWeight: 600,
    marginTop: 4,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
}

/**
 * StatsCard — 대시보드 KPI 카드.
 *
 * 부작용: 없음. 순수 presentational. change 가 음수이면 빨간색 하향 화살표를,
 * 그 외에는 초록색 상향 화살표를 표시한다.
 */
export default function StatsCard({ title, value, change, icon, color = 'blue' }) {
  const colors = colorMap[color] || colorMap.blue
  const isPositive = change && !String(change).startsWith('-')

  return (
    <div style={styles.card}>
      <div style={{ ...styles.iconWrap, background: colors.bg }}>
        <span>{icon}</span>
      </div>
      <div style={styles.content}>
        <div style={styles.title}>{title}</div>
        <div style={styles.value}>{value}</div>
        {change != null && (
          <div
            style={{
              ...styles.change,
              color: isPositive ? '#22c55e' : '#ef4444',
            }}
          >
            {isPositive ? '\u25B2' : '\u25BC'} {String(change).replace(/^-/, '')}%
          </div>
        )}
      </div>
    </div>
  )
}
