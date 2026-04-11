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

export default function RichTextEditor({ value = '', onChange, placeholder = 'Enter content...' }) {
  const editorRef = useRef(null)
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
