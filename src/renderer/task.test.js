import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cycleTaskLine } from './task.js'

test('cycleTaskLine rotates plain → unchecked → checked → plain', () => {
  assert.equal(cycleTaskLine('foo'), '- [ ] foo')
  assert.equal(cycleTaskLine('- [ ] foo'), '- [x] foo')
  assert.equal(cycleTaskLine('- [x] foo'), 'foo')
})

test('cycleTaskLine turns an existing bullet into a todo, preserves indent', () => {
  assert.equal(cycleTaskLine('- bar'), '- [ ] bar')
  assert.equal(cycleTaskLine('    - [ ] nested'), '    - [x] nested')
  assert.equal(cycleTaskLine(''), '- [ ] ')
})
