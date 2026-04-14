# High1 Resort 외국인 전용 예약 플랫폼 - 실행 가이드

## 이 프로젝트는 뭔가요?

이 프로젝트는 **3개의 프로그램**으로 구성되어 있습니다:

| 프로그램 | 설명 | 주소 |
|---------|------|------|
| **백엔드 서버** | 데이터를 저장하고 처리하는 두뇌 역할 | http://localhost:4000 |
| **사용자 홈페이지** | 고객이 보는 예약 사이트 | http://localhost:3000 |
| **관리자 페이지** | 운영자가 관리하는 페이지 | http://localhost:3001 |

---

## 실행하는 방법 (아주 쉬움!)

### 방법 1: 원클릭 실행 (가장 쉬움)

터미널(명령어 창)을 열고 아래 한 줄만 입력하세요:

```
./start.sh
```

끝! 3개의 프로그램이 자동으로 모두 시작됩니다.

### 방법 2: 하나씩 직접 실행하기

터미널 창을 **3개** 열어야 합니다.

**터미널 1 - 백엔드 서버:**
```
cd backend
npm run seed
npm start
```

**터미널 2 - 사용자 홈페이지:**
```
cd frontend
npm run dev
```

**터미널 3 - 관리자 페이지:**
```
cd admin
npm run dev
```

---

## 실행한 뒤에 보는 방법

웹 브라우저(Chrome, Safari 등)를 열고 주소창에 입력하세요:

- 사용자 홈페이지 보기: **http://localhost:3000**
- 관리자 페이지 보기: **http://localhost:3001**

---

## 로그인 계정

| 구분 | 이메일 | 비밀번호 |
|------|--------|---------|
| 관리자 | admin@high1.com | admin123 |
| 테스트 고객 | guest@test.com | test123 |

---

## 종료하는 방법

### 방법 1: start.sh로 실행한 경우
키보드에서 `Ctrl + C` 를 누르세요.

### 방법 2: 종료 스크립트 사용
```
./stop.sh
```

### 방법 3: 하나씩 실행한 경우
각 터미널 창에서 `Ctrl + C` 를 누르세요.

---

## 자주 묻는 질문 (FAQ)

### Q: "npm: command not found" 오류가 나와요
Node.js가 설치되어 있지 않습니다.
https://nodejs.org 에서 LTS 버전을 다운받아 설치하세요.

### Q: "port already in use" 오류가 나와요
이미 프로그램이 실행 중입니다. `./stop.sh` 를 먼저 실행한 뒤 다시 시작하세요.

### Q: 데이터를 초기화하고 싶어요
```
cd backend
rm -rf data
npm run seed
npm start
```

### Q: localhost가 뭔가요?
내 컴퓨터를 뜻합니다. 아직 인터넷에 올리지 않고 내 컴퓨터에서만 볼 수 있는 상태입니다.

---

## Google 소셜 로그인 설정 (선택)

고객 사이트 로그인/회원가입 페이지에 "Sign in with Google" 버튼이 있습니다. 별도 설정 없이도 **기존 이메일/비밀번호 로그인은 그대로 동작**하지만, 구글 로그인을 실제로 사용하려면 Google Cloud에서 OAuth 2.0 Web Client ID를 발급받아 환경변수로 주입해야 합니다.

### 1. Google Cloud Console에서 Client ID 발급

1. https://console.cloud.google.com/apis/credentials 접속
2. **Create Credentials → OAuth client ID → Web application**
3. **Authorized JavaScript origins**에 `http://localhost:3000` (개발용) / 운영 도메인 추가
4. **Authorized redirect URIs**는 비워둬도 됩니다 (ID-token 팝업 플로우 사용)
5. 생성된 **Client ID** 값을 복사 (형식: `123456789-abc....apps.googleusercontent.com`)

### 2. 백엔드에 환경변수 설정

`backend/` 에서 서버를 기동할 때 아래 환경변수를 전달하세요:

```
GOOGLE_CLIENT_ID=123456789-abc....apps.googleusercontent.com npm start
```

또는 `backend/.env` 파일을 만들고 `GOOGLE_CLIENT_ID=...` 한 줄을 넣어 `node --env-file=.env src/index.js`로 실행해도 됩니다. 값이 없으면 `/api/auth/google`이 503을 반환해 기능만 꺼집니다.

### 3. 프런트엔드에 환경변수 설정

Vite 빌드 시 동일한 Client ID를 `VITE_GOOGLE_CLIENT_ID`로 주세요:

```
cd frontend
VITE_GOOGLE_CLIENT_ID=123456789-abc....apps.googleusercontent.com npm run dev
```

또는 `frontend/.env.local`에 `VITE_GOOGLE_CLIENT_ID=...`를 저장 (Vite가 자동 로딩). 값이 없으면 Login/Register 페이지의 Google 버튼 자리에 "Google Sign-In is not configured" 안내만 표시됩니다.

### 4. 동작 확인

- 서버 기동 → `/login` 이동 → "Sign in with Google" 버튼 클릭 → 팝업에서 계정 선택
- 최초 로그인 시 `users` 테이블에 새 행이 생성 (password는 랜덤 해시, `google_id`는 Google `sub`, `avatar_url`은 프로필 이미지)
- 같은 이메일로 이미 password 회원가입을 했다면 기존 계정에 `google_id`가 자동 연결됨 → 두 방식 모두 같은 계정

---

## 폴더 구조

```
amt-automation/
├── start.sh          <-- 원클릭 실행 스크립트
├── stop.sh           <-- 원클릭 종료 스크립트
├── GUIDE.md          <-- 이 파일 (설명서)
│
├── backend/          <-- 백엔드 서버 (데이터 처리)
│   └── src/
│       ├── index.js          (서버 시작점)
│       ├── seed.js           (샘플 데이터 생성)
│       ├── config/           (설정)
│       ├── middleware/       (인증 처리)
│       └── routes/           (API 경로)
│
├── frontend/         <-- 사용자 홈페이지
│   └── src/
│       ├── pages/            (각 페이지)
│       ├── components/       (공통 부품)
│       └── i18n/             (영어/중국어 번역)
│
└── admin/            <-- 관리자 페이지
    └── src/
        ├── pages/            (각 페이지)
        └── components/       (공통 부품)
```
