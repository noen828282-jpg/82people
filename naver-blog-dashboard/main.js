const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');

let naverWebviewContents = null;

// electron-store 초기화 및 불러오기
let store;
try {
  const ElectronStore = require('electron-store');
  store = new ElectronStore();
} catch (e) {
  console.warn("electron-store 모듈을 불러오지 못했습니다. 인메모리 폴백 저장소를 사용합니다.", e);
  // 폴백용 임시 저장소 객체
  const tempStore = {};
  store = {
    get: (key, def) => tempStore[key] !== undefined ? tempStore[key] : def,
    set: (key, val) => tempStore[key] = val
  };
}

function createWindow() {
  // 1280x800 해상도의 창 생성
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // 네이버 블로그 스마트에디터 로드용 webview 사용 활성화
      webSecurity: false
    },
    autoHideMenuBar: true,
    title: "충주미세방충망 블로그 자동화 대시보드"
  });

  mainWindow.loadFile('renderer.html');

  // 렌더러 창의 콘솔 로그를 메인 프로세스 터미널로 중계 출력하여 디버깅을 극대화합니다.
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] (${level}) ${message} [${sourceId}:${line}]`);
  });

  // 웹뷰가 생성될 때 새창 열기 요청(window.open 등)을 가로채고, 웹뷰의 내부 로그도 터미널로 중계 출력합니다.
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    console.log("[MAIN] WebView attached to DOM.");
    naverWebviewContents = webContents;
    
    webContents.on('destroyed', () => {
      if (naverWebviewContents === webContents) naverWebviewContents = null;
    });
    
    webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[WEBVIEW CONSOLE] (${level}) ${message} [${sourceId}:${line}]`);
    });

    webContents.setWindowOpenHandler((details) => {
      console.log(`[WEBVIEW WINDOW OPEN DETECTED] URL: ${details.url}`);
      mainWindow.webContents.send('webview-redirect', details.url);
      return { action: 'deny' }; // 새 독립 창 생성 차단
    });
  });

  // 개발자 도구 비활성화 (필요 시 Ctrl+Shift+I로 실행 가능)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 설정 값 가져오기 및 저장하기 IPC 통신 바인딩
ipcMain.handle('get-config', (event, key, defaultValue) => {
  return store.get(key, defaultValue);
});

ipcMain.handle('set-config', (event, key, value) => {
  store.set(key, value);
  return true;
});

const fs = require('fs');

ipcMain.handle('write-diagnostic', (event, text) => {
  try {
    fs.writeFileSync(path.join(__dirname, 'diagnostic.txt'), text, 'utf8');
    return true;
  } catch (err) {
    console.error("진단 파일 쓰기 실패:", err);
    return false;
  }
});

// 모든 WebFrameMain 재귀 수집 헬퍼
function collectFrames(frame) {
  if (frame && typeof frame.framesInSubtree === 'object') {
    return frame.framesInSubtree;
  }
  const result = [frame];
  const children = frame ? (frame.childFrames || frame.frames || []) : [];
  for (const child of children) {
    result.push(...collectFrames(child));
  }
  return result;
}

// 제목 + 본문 통합 자동 타이핑/붙여넣기 시뮬레이션 핸들러 (순수 키보드/마우스 시뮬레이션 - 보안 우회 및 스크립팅 0%)
ipcMain.handle('paste-title-then-body', async (event, { title, segments }) => {
  if (!naverWebviewContents || naverWebviewContents.isDestroyed()) {
    console.warn('[paste] 네이버 웹뷰 인스턴스를 찾을 수 없습니다.');
    return false;
  }

  try {
    const { nativeImage } = require('electron');
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const titleText = String(title);

    // 1단계: 웹뷰 포커스 및 네이티브 대기
    naverWebviewContents.focus();
    await sleep(300);

    // 2단계: 스마트에디터 제목란이 있는 곳(일반적인 X: 400, Y: 160)에 순수 마우스 클릭 발송
    // 네이버 창 내의 DOM 요소나 iframe 구조를 탐색하지 않고, OS 수준의 클릭 이벤트만 전달합니다.
    const clickX = 400;
    const clickY = 160;

    naverWebviewContents.sendInputEvent({
      type: 'mouseDown',
      x: clickX,
      y: clickY,
      button: 'left',
      clickCount: 1
    });
    await sleep(50);
    naverWebviewContents.sendInputEvent({
      type: 'mouseUp',
      x: clickX,
      y: clickY,
      button: 'left',
      clickCount: 1
    });

    // 클릭 완료 대기
    await sleep(400);

    // 3단계: 제목 입력 실행 (클립보드에 복사 -> 전체선택 -> 붙여넣기 단축키 발송)
    clipboard.writeText(titleText);
    await sleep(100);
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['Control'] });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'A', modifiers: ['Control'] });
    await sleep(80);
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });
    await sleep(600);

    // 4단계: Return(Enter) 키 발송으로 제목란에서 본문란으로 포커스 이동
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'Return' });
    await sleep(500);

    // 5단계: 세그먼트 순차 붙여넣기 (HTML 텍스트와 이미지)
    let imgCount = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      if (seg.type === 'html') {
        clipboard.write({
          html: seg.html,
          text: seg.html.replace(/<[^>]+>/g, ''),
        });
        await sleep(100);
        naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
        naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });
        await sleep(400);

      } else if (seg.type === 'image') {
        const match = seg.dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) continue;

        const buf = Buffer.from(match[2], 'base64');
        const nImg = nativeImage.createFromBuffer(buf);
        if (nImg.isEmpty()) continue;

        // 줄바꿈 발송하여 새 컴포넌트 생성 유도
        naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
        naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'Return' });
        await sleep(150);

        clipboard.writeImage(nImg);
        await sleep(150);
        naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
        naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });
        imgCount++;

        // Naver의 CDN 업로드 시간 보장 대기 (1.5초)
        await sleep(1500);
        
        // 이미지 하단에 글 입력을 이어가기 위해 Enter 한 번 추가
        naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
        naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'Return' });
        await sleep(150);
      }
    }

    return true;
  } catch (err) {
    console.error('[AUTO-PASTE] Integrated copy-paste error:', err);
    return false;
  }
});
