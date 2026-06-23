import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runSteps, text, confirm, makeCommands } from './commands.js'

function fakeUi() {
  let value = '', submit, cancel
  return {
    ui: {
      setPrompt() {}, setValue(v) { value = v }, getValue: () => value,
      onSubmit(cb) { submit = cb }, onCancel(cb) { cancel = cb }
    },
    type: (v) => { value = v },
    enter: () => submit(),
    esc: () => cancel()
  }
}

test('runSteps collects text then confirm values', async () => {
  const f = fakeUi()
  const p = runSteps([text({ prompt: 'name?' }), confirm({ prompt: 'sure?' })], f.ui)
  f.type('note.md'); f.enter()  // step 1
  f.enter()                      // confirm yes
  assert.deepEqual(await p, ['note.md', true])
})

test('Esc mid-flow resolves null', async () => {
  const f = fakeUi()
  const p = runSteps([text({ prompt: 'name?' })], f.ui)
  f.esc()
  assert.equal(await p, null)
})

// A ctx that records the order of lifecycle calls, so we can assert the rename/delete
// sequencing that prevents the file-resurrection P0s.
function recordingCtx(recents = []) {
  const log = []
  return {
    log,
    currentFolder: () => '/root',
    currentFile: () => 'old.md',
    recents: () => recents,
    save: async () => { log.push('save') },
    detachFile: () => { log.push('detach') },
    closeCurrentFile: () => { log.push('close') },
    refreshIndex: async () => { log.push('refresh') },
    openFile: async (rel) => { log.push('open:' + rel) },
    fs: {
      rename: async (root, from, to) => { log.push(`rename:${from}->${to}`) },
      delete: async (root, rel) => { log.push('delete:' + rel) }
    }
  }
}

const cmd = (ctx, id) => makeCommands(ctx).find((c) => c.id === id)

test('rename flushes + detaches before renaming, then opens the new file', async () => {
  const ctx = recordingCtx()
  await cmd(ctx, 'rename').run(['new'])
  // save must precede detach must precede rename — else openFile recreates the old name.
  assert.deepEqual(ctx.log, ['save', 'detach', 'rename:old.md->new.md', 'refresh', 'open:new.md'])
})

test('delete clears the buffer, deletes, then opens the most-recent surviving note', async () => {
  const ctx = recordingCtx(['prev.md'])
  await cmd(ctx, 'delete').run([true])
  assert.deepEqual(ctx.log, ['close', 'delete:old.md', 'refresh', 'open:prev.md'])
})

test('delete leaves a blank window when no notes remain', async () => {
  const ctx = recordingCtx([])
  await cmd(ctx, 'delete').run([true])
  assert.deepEqual(ctx.log, ['close', 'delete:old.md', 'refresh'])
})

test('rename/delete are no-ops with no current file', async () => {
  const base = recordingCtx()
  const ctx = { ...base, currentFile: () => null }
  await cmd(ctx, 'rename').run(['new'])
  await cmd(ctx, 'delete').run([true])
  assert.deepEqual(base.log, [])
})
