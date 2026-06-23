import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut, nativeImage, nativeTheme, screen } from 'electron'
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

// First-run default: a centered window on the current display (under the cursor),
// sized to a fraction of its work area, all values rounded.
function defaultBounds() {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = Math.round(wa.width * 0.5)
  const height = Math.round(wa.height * 0.75)
  return { width, height, x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + (wa.height - height) / 2) }
}

function createWindow() {
  let b = store.get('windowBounds') // restore size/position across launches
  if (!b) { b = defaultBounds(); store.set({ windowBounds: b }) } // first run → compute + persist default
  win = new BrowserWindow({
    show: false, // shown once the renderer signals it's styled + loaded (avoids a flash)
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
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

// Standard app menu. Editing commands use built-in roles (so copy/paste/undo just work);
// app-specific items send a single 'menu' channel the renderer dispatches on.
function buildMenu() {
  const isMac = process.platform === 'darwin'
  const send = (action) => () => win?.webContents.send('menu', action)
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: send('settings') },
      { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ] }] : []),
    { label: 'File', submenu: [
      { label: 'Open File…', accelerator: 'CmdOrCtrl+P', click: send('palette-files') },
      { label: 'Run Command…', accelerator: 'CmdOrCtrl+Shift+P', click: send('palette-commands') },
      ...(isMac ? [] : [{ type: 'separator' }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: send('settings') }, { role: 'quit' }])
    ] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      { type: 'separator' },
      { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: send('find') }
    ] },
    { label: 'View', submenu: [
      { label: 'Float on Top', accelerator: 'CmdOrCtrl+Shift+T', click: send('toggle-float') },
      { type: 'separator' },
      { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }
    ] },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  nativeTheme.themeSource = store.get('theme') // drives vibrancy, prefers-color-scheme, system colors
  buildMenu()
  createWindow()
})
app.on('window-all-closed', () => {}) // ponytail: resident app, don't quit on close

// Hold the quit until the renderer flushes its unsaved buffer (debounced edits would otherwise be lost).
let didFlush = false
app.on('before-quit', (e) => {
  isQuitting = true
  if (didFlush || !win || win.isDestroyed()) return
  e.preventDefault()
  win.webContents.send('quit-flush')
  setTimeout(() => { didFlush = true; app.quit() }, 1000) // ponytail: don't hang quit if the renderer never acks
})
ipcMain.on('quit-flushed', () => { didFlush = true; app.quit() })
app.on('will-quit', () => { stopWatch?.(); globalShortcut.unregisterAll() })
