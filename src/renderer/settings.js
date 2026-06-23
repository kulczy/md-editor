// Modal settings panel: folder, translucency, editor padding, font size/height, font, global shortcut.
let el = null
export function isSettingsOpen() { return !!el }
function closeSettings() { if (el) { el.remove(); el = null } }

// Build an Electron accelerator string from a keydown. Uses e.code so Alt-remapped
// keys stay correct. Requires a primary modifier (Cmd/Ctrl/Alt) + a non-modifier key.
function toAccelerator(e) {
  if (['Control', 'Shift', 'Alt', 'Meta', 'Dead'].includes(e.key)) return null
  if (!(e.metaKey || e.ctrlKey || e.altKey)) return null
  const parts = []
  if (e.metaKey) parts.push('Command')
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let k
  if (e.code.startsWith('Key')) k = e.code.slice(3)
  else if (e.code.startsWith('Digit')) k = e.code.slice(5)
  else if (e.code === 'Space') k = 'Space'
  else if (/^F\d+$/.test(e.code)) k = e.code
  else if (e.code.startsWith('Arrow')) k = e.code.slice(5)
  else k = e.key.length === 1 ? e.key.toUpperCase() : e.key
  parts.push(k)
  return parts.join('+')
}
const pretty = (a) => a.replace('CommandOrControl', '⌘').replace('Command', '⌘').replace('Control', '⌃').replace('Alt', '⌥').replace('Shift', '⇧').split('+').join(' ')

