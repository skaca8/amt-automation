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
