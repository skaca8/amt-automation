// ============================================================================
// Profile — 내 프로필 페이지 (/profile)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - AuthContext 의 user 를 사이드바에 보여 주고(이름/이메일/이니셜 아바타)
//     총 예약 건수 통계를 /bookings/my 응답 길이로 계산해 표시한다.
//   - 이름/전화/국적 수정(AuthContext.updateProfile → PUT /auth/me).
//     이메일은 읽기 전용.
//   - 언어 선호(en/cn) 변경 → i18n.changeLanguage + localStorage 영속화.
//   - 최근 예약 3건을 요약 리스트로 보여 주고 클릭 시 상세 이동.
//
// 렌더 위치: /profile. lazy-loaded. 로그인 필수(비로그인은 로그인 유도 박스).
//
// 주의:
//   - /bookings/my 응답의 예약 행은 snake_case(booking_number, created_at,
//     status, total_price).
//   - updateProfile 엔드포인트는 PUT /auth/me 이다(과거 /auth/profile 404 버그 해결).
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { get } from '../utils/api'

const styles = {
  page: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 32px) 20px 60px',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '32px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '32px',
    alignItems: 'start',
  },
  sidebar: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '28px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    textAlign: 'center',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--white)',
  },
  userName: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  userEmail: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '20px',
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    padding: '16px 0',
    borderTop: '1px solid var(--border-light)',
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--primary)',
  },
  statLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  mainContent: {},
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '28px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-light)',
  },
  formGroup: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  saveBtn: {
    padding: '10px 24px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary)',
    color: 'var(--white)',
    fontWeight: 600,
    fontSize: '0.9rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  cancelBtn: {
    padding: '10px 24px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '0.9rem',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  successMsg: {
    color: 'var(--success)',
    fontSize: '0.85rem',
    padding: '10px 14px',
    background: 'var(--success-bg)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px',
    textAlign: 'center',
  },
  errorMsg: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    padding: '10px 14px',
    background: 'var(--error-bg)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px',
    textAlign: 'center',
  },
  langSelect: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    transition: 'var(--transition)',
    appearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234a4a6a' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '36px',
  },
  bookingSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  bookingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  bookingItemLeft: {},
  bookingItemName: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  bookingItemDate: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  bookingItemPrice: {
    fontWeight: 600,
    color: 'var(--accent)',
    fontSize: '0.9rem',
  },
}

/**
 * 프로필 페이지.
 *
 * 내부 state:
 *   - editing        : 인라인 편집 모드 on/off
 *   - form           : 편집 중 스냅샷(이름/전화/국적)
 *   - saving         : PUT 진행 중
 *   - success/error  : 저장 결과 배너
 *   - recentBookings : 최근 예약 3건(요약용)
 *   - bookingCount   : 통계 카드 숫자
 *
 * 부작용:
 *   - user 가 채워지면 form 동기화
 *   - 로그인 상태에서 /bookings/my GET 으로 리스트/카운트 로드
 *   - "저장" 시 AuthContext.updateProfile 호출
 *   - 언어 select 변경 시 i18n.changeLanguage + localStorage 저장
 */
