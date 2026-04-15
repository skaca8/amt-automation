// ============================================================================
// Admin — 경량 리치 텍스트 에디터 RichTextEditor
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) contentEditable 기반의 단순 워드 프로세서. bold/italic/underline,
//      H2/H3, 불렛·넘버 리스트, 링크 삽입, 포맷 제거 정도를 지원한다.
//   2) 내부적으로 document.execCommand 를 사용한다. (deprecated 이긴 하나
//      브라우저 호환성이 여전히 가장 넓다.)
//   3) 외부에서 value/onChange 로 controlled 형태로 쓸 수 있다. HTML 문자열을
//      입출력한다.
//
// Props:
//   - value       : 초기/현재 HTML 문자열.
//   - onChange    : HTML 문자열이 바뀔 때마다 호출. (html) => void.
//   - placeholder : 비어 있을 때 보여줄 텍스트 (CSS attr 로 표시).
//
// 사용처: HotelManagement / TicketManagement / PackageManagement 등 상품 폼의
//         상세 설명 입력 필드.
//
// 주의:
//   - execCommand 는 브라우저가 "현재 선택 영역" 을 기준으로 동작하므로,
//     툴바 버튼은 onMouseDown 에서 preventDefault 를 호출해 포커스가 에디터에서
//     빼앗기지 않도록 한다.
//   - value 가 외부에서 바뀐 경우(부모가 재설정) 만 innerHTML 을 덮어쓰고,
//     내부 입력으로 인해 onChange → 부모 → value 재진입이 일어날 때는
//     isInternalUpdate 플래그로 루프를 차단한다. (커서 위치 유지 목적)
// ============================================================================

import React, { useRef, useCallback, useEffect } from 'react'

const styles = {
  container: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
    padding: '6px 8px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  toolbarGroup: {
    display: 'flex',
    gap: 2,
    paddingRight: 8,
    marginRight: 8,
    borderRight: '1px solid #e2e8f0',
  },
  toolbarGroupLast: {
    display: 'flex',
    gap: 2,
  },
  toolBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid transparent',
    borderRadius: 4,
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
  },
  toolBtnHover: {
    background: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  editor: {
    minHeight: 200,
    padding: '12px 16px',
    outline: 'none',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    color: '#1e293b',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
}

const editorContentStyles = `
  h2 { font-size: 1.3em; font-weight: 700; margin: 0.6em 0 0.3em; color: #1e293b; }
  h3 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0 0.3em; color: #334155; }
  ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
  li { margin: 0.2em 0; }
  a { color: #3b82f6; text-decoration: underline; }
  p { margin: 0.4em 0; }
`

const buttons = [
  // group 1: inline formatting
  { cmd: 'bold', label: 'B', title: 'Bold', style: { fontWeight: 700 } },
  { cmd: 'italic', label: 'I', title: 'Italic', style: { fontStyle: 'italic' } },
  { cmd: 'underline', label: 'U', title: 'Underline', style: { textDecoration: 'underline' } },
  { group: true },
  // group 2: headings
  { cmd: 'formatBlock', arg: 'H2', label: 'H2', title: 'Heading 2', style: { fontSize: '0.75rem' } },
  { cmd: 'formatBlock', arg: 'H3', label: 'H3', title: 'Heading 3', style: { fontSize: '0.75rem' } },
  { group: true },
  // group 3: lists
  { cmd: 'insertUnorderedList', label: '\u2022', title: 'Bullet List' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Numbered List', style: { fontSize: '0.75rem' } },
  { group: true },
  // group 4: link + clear
  { cmd: 'createLink', label: '\uD83D\uDD17', title: 'Insert Link', isLink: true },
  { cmd: 'removeFormat', label: '\u2718', title: 'Clear Formatting', style: { color: '#ef4444' } },
]

/**
 * RichTextEditor — contentEditable 기반 경량 에디터.
 *
 * 부작용:
 *   - document.execCommand 로 현재 선택 영역에 서식을 적용.
 *   - createLink 커맨드 선택 시 window.prompt 로 URL 입력을 받는다.
 *   - onPaste 가로채기: 항상 plain text 로만 붙여 넣어 외부 스타일 유입을 차단.
 */
export default function RichTextEditor({ value = '', onChange, placeholder = 'Enter content...' }) {
  // 실제 DOM 노드 참조. innerHTML 조작용.
  const editorRef = useRef(null)
  // 내부 입력이 유발한 onChange 인지 구분하는 플래그. 부모가 value 를 내려줘
  // useEffect 가 다시 돌 때, innerHTML 을 재설정해 커서가 튀는 현상을 막는다.
  const isInternalUpdate = useRef(false)

  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || ''
      }
    }
    isInternalUpdate.current = false
  }, [value])

  const emitChange = useCallback(() => {
    if (editorRef.current && onChange) {
      isInternalUpdate.current = true
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const execCommand = useCallback((cmd, arg) => {
    editorRef.current?.focus()
    if (cmd === 'createLink') {
      const url = prompt('Enter URL:', 'https://')
      if (url) {
        document.execCommand('createLink', false, url)
      }
    } else if (cmd === 'formatBlock') {
      document.execCommand('formatBlock', false, `<${arg}>`)
    } else {
      document.execCommand(cmd, false, arg || null)
    }
    emitChange()
  }, [emitChange])

  const renderButtons = () => {
    const groups = []
    let currentGroup = []

    buttons.forEach((btn, i) => {
      if (btn.group) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
          currentGroup = []
        }
      } else {
        currentGroup.push(btn)
      }
    })
    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups.map((group, gi) => (
      <div
        key={gi}
        style={gi < groups.length - 1 ? styles.toolbarGroup : styles.toolbarGroupLast}
      >
        {group.map((btn) => (
          <button
            key={btn.cmd + (btn.arg || '')}
            type="button"
            title={btn.title}
            style={{ ...styles.toolBtn, ...(btn.style || {}) }}
            onMouseDown={(e) => {
              e.preventDefault()
              execCommand(btn.cmd, btn.arg)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    ))
  }

  return (
    <div style={styles.container}>
      <style>{`.rte-content ${editorContentStyles}`}</style>
      <div style={styles.toolbar}>
        {renderButtons()}
      </div>
      <div
        ref={editorRef}
        className="rte-content"
        contentEditable
        suppressContentEditableWarning
        style={styles.editor}
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
          emitChange()
        }}
      />
    </div>
  )
}
