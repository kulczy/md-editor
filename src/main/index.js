import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import * as files from './files.js'
import store from './store.js'

ipcMain.handle('fs:list', (_e, root) => files.listMarkdown(root))
ipcMain.handle('fs:read', (_e, root, rel) => files.readFile(root, rel))
ipcMain.handle('fs:write', (_e, root, rel, content) => files.writeFile(root, rel, content))
ipcMain.handle('fs:rename', (_e, root, rel, newRel) => files.renameFile(root, rel, newRel))
ipcMain.handle('fs:delete', (_e, root, rel) => files.deleteFile(root, rel))

ipcMain.handle('state:get', () => {
  const s = store.store
  // First-run / moved-folder guard: don't hand back a folder that no longer exists.
  if (s.lastFolder && !existsSync(s.lastFolder)) {
    store.set({ lastFolder: null, lastFile: null })
    return store.store
  }
  return s
})
ipcMain.handle('state:set', (_e, patch) => { store.set(patch) })
ipcMain.handle('pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.mjs') } // electron-vite emits preload as .mjs under "type":"module"
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {}) // ponytail: resident app, don't quit on close — Task 9 makes this real
