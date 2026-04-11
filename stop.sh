#!/bin/bash
# ============================================
# High1 Resort 예약 플랫폼 - 종료 스크립트
# ============================================

echo "High1 Resort 서비스를 종료합니다..."

# 각 포트에서 실행 중인 프로세스 종료
if lsof -ti:4000 > /dev/null 2>&1; then
  kill $(lsof -ti:4000) 2>/dev/null
  echo "  - 백엔드 서버 종료 완료"
fi

if lsof -ti:3000 > /dev/null 2>&1; then
  kill $(lsof -ti:3000) 2>/dev/null
  echo "  - 사용자 홈페이지 종료 완료"
fi

if lsof -ti:3001 > /dev/null 2>&1; then
  kill $(lsof -ti:3001) 2>/dev/null
  echo "  - 관리자 페이지 종료 완료"
fi

echo ""
echo "모든 서비스가 종료되었습니다!"
