// ============================================================================
// Admin — 얇은 fetch 래퍼 (get / post / put / del / downloadFile)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 모든 관리자 API 호출의 공통 수행부. Authorization: Bearer <admin_token>
//      헤더를 자동으로 붙여 주고, JSON 직렬화 · 파싱을 대신한다.
//   2) 401 (토큰 만료/무효) 응답을 가로채 localStorage 를 비우고 '/' 로
//      강제 이동시켜, 자동으로 로그인 페이지로 튕긴다.
//   3) 에러 본문의 message 필드를 꺼내 Error 로 throw 하므로, 호출부는
//      try/catch 만 하면 서버 메시지를 바로 toast/alert 에 띄울 수 있다.
//   4) CSV 등 이진 다운로드를 위한 downloadFile 헬퍼를 제공한다. 이건
//      JSON 응답이 아니므로 request() 파이프라인을 타지 않는다.
//
// 사용처: 거의 모든 페이지/컴포넌트가 이 모듈을 import 해서 쓴다.
//
// 주의:
//   - 토큰 키는 'admin_token' (고객 앱의 'token' 과 분리).
//   - 멀티파트(이미지) 업로드는 Content-Type 을 수동으로 맞춰야 하므로
//     ImageUploader 쪽에서 fetch 를 직접 부른다. 여기서 처리하지 않는다.
//   - 401 처리에서 window.location.href 를 쓰는 이유: React Router 컨텍스트
//     바깥이라 useNavigate 를 쓸 수 없다. 페이지 전체를 새로 로드해
//     AuthContext 도 초기화되는 부수 효과가 필요하기 때문.
// ============================================================================

// 모든 요청 경로의 prefix. vite dev 서버에서 /api → backend:4000 프록시.
const BASE = '/api'

/**
 * localStorage 에서 현재 저장된 관리자 JWT 를 꺼낸다.
 * 없으면 null. AuthContext 와 키가 같아야 한다.
 */
function getToken() {
  return localStorage.getItem('admin_token')
}

/**
 * 기본 요청 헤더를 만든다. JSON content-type + (있다면) Bearer 토큰.
 * extra 로 호출부에서 추가 헤더를 넣을 수 있도록 병합한다.
 */
function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) {
    h['Authorization'] = `Bearer ${token}`
  }
  return h
}

/**
 * 내부 공용 요청 함수. 외부에는 get/post/put/del 로만 노출된다.
 *
 * 처리 순서:
 *   1) URL 조립 (BASE + path)
 *   2) body 가 있고 GET 이 아니면 JSON 직렬화
 *   3) fetch 후 401 이면 세션 종료 플로우로 분기
 *   4) !res.ok 이면 서버 에러 메시지를 꺼내 throw
 *   5) 204(No Content) 는 null, 그 외는 res.json() 반환
 */
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
  // 401 = 토큰 만료/무효. 저장된 자격 증명을 모두 지우고 루트로 튕긴다.
  // 루트는 App.jsx 의 로직에 의해 다시 /login 으로 리다이렉트된다.
  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    window.location.href = '/'
    throw new Error('Session expired')
  }
  if (!res.ok) {
    // 서버가 JSON 에러 바디를 안 줄 수도 있어 catch 로 기본 메시지 fallback.
    const err = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  // 204 No Content (주로 DELETE 응답) 은 본문이 없으므로 파싱하면 안 된다.
  if (res.status === 204) return null
  return res.json()
}

/** GET 요청. 응답 본문을 JSON 파싱해 반환한다. */
export function get(path) {
  return request('GET', path)
}

/** POST 요청. body 객체를 JSON 으로 직렬화해 보낸다. */
export function post(path, body) {
  return request('POST', path, body)
}

/** PUT 요청. 부분 업데이트 대신 전체 리소스 교체용으로 주로 쓰인다. */
export function put(path, body) {
  return request('PUT', path, body)
}

/** DELETE 요청. 성공 시 대부분 204 → null 반환. */
export function del(path) {
  return request('DELETE', path)
}

/**
 * downloadFile — 이진/CSV 다운로드 전용 헬퍼.
 *
 * JSON 이 아닌 스트림 응답을 blob 으로 받아 <a download> 트릭으로 저장시킨다.
 * 주로 예약 내역 · 결제 내역 CSV 내보내기에서 사용된다.
 *
 * 부작용:
 *   - DOM 에 임시 <a> 태그를 생성 / 클릭 / 제거.
 *   - createObjectURL 로 만든 blob URL 을 revokeObjectURL 로 반드시 해제.
 */
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
