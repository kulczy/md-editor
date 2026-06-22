import Store from 'electron-store'

export default new Store({
  defaults: {
    lastFolder: null,
    lastFile: null,
    recentFiles: [],
    floatOn: false,
    hotkey: 'CommandOrControl+Shift+Space',
    translucency: 0.85, // 0 = solid window, 1 = fully glassy (vibrancy shows through)
    editorPad: 64 // editor left/right padding in px
  }
})
