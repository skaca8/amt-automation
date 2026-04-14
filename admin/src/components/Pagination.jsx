// ============================================================================
// Admin — 페이지 번호 버튼 컴포넌트 Pagination
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 테이블 하단에 페이지 번호 버튼을 그려 준다.
//   2) 총 페이지가 7 이하면 모두 표시, 그 이상이면 1 ... (현재±1) ... 마지막
//      형태로 생략 기호를 끼운다.
//   3) Prev / Next 버튼 및 "N total" 요약 텍스트도 함께 표시.
//
// Props:
//   - currentPage   : 1-based 현재 페이지.
//   - totalPages    : 전체 페이지 수. 1 이하면 아예 렌더하지 않는다.
//   - onPageChange  : (page) => void. 부모가 상태를 갱신해 재호출하도록 설계.
//   - totalItems    : (선택) 총 아이템 수. 있으면 "N total" 부가 정보 표시.
//
// 사용처: BookingManagement / PaymentManagement 등 서버 페이지네이션 테이블.
// ============================================================================

import React from 'react'

/**
 * Pagination — 순수 presentational 페이지네이터.
 *
 * 부작용: 없음. 상위 컴포넌트가 onPageChange 를 받아 데이터 fetch 를 수행.
 */
export default function Pagination({ currentPage, totalPages, onPageChange, totalItems }) {
  if (!totalPages || totalPages <= 1) return null

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 7
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        {'\u2039'} Prev
      </button>

      {getPageNumbers().map((page, i) =>
        page === '...' ? (
          <span key={`dots-${i}`} className="pagination-info">
            ...
          </span>
        ) : (
          <button
            key={page}
            className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        )
      )}

      <button
        className="pagination-btn"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next {'\u203A'}
      </button>

      {totalItems != null && (
        <span className="pagination-info" style={{ marginLeft: 12 }}>
          {totalItems} total
        </span>
      )}
    </div>
  )
}
