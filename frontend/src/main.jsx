// ============================================================================
// High1 Resort 고객 프런트엔드 — 엔트리 포인트
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) Vite 가 주입한 #root DOM 노드에 React 애플리케이션을 마운트한다.
//   2) BrowserRouter → AuthProvider → App 순서로 최상위 Provider 트리를
//      구성한다. (react-router 의 useNavigate/useLocation 이
//      AuthContext 에서 쓰이지는 않지만 라우팅 훅이 가능한 트리 안쪽에서
//      초기화되도록 Router 를 가장 바깥에 둔다.)
//   3) `./i18n` 을 import 하는 것만으로 i18next 초기화 side-effect 가
//      실행된다. 이 줄을 지우면 t() 가 key 를 그대로 반환하게 된다.
//
// 주의:
//   - React.StrictMode 안에서 렌더되므로 개발 모드에서 일부 effect 가
//     두 번 호출될 수 있다. AuthContext 의 fetchUser 가 그 영향을 받는다.
//   - Vite dev 서버는 3000 포트에서 /api 를 백엔드(기본 4000)로 프록시한다.
// ============================================================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
// i18n 모듈 import 만으로 i18next.init() 이 실행된다(사이드 이펙트).
import './i18n'
import './App.css'

// createRoot 로 React 18 concurrent 렌더러를 사용한다.
// StrictMode → BrowserRouter → AuthProvider → App 의 중첩 순서를 바꾸지 말 것.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
