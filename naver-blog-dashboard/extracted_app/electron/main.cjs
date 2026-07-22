'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu, dialog, session, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const os = require('os');

const isDev = process.env.NODE_ENV === 'development';

// ─────────────────────────────────────────────
// License system — 해시만 저장, 원문 코드 없음
// ─────────────────────────────────────────────
// Salt: char code 배열로 저장 (문자열 직접 노출 방지)
const _k = [115,118,50,54,45,107,97,117,116,104,45,57,120];
const _getSalt = () => _k.map(c => String.fromCharCode(c)).join('');

// 월별 SHA-256 해시 테이블 (원문 코드 비포함)
const _LH = {
  '2026-05':'e446d21b7f2dd62acdaab8e8346a478aa51d768996fc9cbd550ca3c88f195edd',
  '2026-06':'c631e3add29ea43447b55afd41253098917c435a451aacb228533d314b8ce922',
  '2026-07':'f5d31d4480d92f41269e61f5e6124803ede3b9064c96aa7a2e9f51850877ecdb',
  '2026-08':'f7a3143a55c79229d7a68135dc39347448903755d1adf083fa9266ec31b978c4',
  '2026-09':'e4fc0607e561466aee3e22c62da0723c55ecc8d641abc31b559d4a20e53fbd20',
  '2026-10':'f9f00dae8e9c8f5ea791111e2883bd8053eababa403d8d3b40ead9056a9a2256',
  '2026-11':'255454d31df56653f89da71054d8df812f5c6a195234872d999e0aa000d86c07',
  '2026-12':'d6f0114459a990582e45f0c6795ee8fe3fd7a9c8449cb6dc756a3ecf23d763af',
  '2027-01':'195115d35e60c05187f4b127d0a83a342a94a31e32d0a0e128f2c41353461f85',
  '2027-02':'0a4947cc5a161996e42ddc015b2885c9ebb20136c48eaf7a4f138fede5833dd1',
  '2027-03':'d11d92f342f164baeca62094a5016f528701263a01ad082bb5f5b53d2ece7ad2',
  '2027-04':'1c41ca062fbe6d3cb5d4121d417964a2e300f1246f86fe66ffd07dba41df162c',
  '2027-05':'cea36de43b633ee90b52ce72ba8732128a3406d0805bb93aca92718f8b73ad68',
  '2027-06':'7142009cdbf0d7317c078b4ce006ca0e7fbdd28d71b2b81f59e7a51ade9d3cf9',
  '2027-07':'ecc4a1c8bfd3db0152a79b6fe15cbb612642dd190396db820d6943cf2c58b407',
  '2027-08':'d96f2c747bb861001aaa818589e61af6e0f4d2700dc2cfb663542ae4f2ff6737',
  '2027-09':'4f7442792ed8b08e9fc4bf3ef45ba71e817b0aa5d9653feaca70dac73cac4d6b',
  '2027-10':'dc5f7a3c77691f69ef96f28a77c92f05f3aef7cf9fed7855279afa2f8ef40656',
  '2027-11':'f8d8e2afe7461abd117484a26a1fc4f4f98375b212bc19666b1b6b822fef2319',
  '2027-12':'869f139880419c0a93f7c0a3331ad00a426d0fabb3c6ffffad71a086b0767dd7',
};

function _hashInput(code) {
  return crypto.createHash('sha256').update(_getSalt() + code.trim().toLowerCase()).digest('hex');
}

function _getExpectedHash(year, month) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return _LH[key] || null;
}

// 인터넷 시간 가져오기 (여러 소스 시도)
async function fetchInternetTime() {
  const sources = [
    { url: 'https://worldtimeapi.org/api/ip', parse: d => new Date(d.datetime) },
    { url: 'https://worldtimeapi.org/api/timezone/Asia/Seoul', parse: d => new Date(d.datetime) },
    { url: 'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Seoul', parse: d => new Date(d.dateTime) },
    { url: 'https://timeapi.io/api/Time/current/ip', parse: d => new Date(d.dateTime) },
  ];
  for (const src of sources) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(src.url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      const dt = src.parse(json);
      if (!isNaN(dt.getTime())) {
        console.log('[License] Internet time from', src.url, ':', dt.toISOString());
        return dt;
      }
    } catch {}
  }
  return null;
}

