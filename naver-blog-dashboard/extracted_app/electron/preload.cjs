'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // API key management
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Open URLs in default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Image server: 이미지들을 로컬 HTTP 서버에 저장, 포트 반환
  storeImages: (images) => ipcRenderer.invoke('store-images', images),
  getImageServerPort: () => ipcRenderer.invoke('get-image-server-port'),

  // Naver editor window (allowRunningInsecureContent: true)
  openNaverEditor: (url) => ipcRenderer.invoke('open-naver-editor', url),

  // 네이버 직접 붙여넣기용 HTML (base64 이미지 포함)
  storeNaverHtml: (html) => ipcRenderer.invoke('store-naver-html', html),
  getNaverHtml: () => ipcRenderer.invoke('get-naver-html'),

  // 웹뷰에 Ctrl+V 자동 발송 (기사 넘기기)
  pasteInNaverWebview: () => ipcRenderer.invoke('paste-in-naver-webview'),

  // 네이버 에디터 제목 자동 입력
  fillNaverTitle: (title) => ipcRenderer.invoke('fill-naver-title', title),

  // 제목+본문 통합 붙여넣기 (클립보드 경유)
  pasteTitleThenBody: (title, bodyHtml, captions) => ipcRenderer.invoke('paste-title-then-body', { title, bodyHtml, captions }),

  // 파일 업로드 다이얼로그
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // 이미지 네이버 CDN 업로드 (클립보드 이미지 붙여넣기)
  uploadImagesToNaver: (imageList) => ipcRenderer.invoke('upload-images-to-naver', imageList),

  // 나머지 세그먼트 순차 붙여넣기 (텍스트·이미지 번갈아)
  pasteRemainingSegments: (segments) => ipcRenderer.invoke('paste-remaining-segments', segments),

  // AI 설정 (provider + model) 영속
  getAiSettings: () => ipcRenderer.invoke('get-ai-settings'),
  setAiSettings: (settings) => ipcRenderer.invoke('set-ai-settings', settings),

  // 네이티브 드래그 (이미지 → Naver 에디터 파일 업로드)
  saveImageToTemp: (dataUrl) => ipcRenderer.invoke('save-image-to-temp', dataUrl),
  triggerNativeDrag: (filePath, altTag) => ipcRenderer.send('trigger-native-drag', { filePath, altTag }),
});
