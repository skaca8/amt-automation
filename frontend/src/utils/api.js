const BASE_URL = '/api'

async function request(url, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  })

  if (!response.ok) {
    let errorData
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: `HTTP error ${response.status}` }
    }
    const error = new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`)
    error.status = response.status
    error.data = errorData
    throw error
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function get(url) {
  return request(url, { method: 'GET' })
}

export function post(url, body) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function put(url, body) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

export function del(url) {
  return request(url, { method: 'DELETE' })
}
