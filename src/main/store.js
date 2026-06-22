import Store from 'electron-store'

export default new Store({
  defaults: {
    lastFolder: null,
    lastFile: null,
    recentFiles: [],
    floatOn: false,
    hotkey: 'CommandOrControl+Shift+Space'
  }
})
