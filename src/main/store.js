import Store from 'electron-store'

export default new Store({
  defaults: {
    lastFolder: null,
    lastFile: null,
    recentFiles: [],
    floatOn: false,
    hotkey: 'CommandOrControl+Shift+Space',
    translucency: 0.85, // 0 = solid window, 1 = fully glassy (vibrancy shows through)
    editorPad: 64, // editor left/right padding in px
    fontSize: 16, // editor font size in px
    lineHeight: 1.6, // editor line height (unitless)
    fontFamily: 'sans', // 'sans' | 'mono'
    windowBounds: null // {x,y,width,height} — remembered across launches
  }
})
