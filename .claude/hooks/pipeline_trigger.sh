#!/bin/bash
# UserPromptSubmit hook: 개발 트리거 감지 → pipeline.yaml 파이프라인 지시문 주입
# triggers.yaml의 develop 트리거 키워드와 동기화

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null)

# triggers.yaml develop 섹션 + 확장 패턴
TRIGGERS="개발해줘|이거 구현해줘|이 기능 추가해줘|리팩터링 해줘|코드 개선해줘|Express 기능 만들어줘|작업 진행해|작업해줘|구현해줘|개발 시작|기능 개발|코드 작성해줘|작업해|진행해"

if echo "$PROMPT" | grep -qE "($TRIGGERS)"; then
    cat << 'EOF'
[PIPELINE ACTIVATED] pipeline.yaml의 4단계 파이프라인을 순서대로 실행하세요.
단계별 규칙:
  1. [development] dev_agent.skill.yaml 규칙 적용 → 코드 작성/수정
     - PostToolUse 훅(compile_check.sh)이 JS/JSX 파일 수정 시 문법 자동 검증
     - 문법 오류 발생 시 즉시 수정 후 재검증
  2. [testing]     test_agent.skill.yaml 규칙 적용 → Jest/Supertest 테스트 작성 및 실행
  3. [quality]     quality_agent.skill.yaml 규칙 적용 → ESLint 기준 품질 검증
  4. [security]    security_agent.skill.yaml 규칙 적용 → OWASP 기준 보안 점검

실행 규칙:
  - 각 단계 완료 후 사용자에게 결과를 보고하고 다음 단계 진행 승인을 받을 것 (require_approval_before_next_stage: true)
  - 단계 실패 시 해당 단계에서 중단하고 원인을 보고할 것 (stop_on_failure: true)
EOF
fi

exit 0
