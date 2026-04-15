// ============================================================================
// i18next 초기화 (고객 프런트엔드)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - en.json / cn.json 두 개의 번역 리소스를 로드해 react-i18next 에 등록.
//   - localStorage 의 'language' 값을 초기 언어로 쓰고, 없으면 'en' (영어).
//   - fallback 은 영어. 키가 누락된 중국어 번역은 영어로 대체된다.
//
// import 하는 곳: main.jsx 에서 한 번만 side-effect import.
// 언어 전환: Header.jsx / Profile.jsx 에서 i18n.changeLanguage(lng) 호출 +
//            localStorage.setItem('language', lng) 로 persist.
//
// 주의:
//   - JSON 파일(en/cn)은 주석을 허용하지 않으므로 이 주석은 여기에만 둔다.
//   - React 리액트는 escape 를 이미 처리하므로 interpolation.escapeValue 는
//     false 로 꺼 둔다. (i18next 기본값은 true)
// ============================================================================

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import cn from './cn.json'

// react-i18next 플러그인을 연결하고 곧바로 init 을 호출한다.
// init 은 Promise 를 반환하지만 여기서는 await 하지 않아도 되는데,
// react-i18next 가 로딩 상태를 내부적으로 관리하기 때문이다.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cn: { translation: cn }
  },
  // 저장된 언어가 있으면 이어받고, 없으면 영어로 시작.
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  interpolation: {
    // React 가 이미 XSS escape 를 처리하므로 중복 escape 방지.
    escapeValue: false
  }
})

export default i18n
