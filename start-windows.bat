@echo off
rem 이 폴더에서 로컬 웹 서버를 켜고 브라우저로 엽니다. 창을 닫으면 서버가 꺼집니다.
chcp 65001 >nul
cd /d "%~dp0"
start "" "http://localhost:8000"
where py >nul 2>nul && (py -m http.server 8000) || (python -m http.server 8000)
pause
