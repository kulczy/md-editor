import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runSteps, text, confirm } from './commands.js'

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
  const p = runSteps([text({ prompt: 'name?' }), confirm({ prompt: 'sure?' })], {}, f.ui)
  f.type('note.md'); f.enter()  // step 1
  f.enter()                      // confirm yes
  assert.deepEqual(await p, ['note.md', true])
})

test('Esc mid-flow resolves null', async () => {
  const f = fakeUi()
  const p = runSteps([text({ prompt: 'name?' })], {}, f.ui)
  f.esc()
  assert.equal(await p, null)
})
