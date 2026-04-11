import React from 'react'

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