// 라이선스 검증 창
function showAuthWindow(year, month, expectedHash) {
  return new Promise((resolve) => {
    let verified = false;

    const authWin = new BrowserWindow({
      width: 400,
      height: 310,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'auth-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      title: '인증 코드 입력',
      backgroundColor: '#f8fafc',
      show: false,
    });

    authWin.setMenu(null);

    const verifyHandler = (_e, code) => {
      const h = _hashInput(code);
      if (h === expectedHash) {
        verified = true;
        // 설정에 저장
        const cfg = readConfig();
        cfg._lv = { y: year, m: month, h: expectedHash };
        writeConfig(cfg);
        ipcMain.removeListener('auth-verify', verifyHandler);
        authWin.close();
      } else {
        if (!authWin.isDestroyed()) {
          authWin.webContents.send('auth-error', '잘못된 인증 코드입니다. 다시 확인해 주세요.');
        }
      }
    };

    const quitHandler = () => {
      ipcMain.removeListener('auth-verify', verifyHandler);
      ipcMain.removeListener('auth-quit', quitHandler);
      app.quit();
    };

    ipcMain.on('auth-verify', verifyHandler);
    ipcMain.once('auth-quit', quitHandler);

    authWin.loadFile(path.join(__dirname, 'auth.html'));
    authWin.once('ready-to-show', () => {
      authWin.show();
      authWin.webContents.send('init', { year, month });
    });

    authWin.on('closed', () => {
      ipcMain.removeListener('auth-verify', verifyHandler);
      ipcMain.removeListener('auth-quit', quitHandler);
      resolve(verified);
    });
  });
}

// 라이선스 체크 메인 로직
async function checkLicense() {
  // 인터넷 시간 가져오기
  const now = await fetchInternetTime();

  if (!now) {
    // 인터넷 연결 실패
    const cfg = readConfig();
    const stored = cfg._lv;
    // 이미 이번 달 인증된 경우 오프라인 허용 (로컬 시간으로만 체크)
    if (stored) {
      const localNow = new Date();
      const ly = localNow.getFullYear(), lm = localNow.getMonth() + 1;
      const eh = _getExpectedHash(ly, lm);
      if (ly < 2026 || (ly === 2026 && lm < 5)) return true;
      if (stored.y === ly && stored.m === lm && stored.h === eh) {
        console.log('[License] Offline, using cached verification');
        return true;
      }
    }
    const r = await dialog.showMessageBox({
      type: 'warning',
      title: '인터넷 연결 필요',
      message: '인증을 위해 인터넷 연결이 필요합니다.',
      detail: '인터넷에 연결한 후 재시도하거나, 앱을 종료하세요.',
      buttons: ['재시도', '앱 종료'],
      defaultId: 0,
    });
    if (r.response === 0) return checkLicense();
    app.quit();
    return false;
  }

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 2026년 5월 이전은 인증 불필요
  if (year < 2026 || (year === 2026 && month < 5)) {
    console.log('[License] Pre-release period, no auth needed');
    return true;
  }

  const expectedHash = _getExpectedHash(year, month);
  if (!expectedHash) {
    await dialog.showMessageBox({
      type: 'error',
      title: '라이선스 만료',
      message: '이 버전의 라이선스가 만료되었습니다.',
      detail: '공식 사이트에서 최신 버전을 다운로드하세요.',
      buttons: ['확인'],
    });
    app.quit();
    return false;
  }

  // 저장된 인증 확인
  const cfg = readConfig();
  const stored = cfg._lv;
  if (stored && stored.y === year && stored.m === month && stored.h === expectedHash) {
    console.log('[License] Valid cached auth for', year, month);
    return true;
  }

  // 인증 창 표시
  console.log('[License] Showing auth window for', year, month);
  return showAuthWindow(year, month, expectedHash);
}

