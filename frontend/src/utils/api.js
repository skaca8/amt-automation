// ============================================================================
// 백엔드 REST API fetch wrapper (고객 프런트엔드 공용)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - `/api/...` 경로로 fetch 를 날리는 최소 래퍼. get/post/put/del 네 개의
//     편의 함수를 export 한다.
//   - localStorage 의 'token' 이 있으면 Authorization: Bearer <token> 헤더를
//     자동 첨부한다. (관리자 콘솔은 'admin_token' 을 쓰지만, 고객 프런트는
//     항상 'token' 만 본다. 절대 'admin_token' 을 여기서 읽으면 안 된다.)
//   - 성공(2xx) 응답은 JSON 으로 파싱해서 반환하고, 204 No Content 는 null.
//   - 실패 응답은 `{ error }` 또는 `{ message }` 를 뽑아 Error 로 throw.
//     호출자는 err.status / err.data 로 상세 정보를 볼 수 있다.
//
// 사용처: AuthContext, 거의 모든 페이지. 백엔드와의 단 하나의 통로.
// 주의:
//   - BASE_URL 은 상대경로 `/api` 이므로 Vite dev proxy 또는 배포 환경의
//     리버스 프록시가 백엔드로 넘겨 준다. 절대 host 를 하드코딩하지 말 것.
//   - 백엔드는 snake_case 스키마를 쓴다 (product_type, booking_number,
//     check_in 등). 여기서는 body 를 건드리지 않고 그대로 JSON.stringify 한다.
// ============================================================================

const BASE_URL = '/api'

/**
 * 내부 공용 fetch 함수.
 * 모든 method 별 헬퍼가 이 함수를 통해 실제 네트워크 호출을 한다.
 *
 * @param {string} url     `/hotels` 처럼 BASE_URL 뒤에 붙을 경로
 * @param {object} options fetch 표준 옵션(method, body, headers 등)
 * @returns {Promise<any>} 2xx 는 파싱된 JSON(혹은 204 면 null),
 *                          그 외에는 status/data 를 담은 Error 를 throw.
 */
async function request(url, options = {}) {
  // 고객 사용자 토큰. 없으면 공개 API 로 간주되어 익명 호출.
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // 토큰이 있으면 JWT 를 Authorization 헤더에 실어 준다.
  // 백엔드 authenticate 미들웨어가 이 헤더를 보고 req.user 를 채운다.
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  })

  // 비-2xx 는 에러로 변환해서 throw. 호출자는 try/catch 또는 .catch 로 처리.
  if (!response.ok) {
    let errorData
    try {
      // 백엔드는 `{ error: '...' }` 형태로 실패를 반환한다.
      errorData = await response.json()
    } catch {
      // JSON 이 아니면 (예: 502 HTML 에러 페이지) 폴백 메시지.
      errorData = { message: `HTTP error ${response.status}` }
    }
    const error = new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`)
    // 호출자가 status 로 분기할 수 있도록 보조 필드를 덧붙인다.
    error.status = response.status
    error.data = errorData
    throw error
  }

  // 204 No Content 는 본문이 없으므로 json() 호출하면 예외가 터진다.
  if (response.status === 204) {
    return null
  }

  return response.json()
}

/** GET 편의 함수. 쿼리 스트링은 호출자가 url 에 직접 붙여서 넘긴다. */
export function get(url) {
  return request(url, { method: 'GET' })
}

/** POST 편의 함수. body 는 JSON.stringify 되어 전송된다. */
export function post(url, body) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

/** PUT 편의 함수. 주로 부분/전체 업데이트(예: /auth/me, /bookings/:id/cancel). */
export function put(url, body) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

/** DELETE 편의 함수. body 없이 요청한다. */
export function del(url) {
  return request(url, { method: 'DELETE' })
}
