import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut, nativeImage, screen } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import * as files from './files.js'
import store from './store.js'

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => { if (win) { win.show(); win.focus() } })

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

let stopWatch = null
ipcMain.handle('fs:watch', (e, root) => {
  stopWatch?.()
  stopWatch = root ? files.watchFolder(root, (ev) => e.sender.send('fs:event', ev)) : null
})

let win = null
let tray = null
let isQuitting = false

function toggleWindow() {
  if (!win) return createWindow()
  if (win.isVisible() && win.isFocused()) win.hide()
  else { win.show(); win.focus() }
}

function setupResident() {
  // Hide instead of close; keep process alive.
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win.hide() } })

  const icon = nativeImage.createFromPath(join(import.meta.dirname, '../../build/iconTemplate.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('md')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show', click: () => { win.show(); win.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
  ]))
  tray.on('click', toggleWindow)

  const hotkey = store.get('hotkey')
  const ok = globalShortcut.register(hotkey, toggleWindow)
  if (!ok) console.warn(`[md] global hotkey "${hotkey}" is taken — skipping`) // ponytail: no rebind UI in v1
}

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 640,
    vibrancy: 'under-window', // native macOS translucency (frosted glass behind the window)
    backgroundColor: '#00000000', // transparent so the vibrancy material shows through
    titleBarStyle: 'hidden', // frameless; we toggle traffic lights ourselves on bar hover
    trafficLightPosition: { x: 18, y: 18 }, // center the lights in the taller title strip
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'), // CommonJS preload (sandbox requires CJS, not ESM)
      contextIsolation: true, // pin secure defaults explicitly (trust boundary)
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(store.get('floatOn'))
  if (process.platform === 'darwin') win.setWindowButtonVisibility(false) // hidden until cursor is near the bar
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
  setupTrafficLights()
  setupResident()
}

// The title strip is a drag region, which swallows mouse events — and there's no event for
// "cursor left the window over a drag region". So poll the real cursor vs the window bounds
// while focused: reveal the traffic lights when the cursor is in the top strip, hide them
// when it moves down (hysteresis) or leaves the window entirely. macOS only.
let lightsVisible = false
let lightsPoll = null
function setLights(v) { if (v !== lightsVisible) { lightsVisible = v; win.setWindowButtonVisibility(v) } }
function pollLights() {
  if (!win || !win.isVisible()) return
  const p = screen.getCursorScreenPoint()
  const b = win.getBounds()
  const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height
  const y = p.y - b.y
  if (!inside) setLights(false)
  else if (y < 58) setLights(true)
  else if (y > 92) setLights(false)
}
function setupTrafficLights() {
  if (process.platform !== 'darwin') return
  const start = () => { if (!lightsPoll) lightsPoll = setInterval(pollLights, 90) }
  const stop = () => { clearInterval(lightsPoll); lightsPoll = null; setLights(false) }
  win.on('focus', start)
  win.on('blur', stop)
  win.on('hide', stop)
  if (win.isFocused()) start()
}

ipcMain.handle('window:toggleFloat', () => {
  const next = !win.isAlwaysOnTop()
  win.setAlwaysOnTop(next)
  store.set({ floatOn: next })
  return next
})
ipcMain.handle('window:getFloat', () => win.isAlwaysOnTop())

ipcMain.handle('window:hide', () => win?.hide())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {}) // ponytail: resident app, don't quit on close
app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => { stopWatch?.(); globalShortcut.unregisterAll() })
