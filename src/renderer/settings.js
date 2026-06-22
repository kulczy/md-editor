// Simple modal settings panel: folder, translucency, editor padding.
let el = null
export function isSettingsOpen() { return !!el }
export function closeSettings() { if (el) { el.remove(); el = null } }

// opts: { folder, translucency (0..1), editorPad (px),
//         onPickFolder()->Promise<path|null>, onTranslucency(t), onPad(px) }
export function openSettings(opts) {
  closeSettings()
  el = document.createElement('div')
  el.className = 'settings-backdrop'
  el.innerHTML = `
    <div class="settings" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <div class="setting">
        <label>Folder</label>
        <div class="folder-row"><span class="folder-path"></span><button id="set-change">Change…</button></div>
      </div>
      <div class="setting">
        <label>Translucency <span class="val" id="set-bg-val"></span></label>
        <input id="set-bg" type="range" min="0" max="1" step="0.01">
      </div>
      <div class="setting">
        <label>Editor padding <span class="val" id="set-pad-val"></span></label>
        <input id="set-pad" type="range" min="16" max="160" step="2">
      </div>
    </div>`
  document.body.appendChild(el)
  const $ = (s) => el.querySelector(s)
  $('.folder-path').textContent = opts.folder || '—'
  const bg = $('#set-bg'), pad = $('#set-pad')
  bg.value = opts.translucency
  pad.value = opts.editorPad
  const showBg = () => { $('#set-bg-val').textContent = Math.round(bg.value * 100) + '%' }
  const showPad = () => { $('#set-pad-val').textContent = pad.value + 'px' }
  showBg(); showPad()
  bg.addEventListener('input', () => { showBg(); opts.onTranslucency(parseFloat(bg.value)) })
  pad.addEventListener('input', () => { showPad(); opts.onPad(parseInt(pad.value, 10)) })
  $('#set-change').onclick = async () => { const f = await opts.onPickFolder(); if (f) $('.folder-path').textContent = f }
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSettings(); e.stopPropagation() } })
  el.addEventListener('mousedown', (e) => { if (e.target === el) closeSettings() })
  bg.focus()
}
