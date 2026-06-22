import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import * as files from './files.js'

ipcMain.handle('fs:list', (_e, root) => files.listMarkdown(root))
ipcMain.handle('fs:read', (_e, root, rel) => files.readFile(root, rel))
ipcMain.handle('fs:write', (_e, root, rel, content) => files.writeFile(root, rel, content))
ipcMain.handle('fs:rename', (_e, root, rel, newRel) => files.renameFile(root, rel, newRel))
ipcMain.handle('fs:delete', (_e, root, rel) => files.deleteFile(root, rel))

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
