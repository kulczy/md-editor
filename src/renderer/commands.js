export const text = ({ prompt, prefill = '' }) => ({ kind: 'text', prompt, prefill })
export const confirm = ({ prompt }) => ({ kind: 'confirm', prompt })

// Drives steps one at a time against a UI adapter. Resolves values[] or null (cancelled).
export function runSteps(steps, ctx, ui) {
  return new Promise((resolve) => {
    const values = []
    let i = 0
    function show() {
      const step = steps[i]
      ui.setPrompt(step.prompt + (step.kind === 'confirm' ? ' (Enter = yes, Esc = no)' : ''))
      ui.setValue(step.kind === 'text' ? (step.prefill || '') : '')
    }
    ui.onSubmit(() => {
      const step = steps[i]
      values.push(step.kind === 'confirm' ? true : ui.getValue())
      i++
      if (i >= steps.length) resolve(values)
      else show()
    })
    ui.onCancel(() => resolve(null))
    show()
  })
}

// Trim, reject empty or path-escaping names, ensure a .md extension. Returns null if invalid.
function cleanName(name) {
  const n = (name || '').trim()
  if (!n || n.includes('..')) return null
  return n.endsWith('.md') ? n : n + '.md'
}

export function makeCommands(ctx) {
  return [
    {
      id: 'new', label: 'New file',
      steps: [text({ prompt: 'New file name (e.g. notes/idea.md)' })],
      async run([name]) {
        const rel = cleanName(name)
        if (!rel) return
        await ctx.fs.write(ctx.currentFolder(), rel, '')
        await ctx.refreshIndex()
        await ctx.openFile(rel)
      }
    },
    {
      id: 'rename', label: 'Rename file',
      steps: [text({ prompt: 'New name', prefill: '' })], // prefill set dynamically in palette.js
      async run([name]) {
        const rel = cleanName(name)
        if (!rel) return
        await ctx.fs.rename(ctx.currentFolder(), ctx.currentFile(), rel)
        await ctx.refreshIndex()
        await ctx.openFile(rel)
      }
    },
    {
      id: 'delete', label: 'Delete file',
      steps: [confirm({ prompt: 'Delete the current file?' })],
      async run() {
        await ctx.fs.delete(ctx.currentFolder(), ctx.currentFile())
        await ctx.refreshIndex()
      }
    },
    {
      id: 'open-folder', label: 'Open folder',
      steps: [],
      async run() {
        const folder = await ctx.pickFolder()
        if (folder) { await ctx.setFolder(folder); await ctx.refreshIndex() }
      }
    },
    {
      id: 'float', label: 'Toggle float (always on top)',
      steps: [],
      async run() { await ctx.toggleFloat() }
    },
    {
      id: 'settings', label: 'Settings',
      steps: [],
      async run() { ctx.openSettings() }
    }
  ]
}
