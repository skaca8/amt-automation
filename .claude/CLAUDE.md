# Claude Session Rules

## 프로젝트 컨텍스트

**High1 Resort 외국인 전용 예약 플랫폼** — 하이원 리조트의 외국인 방문객을 위한 예약 웹 플랫폼입니다.

| 구성요소 | 경로 | 포트 | 설명 |
|---------|------|------|------|
| 백엔드 API | `backend/` | 4000 | Express 기반 REST API, SQLite(sql.js) |
| 사용자 프론트엔드 | `frontend/` | 3000 | 고객용 예약 사이트 (영어/중국어 i18n) |
| 관리자 페이지 | `admin/` | 3001 | 운영자용 관리 대시보드 |

### 주요 명령어

```bash
./start.sh                             # 백엔드 + 프론트엔드 + 관리자 동시 실행
./stop.sh                              # 모든 서비스 종료
cd backend && npm run seed && npm start  # 백엔드 단독 실행
cd frontend && npm run dev               # 프론트엔드 단독 실행
cd admin && npm run dev                  # 관리자 단독 실행
cd backend && rm -rf data && npm run seed && npm start  # 데이터 초기화
```

### 기술 스택

- **백엔드**: Node.js, Express 4, sql.js(SQLite), JWT(jsonwebtoken), bcryptjs, multer, uuid
- **프론트엔드**: React 18, Vite 5, react-router-dom 6, i18next (영어/중국어)
- **관리자**: React 18, Vite 5, react-router-dom 6, recharts
- **Lint**: ESLint 미설치 (권장: `eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks`)
- **테스트**: 미설치 (권장: `jest` + `supertest`)

### 개발 유의사항

- `sql.js` 사용으로 데이터가 `backend/data/` 파일로 저장됨. 초기화 필요 시 디렉터리 삭제 후 `npm run seed`
- 포트 충돌 시 `./stop.sh` 먼저 실행
- 문자열 추가/수정 시 반드시 `frontend/src/i18n/` 번역 리소스(영어 + 중국어) 동시 업데이트
- 인증 필요 API는 `backend/src/middleware/` JWT 미들웨어 통과 필수

## Session Initialization

**MANDATORY**: 세션 시작 즉시 `.claude/skills/claude_init.skill.yaml` 파일을 Read 도구로 읽어야 함.
이 파일의 instructions에 따라 모든 설정이 자동으로 로드됨.

## Critical Rules to Follow

### 1. Plan First, Execute After Approval

- 항상 작업 계획을 먼저 제시하고 사용자 승인을 받는다
- 파일 수정 전 반드시 사용자 확인을 받는다
- 사용자가 방향과 핵심 결정을 내린다
- 추측하지 않고 확인을 요청한다

### 2. Node.js/Express-First Approach

- 커스텀 구현 전 Express/Node.js 내장 솔루션을 먼저 검토한다
- Express 미들웨어, built-in 유틸리티 활용
- 불필요한 복잡성을 피한다

### 3. No Guessing or Assumptions

- 기능 확신이 없으면 문서를 확인한다
- 불확실할 때는 "확인해보겠습니다"라고 말한다
- Claude Code 질문 시 WebFetch 사용

### 4. Preserve Working Solutions

- 성능 문제가 없는 동작 코드는 함부로 변경하지 않는다
- "왜 동작하는 것을 바꿔야 하는가?" 먼저 질문한다
- 최적화 전에 측정한다

### 5. Question Detection Rule

- 메시지가 "?"로 끝나면 질문으로만 처리한다
- 파일 수정 없이 정보만 제공한다
- 질문과 작업 요청을 구분한다

### 6. Check Existing Content

- 편집/덮어쓰기 전에 항상 파일을 먼저 읽는다
- 새 섹션 추가 시 기존 내용을 보존한다
- 부주의한 덮어쓰기로 인한 데이터 손실 방지

## Coding Principles

- 최소한의 중간 변수로 깔끔한 코드 작성
- 적절한 곳에 함수형 프로그래밍 패턴 적용 (Array.map / filter / reduce)
- Node.js/Express 모범 사례를 처음부터 활용
- 시간 = 돈 — 낭비적인 반복 피하기
- 생성된 모든 코드에 코드 주석 작성

