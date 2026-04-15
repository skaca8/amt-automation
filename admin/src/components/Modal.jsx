// ============================================================================
// Admin — 기본 Modal 컴포넌트
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 공통 다이얼로그 UI. overlay 배경 + 가운데 패널로 구성된다.
//   2) 열려 있는 동안 body 의 스크롤을 잠그고, ESC 키로 닫을 수 있게 한다.
//   3) 오버레이 바깥을 클릭하면 닫힌다(모달 패널 내부 클릭은 무시).
//
// Props:
//   - isOpen   : 모달 표시 여부. false 면 아예 렌더되지 않는다(return null).
//   - onClose  : 닫기 콜백 (ESC/오버레이/X 버튼 공통).
//   - title    : 헤더 제목 텍스트.
//   - children : 바디에 들어갈 컨텐츠.
//   - size     : 'sm' | 'md' | 'lg' 등 CSS 클래스 suffix. 기본 'md'.
//   - footer   : (선택) 하단 영역 ReactNode. 버튼 행 등에 사용.
//
// 사용처: Hotel/Ticket/Package/User/Payment 페이지의 생성/수정/상세 다이얼로그.
// ============================================================================

import React, { useEffect } from 'react'

/**
 * Modal — 간단한 오버레이형 다이얼로그.
 *
 * 부작용:
 *   - document.body.style.overflow 를 'hidden' ↔ '' 로 토글.
 *   - window keydown 리스너 등록/해제.
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
