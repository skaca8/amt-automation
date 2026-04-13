// ============================================================================
// High1 Resort Admin — 프런트엔드 엔트리 포인트
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) Vite 번들러가 index.html 에서 import 하는 최초 엔트리.
//   2) React 18 의 createRoot API 로 #root DOM 노드에 앱을 mount 한다.
//   3) BrowserRouter(react-router-dom) 로 라우팅 컨텍스트를 주입하고,
//      AuthProvider 로 전역 로그인 상태('admin_token' 기반)를 감싸 준다.
//
// 주의:
//   - dev 서버는 admin/vite.config.js 에서 포트 3001 로 띄운다.
//     (고객용 customer 앱은 3000, backend 는 4000 이므로 섞지 말 것.)
//   - StrictMode 때문에 개발 모드에서 useEffect 가 두 번 실행되는 것은 정상.
//   - App.css 는 전역 CSS (카드·테이블·배지 등)로, 여기서 단 한 번만 import.
// ============================================================================

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './App.css'

// React 18 의 concurrent root. AuthProvider 가 Routes 보다 바깥에 있어야
// 모든 페이지에서 useAuth() 를 사용할 수 있다. 순서를 바꾸면 컨텍스트가
// 없어 런타임 에러가 난다.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