### 7. Code Review and Design Decision Principles

- **"도메인 지식 없는 개발자"** 관점에서 가독성 우선
- 명시적 코드 > 숨겨진 로직 (비즈니스 로직)
- 확장성과 유지보수성의 균형
- 일관된 판단 기준 유지

### 8. Architecture Decision Making

- **"도메인 지식 없이 오류 추적이 가능한가?"** 기준
- 프로덕션에서 디버깅 용이성 우선시
- 코드 흐름 추적 시 명시적 경로 제공
- Express 미들웨어 체인은 레이어별로 명확히 분리

### 9. Express Middleware Usage Guidelines

- **적극 사용**: JWT 인증, CORS, 에러 핸들링, 요청 로깅 (횡단 관심사)
- **신중 사용**: 비즈니스 검증, 데이터 변환, 응답 가공 (도메인 로직)
- **판단 기준**: "이 로직을 미들웨어로 숨기면 문제 해결이 어려워질까?"
- **현실 고려**: 문서는 업데이트되지 않으므로, 미들웨어 흐름이 명시적으로 보여야 함

### 10. Analyze Existing Code First

- **새 파일 생성 전**: 유사한 기존 파일 패턴 먼저 확인
- **컨벤션 확인**: 네이밍, 미들웨어 구조, 라우터 패턴, 포맷 스타일
- **예시**:
    - 라우터 생성: 기존 `backend/src/routes/` 파일 확인
    - 컴포넌트 생성: 기존 `frontend/src/components/` 패턴 확인
    - i18n 추가: 기존 `frontend/src/i18n/` 번역 키 구조 확인
- **일관성 핵심**: 새 패턴 강요 말고 기존 코드베이스 스타일 맞추기

### 11. Code Quality Standards

- **ESLint Compliance**: ESLint 설치 시 위반 없이 통과 (미설치 시 수동 검토)
- **품질 기준**:
    - 코드 스멜 및 취약점 수정 완료 후 작업 마무리
    - 적절한 에러 핸들링 및 리소스 관리
    - 네이밍 컨벤션 및 코드 포맷 준수
- **검증**: 작업 완료 전 항상 품질 검사 수행

### 12. Pipeline Execution Rule (MANDATORY)

- **트리거 감지 시 반드시 pipeline.yaml의 4단계를 순서대로 실행할 것**
- 트리거 키워드: "개발해줘", "구현해줘", "작업 진행해", "기능 추가해줘", "리팩터링 해줘" 등
- **실행 순서** (절대 생략 불가):
  1. `[development]` dev_agent.skill.yaml 규칙 적용 → 코드 작성/수정
  2. `[testing]`     test_agent.skill.yaml 규칙 적용 → 테스트 작성 및 실행
  3. `[quality]`     quality_agent.skill.yaml 규칙 적용 → 코드 품질 검증
  4. `[security]`    security_agent.skill.yaml 규칙 적용 → 보안 점검
- **단계 간 규칙**:
  - 각 단계 완료 후 반드시 결과를 보고하고 사용자 승인을 받은 후 다음 단계 진행
  - 단계 실패 시 즉시 중단하고 원인 보고 (stop_on_failure: true)
  - JS/JSX 파일 수정 시 compile_check.sh 훅이 자동으로 문법 검증 수행
- **UserPromptSubmit 훅**: pipeline_trigger.sh가 트리거를 감지하면 이 규칙을 상기시켜 줌

## Claude Execution Standards

모든 요청에 대해: 목표 → 제약조건 → 입력 → 기대 출력을 먼저 구조화한 뒤, design → implementation → validation 순서로 처리한다.

### Do

요건을 소단위로 분해, 가정을 명확히 기술, 변경 영향을 설명, 유지보수성과 확장성 우선, 보안·성능·에러 핸들링·로깅 기준 포함, 도움이 될 때 체크리스트와 샘플 코드 추가, 생성된 모든 코드에 주석 작성.

### Don't

모호한 추측으로 구현 금지, 불명확하거나 검증되지 않은 코드 제공 금지, 미검증 답변을 최종으로 제시 금지, 불필요한 복잡성이나 과도한 엔지니어링 금지, 하드코딩·시크릿 노출·중복 설계·누락 주석 금지.
