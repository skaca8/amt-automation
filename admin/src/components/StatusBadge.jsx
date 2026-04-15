// ============================================================================
// Admin — 상태 표시 배지 StatusBadge
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 예약/결제/유저 상태 문자열을 색상 배지로 변환해 준다.
//   2) 매핑되지 않는 상태는 회색(inactive) 로 표시한다.
//
// Props:
//   - status : 원본 상태 문자열 (대소문자/공백/언더스코어 상관없음).
//   - type   : (미사용) 향후 type 별로 색 테마를 분리할 때 쓸 예정. 현재는
//              인자만 받아두고 로직에서는 활용하지 않는다.
//
// 사용처: DataTable 의 render 콜백, 상세 페이지 헤더 등.
//
// 주의: 배지 스타일 클래스(badge-pending 등)는 전역 App.css 에서 정의된다.
// ============================================================================

import React from 'react'

// 정규화된 상태 문자열 → CSS 클래스 매핑.
// 'canceled' / 'cancelled' 같은 변형을 모두 수용한다.
const statusClassMap = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-confirmed',
  cancelled: 'badge-cancelled',
  canceled: 'badge-cancelled',
  refunded: 'badge-refunded',
  paid: 'badge-paid',
  unpaid: 'badge-unpaid',
  failed: 'badge-failed',
  active: 'badge-active',
  inactive: 'badge-inactive',
  used: 'badge-used',
  expired: 'badge-cancelled',
  processing: 'badge-pending',
}

/**
 * StatusBadge — 상태 문자열 → 색상 배지.
 *
 * status 가 falsy 면 "N/A" 회색 배지. 그 외에는 lowercase + 비-알파벳 제거한
 * 키로 매핑해 적절한 클래스를 적용하고, 원본 문자열을 그대로 표시한다.
 */
export default function StatusBadge({ status, type }) {
  if (!status) return <span className="badge badge-inactive">N/A</span>
  // 'Confirmed' / 'confirmed' / 'CONFIRMED_ ' 등 변형을 모두 같은 키로 맞춤.
  const normalized = status.toLowerCase().replace(/[^a-z]/g, '')
  const className = statusClassMap[normalized] || 'badge-inactive'

  return <span className={`badge ${className}`}>{status}</span>
}
