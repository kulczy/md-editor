import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.js') }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {}) // ponytail: resident app, don't quit on close — Task 9 makes this real
