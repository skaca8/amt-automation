# amt-High1_Resort_HomePage

> **High1 Resort 외국인 전용 예약 플랫폼** — 3-앱 monorepo (backend API / admin panel / customer frontend)
>
> 본 문서는 시스템의 **아키텍처 · ERD · API 명세 · 기술 스택 · 코드 구조 · 보안/예외 처리 · DFD** 를 한 곳에 모은 설계 문서입니다.

---

## 목차

1. [개요](#1-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [디렉터리 구조 및 모듈화](#4-디렉터리-구조-및-모듈화)
5. [ERD — 데이터 모델](#5-erd--데이터-모델)
6. [API 명세서](#6-api-명세서)
7. [데이터 흐름도 (DFD)](#7-데이터-흐름도-dfd)
8. [보안 및 예외 처리](#8-보안-및-예외-처리)
9. [실행 방법](#9-실행-방법)
10. [참고 문서](#10-참고-문서)

---

## 1. 개요

High1 Resort 외국인 전용 예약 플랫폼은 **한국 강원도 정선의 High1 리조트를 방문하는 외국 관광객**(주로 영어권 및 중화권)을 타깃으로 하는 **호텔/티켓/패키지 예약 웹 서비스**입니다. 내부적으로 세 개의 독립된 Node 앱으로 구성된 monorepo 이며, 개발 단계에서는 `start.sh` 한 줄로 세 프로세스를 동시에 기동합니다.

### 1.1 서비스 구성

| 앱 | 역할 | 접속 주소(개발) | 주 사용자 |
|---|---|---|---|
| **Backend API** | REST API · 비즈니스 로직 · SQLite 데이터 저장 · JWT 인증 · 파일 업로드 | `http://localhost:4000/api` | (내부 호출) |
| **Customer Frontend** | 고객용 예약 사이트. 호텔/티켓/패키지 검색, 예약, 바우처 조회, 프로필 관리 | `http://localhost:3000` | 외국인 고객 |
| **Admin Panel** | 운영자 콘솔. 상품/재고/예약/결제/프로모션/사용자 관리, 대시보드 통계 | `http://localhost:3001` | 리조트 운영자 |

### 1.2 핵심 도메인 개념

- **상품(Product)** 은 `hotel`, `ticket`, `package` 세 가지 타입. 예약 테이블은 `product_type` + `product_id` 의 폴리모픽 참조로 세 종류를 단일 스키마에서 처리합니다.
- **재고(Inventory)** 는 **날짜별 행(per-date row)** 으로 관리됩니다. 호텔은 `room_inventory`, 티켓은 `ticket_inventory`, 패키지는 `package_inventory` 테이블에 각각 (상품 ID × 날짜) 단위로 `total_*` 과 `booked_*` 카운터가 누적됩니다.
- **예약 생성** 시에는 가용성 확인 → `booked_*` 증가 → `bookings/payments/vouchers` INSERT 가 **하나의 SQLite 트랜잭션**으로 묶여 실행됩니다. 중간 실패 시 롤백되어 인벤토리 누수를 방지합니다.
- **바우처(Voucher)** 는 예약 1건당 1행 발급되며 QR 데이터와 UNIQUE 코드(`VCR-XXXXXXXXXX`)를 담습니다. 체크인 시 이 코드가 스캔/조회 대상입니다.
- **이중 언어(Bilingual)**: 상품 테이블의 `name_*` / `description_*` 은 `_en` / `_cn` 두 컬럼으로 병존합니다. 프런트엔드는 현재 i18n locale 에 따라 해당 컬럼을 고릅니다.
- **인증** 은 JWT(HS256, 7일 만료) 기반이며, 비밀번호 + Google Sign-In 두 가지 플로우가 하나의 `users` 테이블을 공유합니다(같은 이메일은 자동으로 연결).

### 1.3 설계 특성

- **외부 DB 서버 없음**: 데이터는 단일 SQLite 파일(`backend/data/high1.db`)로 관리되며, `sql.js` (WebAssembly) 를 통해 네이티브 바이너리 의존성 없이 순수 Node 에서 읽고 씁니다.
- **마이그레이션 시스템 없음**: 스키마 변경은 `config/database.js` 의 `CREATE TABLE` 블록과 idempotent `ALTER TABLE ... ADD COLUMN` 배열 두 곳에 함께 적어 신규/기존 환경 모두에 적용됩니다.
- **테스트 러너 없음**: 검증은 `node --check` (backend) · `vite build` (frontend/admin) · curl 기반 smoke test 에 의존합니다.
- **게스트 예약 허용**: 비로그인 상태에서도 예약 생성이 가능하며, 이후 재조회는 `booking_number` + `guest_email` 소유 증명으로 접근을 제어합니다.

---

## 2. 기술 스택

### 2.1 런타임 & 언어

| 구분 | 기술 | 용도 | 비고 |
|---|---|---|---|
| Runtime | **Node.js ≥ 18** | 모든 JS 실행 환경 | CommonJS(backend) + ESM(frontend/admin) 혼용 |
| Language | **JavaScript (ES2022)** / **JSX** | 전 영역 | TypeScript 미도입 |
| Package Manager | **npm** | 3개 앱 각자 독립 `package.json` | 루트 workspace 없음 |

### 2.2 Backend (`backend/`)

| 의존성 | 버전 | 역할 |
|---|---|---|
| `express` | ^4.21 | HTTP 서버 / 라우팅 / 미들웨어 파이프라인 |
| `sql.js` | ^1.14 | 순수 JS SQLite (WebAssembly). 네이티브 빌드 회피 |
| `bcryptjs` | ^2.4 | 비밀번호 해시 (cost 10) |
| `jsonwebtoken` | ^9.0 | JWT 발급/검증 (HS256, 7d 만료) |
| `google-auth-library` | ^10 | Google Sign-In ID token 검증 |
| `multer` | ^1.4-lts | multipart/form-data 이미지 업로드 |
| `cors` | ^2.8 | 개발환경 cross-origin 허용 |
| `uuid` | ^10 | 예약 번호 / 바우처 코드 생성 |

### 2.3 Customer Frontend (`frontend/`)

| 의존성 | 버전 | 역할 |
|---|---|---|
| `react` / `react-dom` | ^18.3 | UI 렌더러 |
| `vite` / `@vitejs/plugin-react` | ^5.4 / ^4.3 | dev 서버 + 번들러 |
| `react-router-dom` | ^6.28 | 클라이언트 라우팅 (lazy-loaded pages) |
| `i18next` / `react-i18next` | ^23 / ^15 | 국제화 (en/cn) |
| **Google Identity Services** | (CDN) | `accounts.google.com/gsi/client` 를 `index.html` 에서 직접 로드 |

### 2.4 Admin Panel (`admin/`)

| 의존성 | 버전 | 역할 |
|---|---|---|
| `react` / `react-dom` | ^18.3 | UI 렌더러 |
| `vite` / `@vitejs/plugin-react` | ^5.4 / ^4.3 | dev 서버 + 번들러 |
| `react-router-dom` | ^6.28 | 라우팅 (ProtectedRoute 로 인증 게이팅) |
| `recharts` | ^2.13 | 대시보드 시계열 차트 |

### 2.5 개발 / 배포 스크립트

| 스크립트 | 위치 | 하는 일 |
|---|---|---|
| `start.sh` | 루트 | 3개 앱 동시 기동 (+ 포트 4000/3000/3001 선점 해제, 첫 실행 시 seed) |
| `stop.sh` | 루트 | 세 포트에 바인딩된 프로세스 kill |
| `start-windows.bat` | 루트 | Windows 등가 스크립트 |
| `npm run seed` | `backend/` | 데모 데이터로 DB 전체 초기화 |
| `npm run dev` | `backend/` | `node --watch` 로 백엔드 핫 리로드 |
| `npm run dev` | `frontend/` & `admin/` | vite dev 서버 기동 |

### 2.6 도구 / 미도입 항목

- **TypeScript · ESLint · Prettier · Husky**: 현재 미설정.
- **테스트 러너 (Jest / Vitest / Playwright)**: 없음. 검증은 `node --check` + `vite build` + 수동 curl smoke test.
- **CI/CD**: 현재 구성 없음. GitHub 저장소만 존재.
- **외부 DB / Redis / 메시지 큐**: 없음. 모든 상태는 단일 SQLite 파일 + 디스크 업로드 디렉터리.

---

## 3. 시스템 아키텍처

<!-- TODO:SECTION-3 -->

---

## 4. 디렉터리 구조 및 모듈화

<!-- TODO:SECTION-4 -->

---

## 5. ERD — 데이터 모델

<!-- TODO:SECTION-5 -->

---

## 6. API 명세서

<!-- TODO:SECTION-6 -->

---

## 7. 데이터 흐름도 (DFD)

<!-- TODO:SECTION-7 -->

---

## 8. 보안 및 예외 처리

<!-- TODO:SECTION-8 -->

---

## 9. 실행 방법

<!-- TODO:SECTION-9 -->

---

## 10. 참고 문서

<!-- TODO:SECTION-10 -->
