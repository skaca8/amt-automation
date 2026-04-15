#!/bin/bash
# PostToolUse hook: JS/JSX 파일 수정 후 문법 검증

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

# JS/JSX/MJS/CJS 파일이 아니면 스킵
if ! echo "$FILE" | grep -qE '\.(js|jsx|mjs|cjs)$'; then
    exit 0
fi

# ESLint 설치 여부 확인 후 우선 사용
if npx --no eslint --version > /dev/null 2>&1; then
    RESULT=$(npx eslint \
        --no-eslintrc \
        -c '{"env":{"es2022":true,"node":true,"browser":true},"parserOptions":{"ecmaVersion":2022,"sourceType":"module","ecmaFeatures":{"jsx":true}}}' \
        "$FILE" 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
        echo "ESLint 오류 감지 - 다음 오류를 수정해주세요:"
        echo "$RESULT"
        exit 1
    fi

    echo "[문법 검증 성공 - ESLint] $FILE"
    exit 0
fi

# ESLint 미설치 시: frontend/admin JSX 파일은 Vite 영역 → 스킵
if echo "$FILE" | grep -qE '(frontend|admin)/'; then
    echo "[문법 검사 스킵] JSX 파일은 Vite 개발 서버에서 검증됩니다: $FILE"
    exit 0
fi

# backend JS 파일은 node --check 으로 검증
RESULT=$(node --check "$FILE" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "문법 오류 감지 - 다음 오류를 수정해주세요:"
    echo "$RESULT"
    exit 1
fi

echo "[문법 검증 성공 - node] $FILE"
exit 0
