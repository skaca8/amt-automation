const BASE = '/api'

function getToken() {
  return localStorage.getItem('admin_token')
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) {
    h['Authorization'] = `Bearer ${token}`
  }
  return h
}

async function request(method, path, body, options = {}) {
  const url = `${BASE}${path}`
  const config = {
    method,
    headers: headers(options.headers),
  }
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }
  const res = await fetch(url, config)
  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    window.location.href = '/'
    throw new Error('Session expired')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function get(path) {
  return request('GET', path)
}

export function post(path, body) {
  return request('POST', path, body)
}

export function put(path, body) {
  return request('PUT', path, body)
}

export function del(path) {
  return request('DELETE', path)
}

export async function downloadFile(path, filename) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default { get, post, put, del, downloadFile }