// ─────────────────────────────────────────────
// Config persistence
// ─────────────────────────────────────────────
const getConfigPath = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Config write error:', err);
  }
}

// ─────────────────────────────────────────────
// Local image HTTP server
// ─────────────────────────────────────────────
const imageStore = new Map();
let imageServerPort = 0;

function startImageServer() {
  const server = http.createServer((req, res) => {
    const id = decodeURIComponent(req.url.slice(1));
    const img = imageStore.get(id);
    if (img) {
      res.writeHead(200, {
        'Content-Type': img.mime,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(img.data);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(0, '127.0.0.1', () => {
    imageServerPort = server.address().port;
    console.log(`[Image Server] Running on port ${imageServerPort}`);
  });
}

// ─────────────────────────────────────────────
// Window state persistence
// ─────────────────────────────────────────────
function getWindowState() {
  const cfg = readConfig();
  return cfg.windowState || { width: 1400, height: 900 };
}

function saveWindowState(win) {
  const { width, height, x, y } = win.getBounds();
  const isMaximized = win.isMaximized();
  const cfg = readConfig();
  cfg.windowState = { width, height, x, y, isMaximized };
  writeConfig(cfg);
}

// ─────────────────────────────────────────────
// Main window
// ─────────────────────────────────────────────
let mainWindow;
let naverWebviewContents = null;

function createWindow() {
  const winState = getWindowState();

  mainWindow = new BrowserWindow({
    width: winState.width || 1400,
    height: winState.height || 900,
    x: winState.x,
    y: winState.y,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      allowRunningInsecureContent: true,
    },
    title: '네이버 블로그 SEO 최적화 도우미',
    backgroundColor: '#f4f4f5',
    show: false,
  });

  if (winState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // webview 내부 새창 → webview 자신에서 로드 (네이버 에디터 새창 방지)
  mainWindow.webContents.on('did-attach-webview', (_event, wvContents) => {
    naverWebviewContents = wvContents;

    wvContents.setWindowOpenHandler(({ url }) => {
      console.log('[webview new-window]', url);
      setImmediate(() => wvContents.loadURL(url));
      return { action: 'deny' };
    });

    wvContents.on('destroyed', () => {
      if (naverWebviewContents === wvContents) naverWebviewContents = null;
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5177');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5177' : 'file://';
    if (!url.startsWith(appUrl) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────
// Naver editor window (fallback — 별도창)
// ─────────────────────────────────────────────
let naverWindow = null;

function openNaverEditorWindow(url) {
  if (naverWindow && !naverWindow.isDestroyed()) {
    naverWindow.focus();
    if (url) naverWindow.loadURL(url);
    return;
  }

  naverWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      allowRunningInsecureContent: true,
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '네이버 블로그 에디터',
    backgroundColor: '#ffffff',
  });

  naverWindow.loadURL(url || 'https://blog.naver.com');

  naverWindow.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    if (newUrl.includes('naver.com')) return { action: 'allow' };
    return { action: 'deny' };
  });

  naverWindow.on('closed', () => { naverWindow = null; });
}

// ─────────────────────────────────────────────
// Application menu
// ─────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        { label: '새 창', accelerator: 'CmdOrCtrl+N', click() { createWindow(); } },
        { type: 'separator' },
        { label: '종료', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click() { app.quit(); } },
      ],
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '전체 선택', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: '새로고침', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '강제 새로고침', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '기본 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '전체 화면', accelerator: 'F11', role: 'togglefullscreen' },
        ...(isDev ? [
          { type: 'separator' },
          { label: '개발자 도구', accelerator: 'F12', role: 'toggleDevTools' },
        ] : []),
      ],
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '앱 버전',
          click() {
            let changelog = '';
            try {
              const clPath = path.join(app.getAppPath(), 'CHANGELOG.md');
              if (fs.existsSync(clPath)) {
                changelog = '\n\n── 변경이력 ──\n' + fs.readFileSync(clPath, 'utf-8').replace(/^# .+\n*/m, '').trim();
              }
            } catch (_) {}
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '앱 정보',
              message: '네이버 블로그 SEO 최적화 도우미',
              detail: `버전: ${app.getVersion()}\nPowered by Google Gemini AI\n\nGPT PARK${changelog}`,
              buttons: ['확인'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─────────────────────────────────────────────
// IPC handlers
// ─────────────────────────────────────────────

ipcMain.handle('get-api-key', () => readConfig().geminiApiKey || '');
ipcMain.handle('set-api-key', (_e, key) => {
  const cfg = readConfig(); cfg.geminiApiKey = key; writeConfig(cfg); return true;
});

ipcMain.handle('get-ai-settings', () => {
  const cfg = readConfig();
  return {
    provider: cfg.aiProvider || 'gemini',
    model: cfg.aiModel || 'gemini-3-flash-preview',
    imageModel: cfg.aiImageModel || 'gemini-2.5-flash-image',
    geminiImageModel: cfg.geminiImageModel || 'gemini-2.5-flash-image',
  };
});
ipcMain.handle('set-ai-settings', (_e, { provider, model, imageModel, geminiImageModel }) => {
  const cfg = readConfig();
  cfg.aiProvider = provider;
  cfg.aiModel = model;
  if (imageModel) cfg.aiImageModel = imageModel;
  if (geminiImageModel) cfg.geminiImageModel = geminiImageModel;
  writeConfig(cfg);
  return true;
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);

ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));

// 파일 업로드 다이얼로그 (기존글로 최적화 탭)
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    title: '문서 파일 열기',
    filters: [
      { name: '문서 파일', extensions: ['txt', 'html', 'htm', 'md'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  let content = fs.readFileSync(filePath, 'utf-8');
  if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                     .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                     .replace(/<[^>]*>/g, '\n')
                     .replace(/&nbsp;/g, ' ')
                     .replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&quot;/g, '"')
                     .replace(/\n{3,}/g, '\n\n')
                     .trim();
  }
  return { content, fileName: path.basename(filePath) };
});

// ── Image server ──────────────────────────────
ipcMain.handle('store-images', (_e, images) => {
  imageStore.clear();
  for (const [id, img] of Object.entries(images)) {
    const dataUrl = img.imageUrl;
    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
    if (!mimeMatch) continue;
    const mime = mimeMatch[1];
    const base64 = dataUrl.slice(mimeMatch[0].length);
    imageStore.set(id, { data: Buffer.from(base64, 'base64'), mime });
  }
  return imageServerPort;
});

ipcMain.handle('get-image-server-port', () => imageServerPort);

// ── 이미지 네이티브 드래그 (→ Naver 에디터 파일 업로드) ──
// STEP1: 이미지 dataUrl → 임시 파일로 저장 (이미지 생성 완료 시 호출)
ipcMain.handle('save-image-to-temp', async (_e, dataUrl) => {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return null;
    const ext = match[1].includes('png') ? 'png' : 'jpg';
    const tmpPath = path.join(os.tmpdir(), `naver-drag-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, Buffer.from(match[2], 'base64'));
    return tmpPath;
  } catch (e) {
    console.error('[save-image-to-temp]', e);
    return null;
  }
});

// STEP2: dragstart 이벤트에서 호출 — native drag 시작 + 에디터 내 기존 이미지 제거
ipcMain.on('trigger-native-drag', (event, { filePath, altTag }) => {
  // native drag는 시간에 민감 → 가장 먼저 실행
  try {
    event.sender.startDrag({ file: filePath, icon: filePath });
  } catch (e) {
    console.error('[trigger-native-drag] startDrag 실패:', e);
  }

  // 에디터에서 alt 태그가 일치하는 localhost 이미지 제거 (fire-and-forget)
  if (!naverWebviewContents || naverWebviewContents.isDestroyed()) return;
  const removeScript = `(function(){
    var alt=${JSON.stringify(altTag)};
    var imgs=document.querySelectorAll('img[src*="localhost"]');
    for(var i=0;i<imgs.length;i++){
      if(imgs[i].alt===alt){
        var c=imgs[i].closest&&(imgs[i].closest('.se-component')||imgs[i].closest('.se-image-container')||imgs[i].closest('figure'));
        (c||imgs[i]).remove(); return true;
      }
    }
    return false;
  })();`;
  naverWebviewContents.executeJavaScript(removeScript).catch(() => {});
  try {
    const frames = collectFrames(naverWebviewContents.mainFrame);
    const pwf = frames.find(f => (f.url || '').includes('PostWriteForm'));
    if (pwf) pwf.executeJavaScript(removeScript).catch(() => {});
  } catch (_) {}
});

// ── 네이버 직접 붙여넣기용 HTML 저장 ─────────────
let naverPasteHtml = '';
ipcMain.handle('store-naver-html', (_e, html) => { naverPasteHtml = html; return true; });
ipcMain.handle('get-naver-html', () => naverPasteHtml);

// ── Naver editor window ───────────────────────
ipcMain.handle('open-naver-editor', (_e, url) => {
  openNaverEditorWindow(url);
});

// 모든 WebFrameMain 재귀 수집 헬퍼
function collectFrames(frame) {
  const result = [frame];
  for (const child of (frame.frames || [])) result.push(...collectFrames(child));
  return result;
}

// ── 웹뷰에 Ctrl+V 자동 발송 (기사 넘기기) ────────
ipcMain.handle('paste-in-naver-webview', async () => {
  if (!naverWebviewContents || naverWebviewContents.isDestroyed()) {
    console.warn('[paste-in-naver-webview] 웹뷰 없음');
    return false;
  }
  try {
    naverWebviewContents.focus();
    await new Promise(r => setTimeout(r, 200));
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });
    console.log('[paste-in-naver-webview] Ctrl+V 발송 완료');
    return true;
  } catch (e) {
    console.error('[paste-in-naver-webview]', e);
    return false;
  }
});

// ── 제목 클립보드 경유 붙여넣기 ──────────────────
// 페이지 로딩 완료 + 리다이렉트 종료를 기다린 뒤 제목/본문 순서로 붙여넣기
ipcMain.handle('paste-title-then-body', async (_e, { title, bodyHtml, captions }) => {
  if (!naverWebviewContents || naverWebviewContents.isDestroyed()) {
    console.warn('[paste] 웹뷰가 없습니다. 네이버 쓰기 창을 먼저 열어주세요.');
    return false;
  }

  try {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const titleText = String(title);

    // ── STEP 1: GoBlogWrite 리다이렉트 완료 대기 ──────────────────
    for (let i = 0; i < 30; i++) {
      const url  = naverWebviewContents.getURL?.() || '';
      const busy = naverWebviewContents.isLoading?.() ?? false;
      if (!busy && !url.includes('GoBlogWrite') && url !== '') break;
      await sleep(500);
    }
    await sleep(500);

    // ── STEP 2: 웹뷰 포커스 + 제목란 자동 포커스 ─────────────────
    naverWebviewContents.focus();
    await sleep(150);

    // PostWriteForm 프레임 내부에서 JS로 제목 영역 클릭
    // → 프레임 내부 좌표 사용 (화면 크기 무관)
    try {
      const allFrames = collectFrames(naverWebviewContents.mainFrame);
      const pwfFrame = allFrames.find(f => (f.url || '').includes('PostWriteForm'));
      if (pwfFrame) {
        const clickResult = await pwfFrame.executeJavaScript(`
          (function() {
            const w = document.documentElement.clientWidth || 800;

            function tryClick(el, y) {
              if (!el) return false;
              // mousedown → mouseup → click 순서로 발송 (SmartEditor ONE 이벤트 체계 대응)
              ['mousedown','mouseup','click'].forEach(type => {
                el.dispatchEvent(new MouseEvent(type, {
                  bubbles: true, cancelable: true, view: window,
                  clientX: w / 2, clientY: y
                }));
              });
              el.focus && el.focus();
              return true;
            }

            // 1) 선택자 기반 (SmartEditor ONE 제목 요소)
            const sels = ['.se-title-input','[data-se-type="title"]','.se-input-title',
                          '[data-placeholder*="제목"]','[placeholder*="제목"]'];
            for (const sel of sels) {
              const el = document.querySelector(sel);
              if (el && tryClick(el, el.getBoundingClientRect().top + 10)) return 'sel:' + sel;
            }

            // 2) elementFromPoint — 툴바(~120px) 이후 제목 영역을 프레임 내 고정 y로 탐색
            for (const y of [140, 155, 125, 170, 110]) {
              const el = document.elementFromPoint(w / 2, y);
              if (el && tryClick(el, y))
                return 'efp:y=' + y + ':' + el.tagName + ':' + el.className.slice(0, 50);
            }
            return 'not-found';
          })()`);
        console.log('[paste] 제목 자동 포커스:', clickResult);
        await sleep(400);
      }
    } catch (e) { /* 포커스 실패 시 무시 — 사용자가 수동으로 제목란 클릭 */ }

    // ── STEP 3: 제목 먼저 붙여넣기 ────────────────────────────────
    // 클립보드 plain text → Ctrl+A(전체선택) → Ctrl+V(붙여넣기)
    clipboard.writeText(titleText);
    await sleep(100);
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['Control'] });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'A', modifiers: ['Control'] });
    await sleep(80);
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });
    await sleep(600); // 제목 입력 후 안정화 대기

    // ── STEP 4: 본문 영역으로 포커스 이동 ─────────────────────────
    // Enter 키: SmartEditor ONE에서 제목→본문으로 포커스 이동
    // (JS .focus()는 sendInputEvent 라우팅에 효과 없음 → 항상 Enter 키 사용)
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'Return' });
    await sleep(500);

    // ── STEP 5: 본문 HTML 클립보드에 쓰고 Ctrl+V ─────────────────
    clipboard.write({
      html: bodyHtml,
      text: bodyHtml.replace(/<[^>]+>/g, ''),
    });
    await sleep(200);
    // ※ naverWebviewContents.focus() 호출 생략 — 호출 시 포커스가 제목으로 돌아갈 수 있음
    naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
    naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });

    // ── STEP 6: 이미지 캡션 자동 입력 ──────────────────────────────
    // SmartEditor가 이미지를 렌더링할 때까지 대기 후 "사진 설명" 입력란에 alt 텍스트 입력
    if (captions && captions.filter(c => c).length > 0) {
      try {
        const allFrames = collectFrames(naverWebviewContents.mainFrame);
        const pwfFrame = allFrames.find(f => (f.url || '').includes('PostWriteForm'));
        if (pwfFrame) {
          let captionResult = 'not-found';
          // 이미지 서버 로드 + SmartEditor 렌더링 완료 대기 (최대 12초 폴링)
          for (let attempt = 0; attempt < 12; attempt++) {
            await sleep(1000);
            captionResult = await pwfFrame.executeJavaScript(`
              (function(captions) {
                // ── 전략 1: input 요소 (placeholder 텍스트로 탐색) ──
                let captionEls = Array.from(document.querySelectorAll('input'))
                  .filter(el => (el.placeholder || '').includes('사진 설명'));

                // ── 전략 2: contenteditable 요소 (.se-image-caption 내부) ──
                if (captionEls.length === 0) {
                  captionEls = Array.from(
                    document.querySelectorAll('.se-image-caption [contenteditable], .se-image-caption p, .se-image-caption div')
                  ).filter(el => el.isContentEditable || el.getAttribute('contenteditable') === 'true');
                }

                // ── 전략 3: se-placeholder 클래스가 있는 contenteditable ──
                if (captionEls.length === 0) {
                  captionEls = Array.from(
                    document.querySelectorAll('[contenteditable]')
                  ).filter(el => {
                    const cls = (el.className || '');
                    return cls.includes('caption') || cls.includes('se-placeholder') ||
                           cls.includes('description') || cls.includes('desc');
                  });
                }

                // ── 전략 4: 이미지 컴포넌트 내부의 첫 번째 빈 contenteditable ──
                if (captionEls.length === 0) {
                  const imgComponents = document.querySelectorAll(
                    '.se-component.se-image, [data-se-type="image"], .se-image'
                  );
                  captionEls = Array.from(imgComponents).map(comp => {
                    return comp.querySelector('[contenteditable]');
                  }).filter(Boolean);
                }

                if (captionEls.length === 0) {
                  // 디버깅: 현재 DOM에 있는 모든 input과 contenteditable 목록 반환
                  const inputs = Array.from(document.querySelectorAll('input')).map(el =>
                    'INPUT:' + (el.placeholder || '(no-ph)') + ':' + el.className.slice(0, 30)
                  );
                  const ces = Array.from(document.querySelectorAll('[contenteditable]')).map(el =>
                    'CE:' + el.tagName + ':' + el.className.slice(0, 40) + ':' + el.textContent.slice(0, 20)
                  );
                  return 'not-found|' + [...inputs, ...ces].slice(0, 10).join(' | ');
                }

                let filled = 0;
                captionEls.forEach((el, i) => {
                  const text = captions[i] || '';
                  if (!text) return;

                  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    // input: React native setter로 값 주입
                    const nativeSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLInputElement.prototype, 'value'
                    )?.set;
                    if (nativeSetter) nativeSetter.call(el, text);
                    else el.value = text;
                    el.dispatchEvent(new Event('input',  { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                  } else {
                    // contenteditable: focus → selectAll → insertText
                    el.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, text);
                    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
                  }
                  filled++;
                });
                return 'filled:' + filled + '/' + captionEls.length +
                       ' tag:' + (captionEls[0]?.tagName) +
                       ' cls:' + (captionEls[0]?.className || '').slice(0, 40);
              })(${JSON.stringify(captions)})`);
            console.log('[paste] 캡션 시도', attempt + 1, ':', captionResult);
            if (!captionResult.startsWith('not-found')) break;
          }
        }
      } catch (e) {
        console.warn('[paste] 캡션 입력 실패:', e.message);
      }
    }

    return true;
  } catch (e) {
    console.error('[paste-title-then-body]', e);
    return false;
  }
});

// ── 나머지 세그먼트 순차 붙여넣기 (pasteTitleThenBody 이후 호출) ──────
// 커서가 본문 끝에 있는 상태에서 텍스트·이미지 세그먼트를 순서대로 붙여넣기
ipcMain.handle('paste-remaining-segments', async (_e, segments) => {
  if (!naverWebviewContents || naverWebviewContents.isDestroyed()) {
    console.warn('[paste-segments] 웹뷰 없음');
    return false;
  }

  const { nativeImage } = require('electron');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    await sleep(1000);
    naverWebviewContents.focus();

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
        console.log('[paste-segments] 텍스트 세그먼트 붙여넣기 완료');

      } else if (seg.type === 'image') {
        const match = seg.dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) continue;

        const buf = Buffer.from(match[2], 'base64');
        const nImg = nativeImage.createFromBuffer(buf);
        if (nImg.isEmpty()) continue;

        // 줄바꿈 → 이미지 붙여넣기
        naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
        naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'Return' });
        await sleep(100);

        clipboard.writeImage(nImg);
        await sleep(100);
        naverWebviewContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['Control'] });
        naverWebviewContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['Control'] });
        imgCount++;

        // CDN 업로드 대기
        await sleep(1500);
        console.log('[paste-segments] 이미지', imgCount, '붙여넣기 완료');
      }
    }

    console.log('[paste-segments] 완료 — 이미지:', imgCount);
    return true;
  } catch (e) {
    console.error('[paste-remaining-segments]', e);
    return false;
  }
});

// ── 네이버 에디터 제목 입력 ──────────────────────
ipcMain.handle('fill-naver-title', async (_e, title) => {
  if (!naverWebviewContents || naverWebviewContents.isDestroyed()) return false;
  const escaped = JSON.stringify(String(title));

  // 비동기 IIFE: 에디터 로딩 대기 후 제목 주입 (최대 8초)
  const jsCode = `(async function() {
    const t = ${escaped};

    function tryFill() {
      // 1) input / textarea
      const inputSels = [
        'input[placeholder*="제목"]', 'textarea[placeholder*="제목"]',
        'input.se-title-input', '.se_input_title input',
        '#subject', '#post_subject',
        'input[name="title"]', 'input[id*="title"]', 'input[id*="subject"]',
        '.title_input input',
      ];
      for (const sel of inputSels) {
        const el = document.querySelector(sel);
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.focus();
          try {
            const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value');
            if (setter && setter.set) setter.set.call(el, t); else el.value = t;
          } catch { el.value = t; }
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          return 'ok:input:' + sel;
        }
      }

      // 2) contenteditable div (SE ONE / NEST)
      const divSels = [
        '.se-title-input', '[data-se-type="title"]', '.se-input-title',
        '[data-placeholder*="제목"]', '[placeholder*="제목"]',
        '.se_title [contenteditable]', '.se_wrap_title [contenteditable]',
        '[contenteditable][class*="title"]', '[contenteditable][id*="title"]',
      ];
      for (const sel of divSels) {
        const el = document.querySelector(sel);
        if (el) {
          el.focus();
          el.textContent = '';
          document.execCommand('insertText', false, t);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return 'ok:div:' + sel;
        }
      }

      // 3) 모든 contenteditable 중 높이 작은 것 (제목 = 한 줄)
      const allEdit = Array.from(document.querySelectorAll('[contenteditable="true"]'))
        .filter(el => el.offsetHeight > 0 && el.offsetHeight < 120);
      if (allEdit.length > 0) {
        const el = allEdit[0];
        el.focus();
        el.textContent = '';
        document.execCommand('insertText', false, t);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok:auto:h=' + el.offsetHeight;
      }

      // 4) iframe 내부 탐색
      for (const f of Array.from(document.querySelectorAll('iframe'))) {
        try {
          const doc = f.contentDocument; if (!doc) continue;
          for (const sel of inputSels) {
            const el = doc.querySelector(sel);
            if (el) { el.focus(); el.value = t;
              el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok:iframe-input'; }
          }
          for (const sel of divSels) {
            const el = doc.querySelector(sel);
            if (el) { el.focus(); el.textContent = '';
              doc.execCommand('insertText', false, t); return 'ok:iframe-div'; }
          }
        } catch {}
      }
      return null;
    }

    // 최대 16회 × 500ms = 8초 대기
    for (let i = 0; i < 16; i++) {
      const r = tryFill();
      if (r) return r;
      await new Promise(res => setTimeout(res, 500));
    }
    return JSON.stringify({
      notFound: true, url: location.href,
      editables: document.querySelectorAll('[contenteditable]').length,
      inputs: document.querySelectorAll('input,textarea').length,
    });
  })()`;

  try {
    const result = await naverWebviewContents.executeJavaScript(jsCode);
    console.log('[fill-naver-title]', result);
    return !String(result).startsWith('{');
  } catch (e) {
    console.error('[fill-naver-title]', e);
    return false;
  }
});

// ─────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  startImageServer();

  // persist:naver 세션 — CSP / X-Frame-Options 제거
  const naverSession = session.fromPartition('persist:naver');
  naverSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      if (['content-security-policy','content-security-policy-report-only','x-frame-options']
          .includes(key.toLowerCase())) {
        delete headers[key];
      }
    }
    callback({ responseHeaders: headers });
  });

  buildMenu();

  // 라이선스 체크 (인터넷 날짜 기준)
  const licensed = await checkLicense();
  if (!licensed) return;

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
