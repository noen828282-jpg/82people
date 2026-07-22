const { contextBridge, ipcRenderer, clipboard } = require('electron');

// Renderer 프로세스에서 안전하게 사용할 수 있도록 Main 프로세스의 API를 노출시킵니다.
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: (key, defaultValue) => ipcRenderer.invoke('get-config', key, defaultValue),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  writeDiagnosticFile: (text) => ipcRenderer.invoke('write-diagnostic', text),
  onWebviewRedirect: (callback) => ipcRenderer.on('webview-redirect', (event, url) => callback(url)),
  pasteTitleThenBody: (title, segments) => ipcRenderer.invoke('paste-title-then-body', { title, segments }),
  
  // 클립보드에 텍스트 및 HTML 복사 기능 노출
  copyToClipboard: (text, html) => {
    clipboard.write({ text, html });
  }
});
