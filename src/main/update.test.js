import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNewer } from './update.js'

test('isNewer: detects upgrades, strips v, compares segments numerically', () => {
  assert.equal(isNewer('v0.2.0', '0.1.0'), true)
  assert.equal(isNewer('0.1.0', '0.1.0'), false) // same version
  assert.equal(isNewer('v0.1.0', '0.2.0'), false) // older release
  assert.equal(isNewer('v0.10.0', '0.9.0'), true) // numeric, not lexicographic
})
