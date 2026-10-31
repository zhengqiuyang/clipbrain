/** 渲染进程桥：只暴露白名单方法，contextIsolation 下安全通信. */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipbrain', {
  query: (q) => ipcRenderer.invoke('clipbrain:query', q),
  copy: (id) => ipcRenderer.invoke('clipbrain:copy', id),
  pin: (id, value) => ipcRenderer.invoke('clipbrain:pin', { id, value }),
  remove: (id) => ipcRenderer.invoke('clipbrain:remove', id),
  hide: () => ipcRenderer.invoke('clipbrain:hide'),
  settings: () => ipcRenderer.invoke('clipbrain:settings'),
  onShown: (fn) => ipcRenderer.on('clipbrain:shown', fn),
  onChanged: (fn) => ipcRenderer.on('clipbrain:changed', fn),
});
