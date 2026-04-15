# High1 Booking Development Skills

Node.js/Express + React 기반 하이원 리조트 예약 플랫폼 개발을 위한 Claude 세션 규칙과 스킬셋입니다.

## 핵심 개발 원칙

### 1. Plan-First Development (계획 우선 개발)

작업 전 반드시 계획을 수립하고 승인을 받습니다.

**규칙:**

- 항상 작업 계획을 먼저 제시하고 사용자 승인을 받는다
- 파일 수정 전 반드시 사용자 확인을 받는다
- 사용자가 방향과 핵심 결정을 내린다
- 추측하지 않고 확인을 요청한다

### 2. Node.js/Express-First Approach

커스텀 구현보다 Node.js/Express 생태계를 우선 활용합니다.

**규칙:**

- 커스텀 구현 전에 Express/Node.js 내장 솔루션을 먼저 확인한다
- Express 미들웨어 활용 (인증, 에러 핸들링, CORS 등)
- 불필요한 복잡성을 피한다

**예시:**

```js
// Good: Express 내장 미들웨어 활용
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Avoid: 불필요한 커스텀 파싱
app.use((req, res, next) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => { req.body = JSON.parse(body); next(); });
});
```

### 3. No Guessing Policy (추측 금지)

확실하지 않으면 확인부터 합니다.

**규칙:**

- 기능 확신이 없으면 문서를 확인한다
- 불확실할 때는 "확인해보겠습니다"라고 말한다
- Claude Code 질문 시 WebFetch 사용

### 4. Preserve Working Solutions (동작 코드 보존)

성능 문제가 없는 동작 코드는 함부로 변경하지 않습니다.

**규칙:**

- "왜 동작하는 것을 바꿔야 하는가?" 먼저 질문한다
- 최적화 전에 측정한다

## 코딩 표준

### Clean Code Principles

**핵심 원칙:**

- 최소한의 중간 변수로 깔끔한 코드 작성
- 적절한 곳에 함수형 프로그래밍 패턴 적용 (Array.map / filter / reduce)
- Node.js/Express 모범 사례를 처음부터 활용
- 시간 = 돈 — 낭비적인 반복 피하기

### Developer-Friendly Code (개발자 친화적 코드)

도메인 지식 없는 개발자도 이해할 수 있는 코드를 작성합니다.

**원칙:**

- 비즈니스 로직에서 명시적 코드 > 숨겨진 로직
- 확장성과 유지보수성의 균형
- 일관된 판단 기준 유지

## 아키텍처 가이드라인

### Architecture Decision Making

**의사결정 기준:**

- "도메인 지식 없이 오류 추적이 가능한가?"
- 프로덕션에서 디버깅과 문제 해결 용이성 우선시
- Express 미들웨어 체인은 레이어별로 명확히 분리

### Express Middleware Usage Guidelines

**적극 사용:**

- JWT 인증, CORS, 에러 핸들링, 요청 로깅 (횡단 관심사)

**신중 사용:**

- 비즈니스 검증, 데이터 변환, 응답 가공 (도메인 로직)

**판단 기준:**

- "이 로직을 미들웨어로 숨기면 문제 해결이 어려워질까?"

## High1 Booking 도메인 지식

### 앱 구조

- **backend/**: Express API 서버 (포트 4000)
- **frontend/**: 고객용 예약 사이트 (포트 3000, 영어/중국어)
- **admin/**: 운영자용 관리 대시보드 (포트 3001)

### 인증 구조

- JWT 기반 인증 (`backend/src/middleware/`)
- bcryptjs 비밀번호 해싱
- Google OAuth 연동 (google-auth-library)

### 데이터 레이어

- sql.js (SQLite) — 파일 기반 DB (`backend/data/`)
- 파라미터 바인딩으로 SQL Injection 방지 필수 (? 플레이스홀더)

### i18n 구조

- 영어/중국어 번역: `frontend/src/i18n/`
- 문자열 추가/수정 시 반드시 두 언어 모두 업데이트

## 개발 패턴

### Express Router 패턴

```js
// backend/src/routes/bookings.js
const router = express.Router();

// GET /api/bookings - 예약 목록 조회 (인증 필요)
router.get('/', authenticate, async (req, res, next) => {
  try {
    // 비즈니스 로직
  } catch (err) {
    next(err); // 에러 핸들러로 위임
  }
});

module.exports = router;
```

### SQL 쿼리 패턴 (sql.js)

```js
// Good: ? 파라미터 바인딩 — SQL Injection 방지
const stmt = db.prepare('SELECT * FROM bookings WHERE id = ?');
const result = stmt.getAsObject([bookingId]);

// Never: 문자열 직접 삽입 (SQL Injection 위험)
const result = db.exec(`SELECT * FROM bookings WHERE id = ${bookingId}`);
```

### React 컴포넌트 패턴 (i18n 필수)

```jsx
// frontend/src/components/BookingCard.jsx
import { useTranslation } from 'react-i18next';

function BookingCard({ booking }) {
  const { t } = useTranslation();

  return (
    <div className="booking-card">
      <h3>{t('booking.title')}</h3>
      {/* 컴포넌트 내용 */}
    </div>
  );
}

export default BookingCard;
```

### 에러 핸들링 패턴

```js
// Express 중앙 에러 핸들러 (backend/src/index.js)
app.use((err, req, res, next) => {
  console.error(err.stack);
  // 스택 트레이스는 절대 클라이언트에 노출 금지
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});
```

### 로깅 실패 처리

```js
try {
  // 로그 저장 로직
} catch (logErr) {
  // 로깅 실패는 비즈니스 로직에 영향 없도록 무시
  console.warn('Log insertion failed:', logErr.message);
}
```

## 코드 품질 표준

### ESLint 설치 (미설치 상태)

```bash
# 백엔드
cd backend && npm install --save-dev eslint

# 프론트엔드 / 관리자
cd frontend && npm install --save-dev eslint eslint-plugin-react eslint-plugin-react-hooks
npx eslint --init
```

### 보안 취약점 점검

```bash
# 각 앱 루트에서 실행
npm audit
npm audit fix
```

## 사용 방법

이 스킬을 활용하여:

1. **계획 수립**: 작업 전 구현 계획 제시 후 승인
2. **코드 분석**: 기존 유사 파일 패턴 먼저 확인
3. **Node.js 우선**: 커스텀 구현 전 내장 솔루션 검토
4. **품질 검증**: ESLint(미설치 시 수동) + npm audit
5. **도메인 적용**: High1 Booking 특화 패턴 (JWT, sql.js, i18n) 활용

High1 Booking 프로젝트의 일관성 있고 고품질의 코드 개발을 위해 이 가이드라인을 따라주세요.
