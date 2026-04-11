#!/bin/bash
# ============================================
# High1 Resort 예약 플랫폼 - 원클릭 실행 스크립트
# ============================================

echo ""
echo "=========================================="
echo "  High1 Resort 예약 플랫폼을 시작합니다!"
echo "=========================================="
echo ""

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")"

# 1단계: 백엔드 서버 시작
echo "[1/3] 백엔드 서버를 시작합니다..."
cd backend

# 이전에 실행 중인 서버가 있으면 종료
if lsof -ti:4000 > /dev/null 2>&1; then
  echo "  - 기존 서버를 종료합니다..."
  kill $(lsof -ti:4000) 2>/dev/null
  sleep 1
fi

# 데이터베이스 시드 (처음 실행 시 샘플 데이터 생성)
if [ ! -f "data/high1.db" ]; then
  echo "  - 데이터베이스를 생성하고 샘플 데이터를 넣습니다..."
  node src/seed.js
fi

# 백엔드 서버를 백그라운드에서 실행
node src/index.js &
BACKEND_PID=$!
echo "  - 백엔드 서버 시작 완료! (포트: 4000)"
cd ..

sleep 2

# 2단계: 사용자 홈페이지 시작
echo "[2/3] 사용자 홈페이지를 시작합니다..."
cd frontend

# 이전에 실행 중인 서버가 있으면 종료
if lsof -ti:3000 > /dev/null 2>&1; then
  kill $(lsof -ti:3000) 2>/dev/null
  sleep 1
fi

npx vite --port 3000 --host &
FRONTEND_PID=$!
echo "  - 사용자 홈페이지 시작 완료! (포트: 3000)"
cd ..

sleep 2

# 3단계: 관리자 페이지 시작
echo "[3/3] 관리자 페이지를 시작합니다..."
cd admin

# 이전에 실행 중인 서버가 있으면 종료
if lsof -ti:3001 > /dev/null 2>&1; then
  kill $(lsof -ti:3001) 2>/dev/null
  sleep 1
fi

npx vite --port 3001 --host &
ADMIN_PID=$!
echo "  - 관리자 페이지 시작 완료! (포트: 3001)"
cd ..

sleep 2

echo ""
echo "=========================================="
echo "  모든 서비스가 시작되었습니다!"
echo "=========================================="
echo ""
echo "  사용자 홈페이지:  http://localhost:3000"
echo "  관리자 페이지:    http://localhost:3001"
echo "  백엔드 API:       http://localhost:4000"
echo ""
echo "  테스트 계정:"
echo "  - 관리자: admin@high1.com / admin123"
echo "  - 고객:   guest@test.com / test123"
echo ""
echo "  종료하려면 Ctrl+C 를 누르세요."
echo "=========================================="
echo ""

# Ctrl+C로 종료 시 모든 프로세스 정리
cleanup() {
  echo ""
  echo "서버를 종료합니다..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  kill $ADMIN_PID 2>/dev/null
  echo "모든 서비스가 종료되었습니다. 안녕히 가세요!"
  exit 0
}

trap cleanup SIGINT SIGTERM

# 백그라운드 프로세스가 실행되는 동안 대기
wait