// opts = current values + on*() callbacks for each control; see the openSettings({...}) call
// in main.js for the full shape (it's the single caller and the source of truth).
export function openSettings(opts) {
  closeSettings()
  el = document.createElement('div')
  el.className = 'settings-backdrop'
  el.innerHTML = `
    <div class="settings" role="dialog" aria-label="Settings">
      <h2>Settings</h2>

      <div class="group-title">General</div>
      <div class="settings-group">
        <div class="setting">
          <label>Folder</label>
          <div class="folder-row"><span class="folder-path"></span><button id="set-change">Change…</button></div>
        </div>
        <div class="setting">
          <label>Global shortcut</label>
          <button id="set-hotkey" class="hotkey-btn"></button>
        </div>
      </div>

      <div class="group-title">Appearance</div>
      <div class="settings-group">
        <div class="setting">
          <label>Theme</label>
          <div class="seg" id="set-theme">
            <button data-theme="system">System</button>
            <button data-theme="light">Light</button>
            <button data-theme="dark">Dark</button>
          </div>
        </div>
        <div class="setting">
          <label>Light theme</label>
          <select id="set-light-theme"></select>
        </div>
        <div class="setting">
          <label>Dark theme</label>
          <select id="set-dark-theme"></select>
        </div>
        <div class="setting">
          <label>Translucency <span class="val" id="set-bg-val"></span></label>
          <input id="set-bg" type="range" min="0" max="1" step="0.01">
        </div>
      </div>

      <div class="group-title">Editor</div>
      <div class="settings-group">
        <div class="setting">
          <label>Padding <span class="val" id="set-pad-val"></span></label>
          <input id="set-pad" type="range" min="16" max="160" step="2">
        </div>
        <div class="setting">
          <label>Font size <span class="val" id="set-fs-val"></span></label>
          <input id="set-fs" type="range" min="12" max="28" step="1">
        </div>
        <div class="setting">
          <label>Line height <span class="val" id="set-lh-val"></span></label>
          <input id="set-lh" type="range" min="1.2" max="2.4" step="0.05">
        </div>
        <div class="setting">
          <label>Font</label>
          <div class="seg" id="set-font">
            <button data-font="sans">Sans</button>
            <button data-font="mono">Mono</button>
          </div>
        </div>
        <div class="setting">
          <label>Spellcheck</label>
          <div class="seg" id="set-spell">
            <button data-spell="off">Off</button>
            <button data-spell="on">On</button>
          </div>
        </div>
      </div>
    </div>`
  document.body.appendChild(el)
  const $ = (s) => el.querySelector(s)
  $('.folder-path').textContent = opts.folder || '—'

  const seg2 = $('#set-theme')
  const markTheme = (m) => seg2.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.theme === m))
  markTheme(opts.theme)
  seg2.querySelectorAll('button').forEach((b) => { b.onclick = () => { markTheme(b.dataset.theme); opts.onTheme(b.dataset.theme) } })

  const fillSelect = (sel, names, current) => { sel.innerHTML = names.map((n) => `<option${n === current ? ' selected' : ''}>${n}</option>`).join('') }
  const lt = $('#set-light-theme'), dt = $('#set-dark-theme')
  fillSelect(lt, opts.themeNames.light, opts.lightTheme)
  fillSelect(dt, opts.themeNames.dark, opts.darkTheme)
  lt.onchange = () => opts.onLightTheme(lt.value)
  dt.onchange = () => opts.onDarkTheme(dt.value)

  const bg = $('#set-bg'), pad = $('#set-pad')
  bg.value = opts.translucency
  pad.value = opts.editorPad
  const showBg = () => { $('#set-bg-val').textContent = Math.round(bg.value * 100) + '%' }
  const showPad = () => { $('#set-pad-val').textContent = pad.value + 'px' }
  showBg(); showPad()
  bg.addEventListener('input', () => { showBg(); opts.onTranslucency(parseFloat(bg.value)) })
  pad.addEventListener('input', () => { showPad(); opts.onPad(parseInt(pad.value, 10)) })

  const fs = $('#set-fs'), lh = $('#set-lh')
  fs.value = opts.fontSize
  lh.value = opts.lineHeight
  const showFs = () => { $('#set-fs-val').textContent = fs.value + 'px' }
  const showLh = () => { $('#set-lh-val').textContent = parseFloat(lh.value).toFixed(2) }
  showFs(); showLh()
  fs.addEventListener('input', () => { showFs(); opts.onFontSize(parseInt(fs.value, 10)) })
  lh.addEventListener('input', () => { showLh(); opts.onLineHeight(parseFloat(lh.value)) })

  const seg = $('#set-font')
  const markFont = (fam) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.font === fam))
  markFont(opts.fontFamily)
  seg.querySelectorAll('button').forEach((b) => { b.onclick = () => { markFont(b.dataset.font); opts.onFontFamily(b.dataset.font) } })

  const spellSeg = $('#set-spell')
  const markSpell = (on) => spellSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.spell === (on ? 'on' : 'off')))
  markSpell(opts.spellcheck)
  spellSeg.querySelectorAll('button').forEach((b) => { b.onclick = () => { const on = b.dataset.spell === 'on'; markSpell(on); opts.onSpellcheck(on) } })

  $('#set-change').onclick = async () => { const f = await opts.onPickFolder(); if (f) $('.folder-path').textContent = f }

  // Global-shortcut recorder
  const hk = $('#set-hotkey')
  let recording = false
  hk.textContent = pretty(opts.hotkey)
  hk.onclick = () => { recording = true; hk.classList.add('recording'); hk.textContent = 'Press keys…' }

  el.addEventListener('keydown', async (e) => {
    if (recording) {
      e.preventDefault(); e.stopPropagation()
      if (e.key === 'Escape') { recording = false; hk.classList.remove('recording'); hk.textContent = pretty(opts.hotkey); return }
      const accel = toAccelerator(e)
      if (!accel) return // modifier-only or no primary modifier yet — keep waiting
      recording = false; hk.classList.remove('recording')
      if (await opts.onSetHotkey(accel)) { opts.hotkey = accel; hk.textContent = pretty(accel) }
      else hk.textContent = pretty(opts.hotkey) + ' — in use'
      return
    }
    if (e.key === 'Escape') { closeSettings(); e.stopPropagation() }
  })
  el.addEventListener('mousedown', (e) => { if (e.target === el) closeSettings() })
  bg.focus()
}
