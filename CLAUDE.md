claude/display-claude-md-5PA7A
# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code가 참고하는 프로젝트 가이드입니다.

## 프로젝트 개요

**High1 Resort 외국인 전용 예약 플랫폼** — 하이원 리조트의 외국인 방문객을 위한 예약 웹 플랫폼입니다. 세 개의 독립적인 애플리케이션으로 구성되어 있습니다.

| 구성요소 | 경로 | 포트 | 설명 |
|---------|------|------|------|
| 백엔드 API | `backend/` | 4000 | Express 기반 REST API, SQLite(sql.js) |
| 사용자 프론트엔드 | `frontend/` | 3000 | 고객용 예약 사이트 (영어/중국어 i18n) |
| 관리자 페이지 | `admin/` | 3001 | 운영자용 관리 대시보드 |

## 자주 쓰는 명령어

### 전체 실행 / 종료
```bash
./start.sh   # 백엔드 + 프론트엔드 + 관리자 동시 실행
./stop.sh    # 모든 서비스 종료
```

### 개별 실행
```bash
# 백엔드
cd backend && npm run seed && npm start

# 사용자 프론트엔드
cd frontend && npm run dev

# 관리자
cd admin && npm run dev
```

### 데이터 초기화
```bash
cd backend && rm -rf data && npm run seed && npm start
```

## 기본 로그인 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| 관리자 | admin@high1.com | admin123 |
| 테스트 고객 | guest@test.com | test123 |

## 디렉토리 구조

```
amt-automation/
├── start.sh / stop.sh     # 원클릭 실행/종료 스크립트
├── start-windows.bat      # Windows 용 실행 스크립트
├── GUIDE.md               # 사용자용 한국어 가이드
│
├── backend/               # Express API 서버
│   └── src/
│       ├── index.js       # 서버 진입점
│       ├── seed.js        # 샘플 데이터 생성
│       ├── config/        # DB/환경 설정
│       ├── middleware/    # 인증 미들웨어 (JWT)
│       └── routes/        # API 엔드포인트
│
├── frontend/              # 고객용 사이트
│   └── src/
│       ├── pages/
│       ├── components/
│       └── i18n/          # 영어/중국어 번역 리소스
│
└── admin/                 # 관리자 대시보드
    └── src/
        ├── pages/
        └── components/
```

## 기술 스택

- **백엔드**: Node.js, Express 4, sql.js(SQLite), JWT 인증, bcryptjs, multer(파일 업로드)
- **프론트엔드 / 관리자**: Node.js 기반 SPA, i18n 다국어 지원
- **런타임**: Node.js LTS 필요

## 개발 시 유의사항

- 백엔드는 `sql.js` 를 사용하므로 데이터가 `backend/data/` 하위에 파일로 저장됩니다. 초기화가 필요하면 해당 디렉토리를 제거하고 `npm run seed` 를 다시 실행하세요.
- 포트 충돌 시 `./stop.sh` 로 먼저 기존 프로세스를 정리하세요.
- 프론트엔드는 외국인 대상이므로 문자열을 추가/수정할 때는 반드시 `frontend/src/i18n/` 의 번역 리소스를 함께 업데이트하세요.
- 인증이 필요한 API 는 `backend/src/middleware/` 의 JWT 미들웨어를 통과해야 합니다.

## Git 워크플로우

- 기본 브랜치에서 직접 작업하지 말고 기능 브랜치를 만들어 작업하세요.
- 커밋 메시지는 "무엇을" 보다 "왜" 에 초점을 맞춰 간결하게 작성합니다.

# Claude.md

Claude is a development execution partner built on harness engineering. For every request, first structure the goal, constraints, inputs, and expected output, then handle it in this order: design → implementation → validation. Every response must include immediately usable code, folder structure, commands, test criteria, exception handling, and code comments for all generated code.

## Do
Break requirements into small units, state assumptions clearly, explain change impact, prioritize maintainability and scalability, include security, performance, error handling, and logging standards, add checklists and sample code when helpful, and write comments in all code.

## Don't
Do not implement based on vague guesses, do not provide unclear or unverified code, do not present unvalidated answers as final, do not add unnecessary complexity or over-engineering, and do not allow hardcoding, secret exposure, duplicated design, or missing comments in code.
main
