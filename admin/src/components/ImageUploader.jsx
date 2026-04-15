// ============================================================================
// Admin — 이미지 업로더 ImageUploader
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 드래그 앤 드롭 또는 파일 선택 UI 를 제공하고, 선택된 이미지를
//      /api/admin/upload 로 multipart 업로드한다.
//   2) 업로드가 끝나면 서버가 돌려준 url 목록을 부모에게 onChange 로 전달한다.
//   3) 기존 이미지 썸네일 그리드와 개별 삭제 버튼을 함께 제공한다.
//   4) maxImages 로 업로드 상한을 강제한다 (기본 5장).
//
// Props:
//   - images    : 현재 저장된 이미지 URL 배열. (controlled)
//   - onChange  : 이미지 배열이 바뀔 때 호출되는 콜백. (urls) => void.
//   - maxImages : 최대 업로드 가능 장수. 기본 5.
//
// 사용처: HotelManagement / TicketManagement / PackageManagement 상품 폼.
//
// 주의:
//   - api.js 의 get/post 래퍼는 JSON 전용이므로, 여기서는 fetch 를 직접 쓴다.
//     FormData 를 쓰면 브라우저가 Content-Type: multipart/form-data;
//     boundary=... 를 자동으로 계산해 주기 때문에 헤더를 직접 넣으면 안 된다.
//     Authorization 헤더만 수동으로 붙인다.
//   - 401 처리 로직을 api.js 와 동일하게 중복 구현해 둔 이유도 같은 맥락이다.
// ============================================================================

import React, { useState, useRef } from 'react'

const styles = {
  container: {
    marginBottom: 16,
  },
  dropZone: {
    border: '2px dashed #e2e8f0',
    borderRadius: 8,
    padding: 16,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    background: '#f8fafc',
  },
  dropZoneActive: {
    borderColor: '#3b82f6',
    background: '#eff6ff',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  thumbWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#f1f5f9',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(239,68,68,0.9)',
    color: '#fff',
    fontSize: 14,
    lineHeight: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  uploadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    color: '#3b82f6',
    fontWeight: 600,
  },
  hint: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    marginTop: 8,
  },
  dropText: {
    fontSize: '0.9rem',
    color: '#64748b',
    marginBottom: 4,
  },
}

/**
 * ImageUploader — 상품 이미지 업로드 위젯.
 *
 * 부작용:
 *   - /api/admin/upload 에 multipart POST 요청.
 *   - 실패 시 alert() 호출.
 *   - 401 이면 localStorage 의 토큰을 지우고 '/' 로 강제 이동.
 */
export default function ImageUploader({ images = [], onChange, maxImages = 5 }) {
  // uploading : 현재 한 장 이상의 업로드가 진행 중인지 (드롭존을 잠근다)
  // dragOver  : 드래그가 드롭존 위에 올라와 있어 강조 스타일을 입힐지
  // fileInputRef : 숨겨진 <input type=file> 참조. 클릭 트리거용.
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // ----------------------------------------------------------------------
  // 개별 파일 1장을 업로드하고 최종 url 문자열을 돌려준다.
  // 서버 응답 스키마가 일관되지 않을 수 있어 여러 키를 순차적으로 시도한다.
  // ----------------------------------------------------------------------
  const uploadFile = async (file) => {
    // 직접 localStorage 에서 토큰을 꺼낸다. AuthContext 를 import 하지 않는
    // 이유는 이 컴포넌트가 클래스 없이 쉽게 재사용되길 원하기 때문.
    const token = localStorage.getItem('admin_token')
    const formData = new FormData()
    formData.append('image', file)

    // Content-Type 을 수동 지정하지 않는다 — FormData 는 브라우저가
    // boundary 파라미터까지 자동 계산하므로 건드리면 파싱이 깨진다.
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    // 401 처리는 api.js 의 request() 와 동일하게 직접 수행한다.
    if (res.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/'
      throw new Error('Session expired')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Upload failed' }))
      throw new Error(err.message || `HTTP ${res.status}`)
    }

    const data = await res.json()
    // 서버 응답이 통일돼 있지 않을 때를 대비해 4가지 경로를 순차로 시도.
    return data.url || data.image_url || data.path || data.data?.url
  }

  // ----------------------------------------------------------------------
  // 여러 파일을 받아 순차적으로 업로드한다.
  // Promise.all 로 병렬화하지 않는 이유: 서버 upload 엔드포인트가 파일 1개씩
  // 받는 설계라 동시 요청 시 race 가 날 수 있고, 사용자에게 "1장씩 완료" 진행
  // 감을 주기 위함이다.
  // ----------------------------------------------------------------------
  const handleFiles = async (files) => {
    const remaining = maxImages - images.length
    if (remaining <= 0) {
      alert(`Maximum ${maxImages} images allowed.`)
      return
    }

    const toUpload = Array.from(files).slice(0, remaining)
    if (toUpload.length === 0) return

    setUploading(true)
    try {
      const newUrls = []
      for (const file of toUpload) {
        const url = await uploadFile(file)
        if (url) newUrls.push(url)
      }
      onChange([...images, ...newUrls])
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // <input type=file> 의 change 핸들러. 업로드 후 value 를 비워 줘야
  // 같은 파일을 연속으로 다시 선택해도 change 이벤트가 다시 발생한다.
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  const removeImage = (index) => {
    const updated = images.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div style={styles.container}>
      {images.length > 0 && (
        <div style={styles.grid}>
          {images.map((url, index) => (
            <div key={index} style={styles.thumbWrapper}>
              <img src={url} alt={`Image ${index + 1}`} style={styles.thumb} />
              <button
                type="button"
                style={styles.deleteBtn}
                onClick={() => removeImage(index)}
                title="Remove image"
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          ...styles.dropZone,
          ...(dragOver ? styles.dropZoneActive : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div>
            <div className="spinner" style={{ margin: '0 auto', width: 24, height: 24 }} />
            <p style={{ ...styles.dropText, marginTop: 8 }}>Uploading...</p>
          </div>
        ) : (
          <div>
            <p style={styles.dropText}>
              Drag &amp; drop images here or click to browse
            </p>
            <button
              type="button"
              style={styles.addBtn}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              + Add Image
            </button>
            <p style={styles.hint}>
              {images.length}/{maxImages} images
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  )
}