export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, isAuthenticated, loading: authLoading, updateProfile } = useAuth()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    nationality: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [recentBookings, setRecentBookings] = useState([])
  const [bookingCount, setBookingCount] = useState(0)

  // user 객체가 갱신되면(로그인 직후, 저장 직후) 폼 스냅샷을 맞춘다.
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        nationality: user.nationality || '',
      })
    }
  }, [user])

  // 로그인 사용자의 예약 목록을 한 번 가져와 통계/최근 3건을 계산.
  useEffect(() => {
    if (!isAuthenticated) return
    const fetchBookings = async () => {
      try {
        const data = await get('/bookings/my')
        const bookings = data.bookings || data.data || data || []
        setBookingCount(bookings.length)
        setRecentBookings(bookings.slice(0, 3))
      } catch (err) {
        console.error('Failed to fetch bookings:', err)
      }
    }
    fetchBookings()
  }, [isAuthenticated])

  const handleInput = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  // 저장 버튼 핸들러. PUT /auth/me 성공 시 3초간 성공 배너를 띄운다.
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await updateProfile(form)
      setSuccess(true)
      setEditing(false)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // 언어 선택 select 핸들러. Header 의 토글과 동일한 정책으로 동작.
  const handleLangChange = (e) => {
    const lang = e.target.value
    i18n.changeLanguage(lang)
    localStorage.setItem('language', lang)
  }

  if (authLoading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (!isAuthenticated) {
    return (
      <div style={styles.page}>
        <div className="empty-state">
          <div className="empty-state-icon">&#128100;</div>
          <p className="empty-state-title">{t('auth.loginRequired')}</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '16px' }}>
            {t('auth.loginBtn')}
          </Link>
        </div>
      </div>
    )
  }

  const inputProps = {
    onFocus: e => { e.target.style.borderColor = 'var(--primary)' },
    onBlur: e => { e.target.style.borderColor = 'var(--border)' },
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>{t('profile.title')}</h1>

      <div style={styles.layout} className="profile-layout">
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.avatar}>
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={styles.userName}>{user?.name || 'User'}</div>
          <div style={styles.userEmail}>{user?.email || ''}</div>
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{bookingCount}</div>
              <div style={styles.statLabel}>{t('profile.totalBookings')}</div>
            </div>
          </div>
          {user?.createdAt && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              {t('profile.memberSince')}: {new Date(user.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div style={styles.mainContent}>
          {/* Personal Info */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>{t('profile.personalInfo')}</h2>

            {success && <div style={styles.successMsg}>{t('profile.updateSuccess')}</div>}
            {error && <div style={styles.errorMsg}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('auth.name')}</label>
              <input
                type="text"
                style={{ ...styles.input, ...(editing ? {} : { background: 'var(--bg)', cursor: 'default' }) }}
                value={form.name}
                onChange={handleInput('name')}
                readOnly={!editing}
                {...(editing ? inputProps : {})}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('auth.email')}</label>
              <input
                type="email"
                style={{ ...styles.input, background: 'var(--bg)', cursor: 'default' }}
                value={user?.email || ''}
                readOnly
              />
            </div>

            <div style={styles.row} className="profile-form-row">
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('auth.phone')}</label>
                <input
                  type="tel"
                  style={{ ...styles.input, ...(editing ? {} : { background: 'var(--bg)', cursor: 'default' }) }}
                  value={form.phone}
                  onChange={handleInput('phone')}
                  readOnly={!editing}
                  {...(editing ? inputProps : {})}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('auth.nationality')}</label>
                <input
                  type="text"
                  style={{ ...styles.input, ...(editing ? {} : { background: 'var(--bg)', cursor: 'default' }) }}
                  value={form.nationality}
                  onChange={handleInput('nationality')}
                  readOnly={!editing}
                  {...(editing ? inputProps : {})}
                />
              </div>
            </div>

            <div style={styles.formActions}>
              {editing ? (
                <>
                  <button
                    style={styles.cancelBtn}
                    onClick={() => {
                      setEditing(false)
                      setForm({
                        name: user?.name || '',
                        phone: user?.phone || '',
                        nationality: user?.nationality || '',
                      })
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = 'var(--text-secondary)' }}
                    onMouseLeave={e => { e.target.style.borderColor = 'var(--border)' }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    style={{
                      ...styles.saveBtn,
                      ...(saving ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                    }}
                    onClick={handleSave}
                    disabled={saving}
                    onMouseEnter={e => { if (!saving) { e.target.style.background = 'var(--primary-dark)' } }}
                    onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
                  >
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </>
              ) : (
                <button
                  style={styles.saveBtn}
                  onClick={() => setEditing(true)}
                  onMouseEnter={e => { e.target.style.background = 'var(--primary-dark)' }}
                  onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
                >
                  {t('profile.editProfile')}
                </button>
              )}
            </div>
          </div>

          {/* Language Preference */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>{t('profile.preferences')}</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('profile.languagePref')}</label>
              <select
                style={styles.langSelect}
                value={i18n.language}
                onChange={handleLangChange}
              >
                <option value="en">English</option>
                <option value="cn">中文 (Chinese)</option>
              </select>
            </div>
          </div>

          {/* Booking History */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {t('profile.bookingHistory')}
              </h2>
              <Link to="/my-bookings" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
                {t('home.viewAll')} &rarr;
              </Link>
            </div>

            {recentBookings.length > 0 ? (
              <div style={styles.bookingSummary}>
                {recentBookings.map(b => {
                  // /bookings/my 는 raw booking row 를 그대로 돌려 주므로
                  // 여기서 읽는 모든 키(booking_number, total_price,
                  // created_at, status)는 snake_case 다.
                  const bid = b.id
                  return (
                    <div
                      key={bid}
                      style={styles.bookingItem}
                      onClick={() => navigate(`/my-bookings/${bid}`)}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eef2f7' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)' }}
                    >
                      <div style={styles.bookingItemLeft}>
                        <div style={styles.bookingItemName}>
                          {b.booking_number || `#${bid}`}
                        </div>
                        <div style={styles.bookingItemDate}>
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}
                          {' - '}
                          <span className={`badge badge-${b.status || 'pending'}`} style={{ display: 'inline', padding: '2px 8px', fontSize: '0.65rem' }}>
                            {t(`statuses.${b.status || 'pending'}`)}
                          </span>
                        </div>
                      </div>
                      <div style={styles.bookingItemPrice}>
                        {t('common.currency')} {Number(b.total_price || 0).toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                {t('myBookings.noBookings')}
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .profile-layout { grid-template-columns: 1fr !important; }
          .profile-form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
