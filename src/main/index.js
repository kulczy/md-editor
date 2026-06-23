import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut, nativeImage, nativeTheme } from 'electron'
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

  // Persist window size/position (debounced — resize/move fire rapidly).
  let boundsTimer = null
  const saveBounds = () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => { if (win && !win.isDestroyed()) store.set({ windowBounds: win.getBounds() }) }, 400)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)

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
  const b = store.get('windowBounds') // restore size/position (x/y undefined → Electron centers)
  win = new BrowserWindow({
    show: false, // shown once the renderer signals it's styled + loaded (avoids a flash)
    width: b?.width ?? 650,
    height: b?.height ?? 640,
    x: b?.x,
    y: b?.y,
    vibrancy: 'fullscreen-ui', // stronger frosted glass (blurs windows behind, not just wallpaper)
    visualEffectState: 'active', // keep the glass even when the window isn't focused (e.g. pinned)
    backgroundColor: '#00000000', // transparent so the vibrancy material shows through
    titleBarStyle: 'customButtonsOnHover', // frameless; macOS reveals the traffic lights on hover (native)
    trafficLightPosition: { x: 18, y: 18 }, // center the lights in the taller title strip
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'), // CommonJS preload (sandbox requires CJS, not ESM)
      contextIsolation: true, // pin secure defaults explicitly (trust boundary)
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(store.get('floatOn'))
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
  setupResident()
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show() }, 2000) // fallback if 'window:ready' never arrives
}

ipcMain.on('window:ready', () => { if (win && !win.isVisible()) win.show() })

ipcMain.handle('window:toggleFloat', () => {
  const next = !win.isAlwaysOnTop()
  win.setAlwaysOnTop(next)
  store.set({ floatOn: next })
  return next
})
ipcMain.handle('window:getFloat', () => win.isAlwaysOnTop())

ipcMain.handle('window:hide', () => win?.hide())
ipcMain.handle('hotkey:set', (_e, accel) => {
  const old = store.get('hotkey')
  try {
    globalShortcut.unregister(old)
    if (globalShortcut.register(accel, toggleWindow)) { store.set({ hotkey: accel }); return true }
  } catch { /* invalid accelerator */ }
  try { globalShortcut.register(old, toggleWindow) } catch {} // restore previous on failure
  return false
})

ipcMain.handle('theme:set', (_e, mode) => { nativeTheme.themeSource = mode; store.set({ theme: mode }) })

app.whenReady().then(() => {
  nativeTheme.themeSource = store.get('theme') // drives vibrancy, prefers-color-scheme, system colors
  createWindow()
})
app.on('window-all-closed', () => {}) // ponytail: resident app, don't quit on close
app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => { stopWatch?.(); globalShortcut.unregisterAll() })
