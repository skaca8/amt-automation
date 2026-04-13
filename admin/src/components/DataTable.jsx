// ============================================================================
// Admin — 제네릭 테이블 컴포넌트 DataTable
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 관리 페이지 전반(예약/유저/결제 등)에서 공통으로 쓰는 표 컴포넌트.
//   2) columns 배열 스펙을 받아 헤더와 셀을 자동 생성한다.
//   3) 헤더 클릭 시 클라이언트 사이드 정렬을 지원한다. (서버 페이지네이션
//      결과에 대해서만 적용되므로, "현재 페이지 내" 정렬이다.)
//   4) loading 중에는 5행짜리 skeleton 을 대신 렌더링한다.
//   5) 데이터가 비었을 때는 emptyMessage 를 표시한다.
//
// columns 스펙(객체 배열):
//   [
//     { key: 'id', label: '번호', width: 80 },
//     { key: 'status', label: '상태', render: (v, row) => <Badge ... /> },
//     ...
//   ]
//   - key    : row 객체에서 값을 꺼낼 필드명. 정렬 키로도 사용된다.
//   - label  : 헤더에 표시될 텍스트.
//   - width  : (선택) CSS width (ex. 80, '10%').
//   - render : (선택) 커스텀 렌더 함수. (cellValue, row) → ReactNode.
//
// 사용처: BookingManagement / UserManagement / PaymentManagement 등 다수.
//
// 주의:
//   - 정렬은 useMemo 로 sortedData 를 계산한다. data/sortKey/sortDir 중 하나만
//     바뀌어도 재계산되며, 원본 data 는 복제본([...data])으로 건드리지 않는다.
//   - onRowClick 이 전달되면 행에 clickable 클래스를 붙이고 커서도 포인터로
//     바뀐다(전역 CSS 규칙).
// ============================================================================

import React, { useState } from 'react'

/**
 * DataTable — 컬럼 스펙 기반 범용 테이블.
 *
 * Props:
 *   - columns      : 위 "columns 스펙" 참고. 필수.
 *   - data         : 렌더링할 행 배열. 없으면 빈 테이블.
 *   - loading      : true 면 skeleton 5행을 대신 표시한다.
 *   - onRowClick   : 행 클릭 콜백 (row) => void. 없으면 행 클릭이 비활성화.
 *   - emptyMessage : data 가 비어 있을 때 표시할 텍스트. 기본 'No data found'.
 *
 * 반환: table-container 로 감싼 <table>.
 *
 * 부작용: 없음. 순수 presentational.
 */
export default function DataTable({ columns, data, loading, onRowClick, emptyMessage }) {
  // 정렬 상태는 테이블 내부 로컬. 페이지를 벗어나 다시 들어오면 초기화된다.
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  // 헤더 클릭 핸들러. 같은 키를 다시 누르면 방향 토글, 다른 키면 오름차순 시작.
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ----------------------------------------------------------------------
  // 정렬된 복제본 계산.
  //   - sortKey 가 없으면 원본 순서 유지.
  //   - 숫자끼리는 수치 비교, 그 외에는 소문자 문자열 비교.
  //   - null/undefined 는 빈 문자열로 치환해 비교 예외를 피한다.
  // ----------------------------------------------------------------------
  const sortedData = React.useMemo(() => {
    if (!sortKey || !data) return data || []
    return [...data].sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]
      if (aVal == null) aVal = ''
      if (bVal == null) bVal = ''
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir])

  // 로딩 스켈레톤: 헤더는 동일하게 그리고, 본문은 회색 막대 5행으로 대체한다.
  // 행 개수/셀 폭을 매번 다르게 주면 깜빡임이 심하므로 5행 고정 + 60~100% 랜덤.
  if (loading) {
    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col, j) => (
                  <td key={j}>
                    <div
                      className="skeleton-cell"
                      style={{ width: `${60 + Math.random() * 40}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={col.width ? { width: col.width } : {}}
              >
                {col.label}
                <span
                  className={`sort-icon ${sortKey === col.key ? 'active' : ''}`}
                >
                  {sortKey === col.key
                    ? sortDir === 'asc'
                      ? ' \u25B2'
                      : ' \u25BC'
                    : ' \u25B4\u25BE'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* 데이터가 비어 있으면 colSpan 으로 전체 폭을 덮는 빈 메시지 한 줄. */}
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="table-empty">
                  <p>{emptyMessage || 'No data found'}</p>
                </div>
              </td>
            </tr>
          ) : (
            // key 우선순위: row.id → row._id → 배열 인덱스 (최후의 수단).
            // 인덱스를 fallback 으로 쓰는 이유: 일부 쿼리 결과가 id 가 없는
            // 집계 행(예: summary) 을 돌려주기 때문이다.
            sortedData.map((row, i) => (
              <tr
                key={row.id || row._id || i}
                className={onRowClick ? 'clickable' : ''}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {/* col.render 가 있으면 커스텀, 없으면 원시 값을 그대로 출력. */}
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
