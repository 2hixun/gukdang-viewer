#!/bin/bash
# 이 폴더에서 로컬 웹 서버를 켜고 브라우저로 엽니다. 터미널 창을 닫거나 Ctrl+C를 누르면 서버가 꺼집니다.
cd "$(dirname "$0")"
( sleep 1; open "http://localhost:8000" ) &
python3 -m http.server 8000
