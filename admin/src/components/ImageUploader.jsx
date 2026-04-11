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

export default function ImageUploader({ images = [], onChange, maxImages = 5 }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const uploadFile = async (file) => {
    const token = localStorage.getItem('admin_token')
    const formData = new FormData()
    formData.append('image', file)

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

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
    return data.url || data.image_url || data.path || data.data?.url
  }

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
