import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  fs: {
    list: (root) => ipcRenderer.invoke('fs:list', root),
    read: (root, rel) => ipcRenderer.invoke('fs:read', root, rel),
    write: (root, rel, content) => ipcRenderer.invoke('fs:write', root, rel, content),
    rename: (root, rel, newRel) => ipcRenderer.invoke('fs:rename', root, rel, newRel),
    delete: (root, rel) => ipcRenderer.invoke('fs:delete', root, rel)
  },
  state: {
    get: () => ipcRenderer.invoke('state:get'),
    set: (patch) => ipcRenderer.invoke('state:set', patch)
  },
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  ready: () => ipcRenderer.send('window:ready'),
  setHotkey: (accel) => ipcRenderer.invoke('hotkey:set', accel),
  setTheme: (mode) => ipcRenderer.invoke('theme:set', mode),
  toggleFloat: () => ipcRenderer.invoke('window:toggleFloat'),
  getFloat: () => ipcRenderer.invoke('window:getFloat'),
  watch: (root) => ipcRenderer.invoke('fs:watch', root),
  onFsEvent: (cb) => ipcRenderer.on('fs:event', (_e, ev) => cb(ev)),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action) => cb(action)),
  onQuitFlush: (cb) => ipcRenderer.on('quit-flush', () => cb()),
  quitFlushed: () => ipcRenderer.send('quit-flushed')
})
