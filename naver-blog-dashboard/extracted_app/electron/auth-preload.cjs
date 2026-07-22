'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('authAPI', {
  submit: (code) => ipcRenderer.send('auth-verify', code),
  onInit: (cb) => ipcRenderer.on('init', (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('auth-error', (_e, msg) => cb(msg)),
  quit: () => ipcRenderer.send('auth-quit'),
});
