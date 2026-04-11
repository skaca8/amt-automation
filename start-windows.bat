@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   High1 Resort 예약 플랫폼 - 설치 및 실행
echo ==========================================
echo.

REM 1단계: 의존성 설치
echo [1/4] 백엔드 패키지를 설치합니다...
cd backend
call npm install
cd ..

echo [2/4] 사용자 홈페이지 패키지를 설치합니다...
cd frontend
call npm install
cd ..

echo [3/4] 관리자 페이지 패키지를 설치합니다...
cd admin
call npm install
cd ..

REM 2단계: 데이터베이스 생성
echo [4/4] 샘플 데이터를 생성합니다...
cd backend
if not exist "data\high1.db" (
    call node src/seed.js
)
cd ..

echo.
echo ==========================================
echo   설치 완료! 이제 서버를 시작합니다...
echo ==========================================
echo.

REM 3단계: 서버 시작
start "High1 Backend" cmd /k "cd backend && node src/index.js"
timeout /t 3 /nobreak >nul

start "High1 Frontend" cmd /k "cd frontend && npx vite --port 3000"
timeout /t 2 /nobreak >nul

start "High1 Admin" cmd /k "cd admin && npx vite --port 3001"
timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   모든 서비스가 시작되었습니다!
echo ==========================================
echo.
echo   사용자 홈페이지:  http://localhost:3000
echo   관리자 페이지:    http://localhost:3001
echo.
echo   테스트 계정:
echo   - 관리자: admin@high1.com / admin123
echo   - 고객:   guest@test.com / test123
echo.
echo   종료하려면 열린 검은 창들을 모두 닫으세요.
echo ==========================================
echo.
pause
