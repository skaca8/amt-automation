// ============================================================================
// GoogleSignInButton — Google Identity Services(GIS) 래퍼
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 공식 Google Sign-In 버튼(GIS "ID token" flow)을 ref 로 잡은 div 에
//     렌더하고, 사용자가 로그인을 성공시키면 credential(구글 ID token)을
//     상위로 전달한다.
//   - GSI 스크립트가 아직 로드되지 않았을 수 있어 약 4초간 100ms 간격으로
//     window.google.accounts.id 존재를 polling 한다.
//   - 빌드 시 VITE_GOOGLE_CLIENT_ID 환경변수가 없으면 버튼 대신 "설정되지
//     않음" 안내 박스를 보여 준다(= 로컬 개발 시 로그인 페이지가 깨지지 않게).
//   - 내부적으로 loading / missing-config / error 상태를 스스로 표시하므로
//     부모 페이지는 GSI lifecycle 을 전혀 신경 쓸 필요가 없다.
//
// 사용처: Login.jsx, Register.jsx. 얻은 credential 을 AuthContext.loginWithGoogle
//         로 넘기면 백엔드가 검증 후 세션 토큰을 내려 준다.
//
// 주의:
//   - `import.meta.env.VITE_GOOGLE_CLIENT_ID` 가 Vite 의 표준 주입 경로다.
//     백업 경로로 `window.GOOGLE_CLIENT_ID` 도 본다(ops 가 런타임 주입 가능하도록).
//   - 구글 버튼은 고정 폭 320px 로 렌더된다. 바깥 wrapper 가 flex center 로 감싼다.
//   - useEffect 의존성에서 onCredential/onError 를 의도적으로 뺀다. 매 렌더마다
//     버튼을 다시 그리면 클릭 상태가 리셋되기 때문이다. 부모는 안정적인
//     함수 참조(또는 useCallback)를 넘기는 것이 바람직하다.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * GIS 버튼 래퍼 컴포넌트.
 *
 * @param {object} props
 * @param {(credential: string) => void} props.onCredential
 *   로그인 성공 시 호출. credential 은 구글 ID token(JWT) 문자열.
 *   호출자는 이 값을 POST /api/auth/google 로 보내 세션으로 교환해야 한다.
 * @param {(err: Error|string) => void} [props.onError]
 *   GSI 스크립트 로딩 실패 또는 초기화 예외 시 호출.
 * @param {boolean} [props.disabled]
 *   상위에서 /api/auth/google 호출 중일 때 클릭을 막기 위해 사용.
 *
 * 부작용:
 *   - window.google.accounts.id 를 polling/initialize/renderButton 한다.
 *   - cleanup 에서 cancelled 플래그를 세워 재마운트 시 중복 초기화 방지.
 */
export default function GoogleSignInButton({ onCredential, onError, disabled }) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef(null)
  // GIS <script> 가 로드되고 우리 컨테이너에 버튼이 그려진 순간 true 가 된다.
  // 아직 false 면 하단에 로딩 텍스트를 보여준다.
  const [ready, setReady] = useState(false)

  // Vite 는 빌드 타임에 import.meta.env 로 환경변수를 주입한다.
  // 런타임 주입(운영팀이 별도 스크립트로 window.GOOGLE_CLIENT_ID 를 설정) 도
  // 폴백으로 허용해 재빌드 없이 클라이언트 id 를 교체할 수 있게 한다.
  const clientId =
    (import.meta && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) ||
    (typeof window !== 'undefined' && window.GOOGLE_CLIENT_ID) ||
    ''

  useEffect(() => {
    // 클라이언트 id 가 없거나 ref 가 아직 안 붙었으면 아무것도 하지 않는다.
    if (!clientId) return
    if (!containerRef.current) return

    // window.google.accounts.id 는 index.html 에 박아둔 GSI 스크립트가
    // 비동기로 로드되면서 등장한다. 레이스하지 말고 짧게 polling 한다.
    let cancelled = false
    let attempts = 0
    const init = () => {
      // 컴포넌트가 unmount 된 뒤 늦게 polling 이 돌아오는 것을 막는다.
      if (cancelled) return
      const google = typeof window !== 'undefined' ? window.google : null
      if (!google || !google.accounts || !google.accounts.id) {
        attempts += 1
        if (attempts > 40) {
          // 약 4초. 그때까지 로드되지 않으면 네트워크/차단 문제로 판단.
          if (onError) onError(new Error('Google Identity Services failed to load.'))
          return
        }
        setTimeout(init, 100)
        return
      }

      try {
        // GIS 초기화. callback 은 사용자가 구글 로그인을 성공했을 때 실행된다.
        // response.credential 이 바로 백엔드에 넘겨야 할 Google ID token(JWT).
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response && response.credential) {
              onCredential(response.credential)
            } else if (onError) {
              onError(new Error('Google sign-in returned no credential.'))
            }
          },
          // popup 모드는 전체 페이지 리다이렉트 없이 팝업으로 로그인해
          // SPA 상태(예: 작성 중 폼)를 그대로 유지한다.
          ux_mode: 'popup',
          // 재방문 시 자동 로그인 off. 명시적 사용자 제스처를 원한다.
          // (기존 이메일/비밀번호 로그인 UX 와의 일관성 유지 목적.)
          auto_select: false,
        })

        // 실제 버튼 DOM 을 컨테이너 div 에 삽입한다.
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          // 언어 토글(en/cn)에 맞춰 버튼 내부 텍스트도 전환한다.
          // 우리 앱은 'en' | 'cn' 만 쓰지만 GIS 는 'zh_CN' 을 요구한다.
          locale: i18n.language && i18n.language.startsWith('zh') ? 'zh_CN' : 'en',
          width: 320,
        })

        setReady(true)
      } catch (initErr) {
        // 초기화 중 예외는 onError 로 위임해 Login 페이지가 배너를 띄우게 한다.
        if (onError) onError(initErr)
      }
    }

    init()

    // cleanup: 다음 polling 사이클이 실행되지 않도록 cancelled 플래그만 세운다.
    // 구글 버튼 DOM 정리는 GIS 가 알아서 관리한다.
    return () => {
      cancelled = true
    }
    // 의존성에서 onCredential/onError 를 제외한 건 의도적이다.
    // 부모가 매 렌더마다 새 함수 객체를 만들면 useEffect 가 재실행되어
    // 구글 버튼이 깜빡이고 클릭 상태가 리셋되기 때문이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, i18n.language])

  if (!clientId) {
    // Dev / 미구성 상태. 운영 배포 시에는 반드시 VITE_GOOGLE_CLIENT_ID 를
    // 빌드 타임에 넣어야 하지만, 없다고 해서 로그인 페이지가 깨지면 곤란
    // 하므로 얌전한 안내 박스로 대체한다.
    return (
      <div
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          padding: '10px 14px',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
          background: 'var(--bg)',
        }}
      >
        {t('auth.googleNotConfigured')}
      </div>
    )
  }

  return (
    <div
      // 부모 레이아웃이 폭을 결정하도록 wrapper 는 flex center.
      // 내부 구글 버튼은 위에서 width:320 으로 고정 렌더된다.
      style={{
        display: 'flex',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        minHeight: 44,
      }}
    >
      <div ref={containerRef} />
      {!ready && (
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            alignSelf: 'center',
          }}
        >
          {t('common.loading')}
        </span>
      )}
    </div>
  )
}
