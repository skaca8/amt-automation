// ============================================================================
// Admin — 설정 페이지 Settings
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 관리자 본인 프로필(이름/이메일/역할/전화) 표시 (읽기 전용).
//   2) 비밀번호 변경 폼 (현재 API 는 미구현, 제출 시 안내 메시지만 표시).
//   3) 플랫폼 전역 설정(플랫폼명/언어/통화/타임존) - 현재 전부 disabled.
//   4) 알림 토글 UI - 현재 disabled (읽기 전용 프리뷰).
//
// 렌더링 위치: /settings 라우트. 사이드바 맨 아래 메뉴.
//
// 주의:
//   - 실제 저장 로직이 백엔드에 아직 없어 대부분 UI 가 disabled 이거나
//     TODO 주석만 달려 있다. 추후 API 가 생기면 handlePasswordChange 안의
//     TODO 부분을 실제 호출로 교체하면 된다.
// ============================================================================

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Settings — 관리자 본인 계정/시스템 설정 페이지.
 *
 * 부작용: 현재 없음. 추후 API 연결 시 /api/admin/profile 등을 호출하게 될 것.
 */
export default function Settings() {
  const { user } = useAuth()
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })

  const handlePasswordChange = (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    // TODO: Implement password change API call
    setPasswordMessage({ type: 'success', text: 'Password change functionality will be available soon.' })
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your account and platform settings</p>
        </div>
      </div>

      <div className="detail-grid">
        {/* Admin Profile */}
        <div className="card">
          <div className="card-header">
            <h3>Admin Profile</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '1.5rem',
                flexShrink: 0,
              }}
            >
              {user?.name
                ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user?.name || 'Admin'}</div>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{user?.email || '-'}</div>
              <div style={{ marginTop: 4 }}>
                <span className="badge badge-active">Administrator</span>
              </div>
            </div>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Full Name</span>
              <span className="value">{user?.name || '-'}</span>
            </div>
            <div className="info-item">
              <span className="label">Email</span>
              <span className="value">{user?.email || '-'}</span>
            </div>
            <div className="info-item">
              <span className="label">Role</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>{user?.role || 'admin'}</span>
            </div>
            <div className="info-item">
              <span className="label">Phone</span>
              <span className="value">{user?.phone || '-'}</span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="card-header">
            <h3>Change Password</h3>
          </div>

          {passwordMessage.text && (
            <div className={`alert alert-${passwordMessage.type}`} style={{ marginBottom: 16 }}>
              {passwordMessage.text}
            </div>
          )}

          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                className="form-control"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                placeholder="Enter current password"
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                className="form-control"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                placeholder="Confirm new password"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Update Password
            </button>
          </form>
        </div>
      </div>

      {/* General Settings */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>General Settings</h3>
        </div>
        <div className="info-grid">
          <div className="form-group">
            <label>Platform Name</label>
            <input
              className="form-control"
              defaultValue="High1 Resort"
              disabled
            />
            <div className="form-error" style={{ color: '#64748b', marginTop: 4 }}>
              {/* TODO: Implement general settings */}
              Contact system administrator to modify platform settings.
            </div>
          </div>
          <div className="form-group">
            <label>Default Language</label>
            <select className="form-control" defaultValue="en" disabled>
              <option value="en">English</option>
              <option value="cn">Chinese</option>
              <option value="ko">Korean</option>
            </select>
          </div>
          <div className="form-group">
            <label>Default Currency</label>
            <select className="form-control" defaultValue="KRW" disabled>
              <option value="KRW">KRW (Korean Won)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="CNY">CNY (Chinese Yuan)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Timezone</label>
            <select className="form-control" defaultValue="Asia/Seoul" disabled>
              <option value="Asia/Seoul">Asia/Seoul (KST)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3>Notification Settings</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'New Booking Notifications', desc: 'Receive alerts when new bookings are made', checked: true },
            { label: 'Payment Notifications', desc: 'Receive alerts for payment events', checked: true },
            { label: 'Cancellation Notifications', desc: 'Receive alerts when bookings are cancelled', checked: true },
            { label: 'Daily Summary Report', desc: 'Receive a daily summary email of activity', checked: false },
            { label: 'Low Inventory Alerts', desc: 'Get notified when product inventory is low', checked: true },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{item.desc}</div>
              </div>
              <label
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: 44,
                  height: 24,
                  flexShrink: 0,
                }}
              >
                <input
                  type="checkbox"
                  defaultChecked={item.checked}
                  disabled
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: item.checked ? '#3b82f6' : '#cbd5e1',
                    borderRadius: 12,
                    cursor: 'not-allowed',
                    transition: 'background 0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      width: 18,
                      height: 18,
                      background: '#ffffff',
                      borderRadius: '50%',
                      top: 3,
                      left: item.checked ? 23 : 3,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </span>
              </label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {/* TODO: Implement notification settings */}
            Notification preferences are managed by the system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
