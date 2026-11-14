# 菊堂排語 열람 파일럿 (로컬 실행용)

『국당배어』 1~20화를 화별로 읽는 웹페이지입니다. 시간 표지(`<date>`)와 인물(`<persName>`)을 본문에서 구별해 보여 주고, 커서를 올리면 정규화 값·생몰년 등을 보여 줍니다.

## 폴더 구성

```
gukdang-viewer/
├─ index.html                 페이지 뼈대
├─ css/style.css              모양(색·글꼴·배치)
├─ js/app.js                  TEI 읽기, 본문·툴팁·연표·범례 그리기
├─ data/
│   └─ gukdang_baeeo_1-20.tei.xml   본문 데이터 (TEI)
├─ start-windows.bat          Windows용 실행 파일
├─ start-mac.command          macOS용 실행 파일
└─ README.md
```

페이지는 열릴 때 `data/gukdang_baeeo_1-20.tei.xml`을 읽어서 화면을 만듭니다. 본문을 고치려면 이 XML만 고치고 브라우저를 새로고침하면 됩니다.

## 실행 방법

`index.html`을 더블클릭해서 열면 브라우저 보안 규칙 때문에 XML을 읽지 못합니다. 아래 방법 중 하나로 **로컬 웹 서버**를 켜고 `http://localhost:8000`으로 여세요. Python만 있으면 됩니다(3.x, macOS와 대부분의 Linux에는 기본 설치).

### 방법 1. 실행 파일 더블클릭

- **Windows**: `start-windows.bat` 더블클릭 → 브라우저가 열립니다. 검은 창은 서버이므로 보는 동안 닫지 마세요.
- **macOS**: `start-mac.command` 더블클릭. 처음에 "확인되지 않은 개발자" 경고가 뜨면 파일을 우클릭 → 열기 → 열기를 누르세요. 실행 권한 오류가 나면 터미널에서 `chmod +x start-mac.command`를 한 번 실행합니다.

### 방법 2. 터미널에서 직접

```bash
cd gukdang-viewer          # 이 폴더로 이동
python3 -m http.server 8000   # Windows에서는: py -m http.server 8000
```

그다음 브라우저에서 <http://localhost:8000> 을 엽니다. 서버를 끌 때는 터미널에서 `Ctrl + C`.

### 방법 3. VS Code

확장 프로그램 **Live Server**를 설치하고 `index.html`을 연 뒤 오른쪽 아래 **Go Live**를 누릅니다. XML을 저장하면 페이지가 자동으로 새로고침됩니다.

## 웹으로 발행하기 (GitHub Pages)

이 폴더는 정적 파일로만 되어 있어서 GitHub Pages에 올리면 그대로 웹사이트가 됩니다. 이때는 위의 로컬 서버가 필요 없습니다.

1. GitHub에서 새 저장소를 만듭니다(예: `gukdang-viewer`). 무료 계정이면 **Public**이어야 Pages를 쓸 수 있습니다.
2. 저장소 화면에서 **Add file → Upload files**를 누르고, 이 폴더의 **내용물**(index.html, css, js, data, README.md 등)을 끌어다 놓은 뒤 **Commit changes**를 누릅니다. `index.html`이 저장소 맨 위에 있어야 합니다. 폴더 자체를 올리면 주소가 한 단계 깊어집니다.
3. **Settings → Pages → Build and deployment**에서 Source를 **Deploy from a branch**, Branch를 **main / (root)**로 고르고 **Save**를 누릅니다.
4. 1~2분 뒤 같은 화면 위쪽에 주소가 나옵니다: `https://<GitHub아이디>.github.io/<저장소이름>/`

발행한 뒤 XML을 고치려면 GitHub에서 `data/gukdang_baeeo_1-20.tei.xml`을 열어 연필 아이콘으로 고치거나 새 파일을 다시 올리면 됩니다. 커밋할 때마다 사이트가 자동으로 다시 발행됩니다. 바뀐 내용이 안 보이면 브라우저에서 강력 새로고침(Ctrl+Shift+R, macOS는 Cmd+Shift+R)을 하세요.

`.nojekyll`은 GitHub의 Jekyll 변환을 건너뛰게 하는 빈 파일입니다. 업로드에서 빠져도 사이트는 동작합니다.

## 서버 없이 잠깐 볼 때

`index.html`을 그냥 열면 본문 자리에 안내문이 나옵니다. 이때 오른쪽 패널의 **XML 파일 열기**로 `data/gukdang_baeeo_1-20.tei.xml`을 고르면 서버 없이도 읽을 수 있습니다(새로고침하면 다시 골라야 합니다).

## 데이터 바꾸기

- 21화 이후를 추가할 때는 같은 XML 파일에 `<div type="story" n="21">`을 이어 쓰면 왼쪽 목록에 자동으로 붙습니다.
- 다른 파일 이름을 기본으로 쓰려면 `js/app.js` 맨 위의 `DATA_URL` 한 줄을 바꿉니다.
- 오른쪽 **데이터 점검**에는 XML을 읽으면서 찾은 문제가 나옵니다. 숫자가 아닌 연도 값, 원문 간지와 서기 값 불일치, 없는 `@ref`, `@type`/`@role` 값 오류 등을 확인합니다.

## 참고

- 글꼴(Noto Serif KR/TC, IBM Plex Sans KR)은 Google Fonts에서 받아 옵니다. 인터넷이 끊겨 있으면 컴퓨터에 깔린 명조·고딕 글꼴로 대신 보입니다. 일부 벽자(錧, 獜, ⿔ 등)는 글꼴에 따라 빈칸으로 보일 수 있습니다.
- 8000번 포트를 이미 쓰고 있다는 오류가 나면 `8000` 대신 `8080` 등 다른 번호를 쓰고, 주소도 그 번호로 바꿉니다.
- 화 이동: 왼쪽 목록, 이전·다음 버튼, 키보드 ← →. 주소 끝의 `#s5`처럼 화 번호로 바로 갈 수 있습니다.
