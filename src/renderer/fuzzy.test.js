import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fuzzyScore, fuzzyFilter } from './fuzzy.js'

test('non-subsequence scores -1', () => {
  assert.equal(fuzzyScore('xyz', 'abc'), -1)
})
test('subsequence scores >= 0, case-insensitive', () => {
  assert.ok(fuzzyScore('mn', 'MeetingNotes') >= 0)
})
test('consecutive run beats scattered', () => {
  assert.ok(fuzzyScore('meet', 'meeting') > fuzzyScore('meet', 'mxexextx'))
})
test('filter sorts best-first and drops non-matches', () => {
  const r = fuzzyFilter('proj', ['projects/ideas.md', 'notes.md', 'p-r-o-j.md'])
  assert.deepEqual(r, ['projects/ideas.md', 'p-r-o-j.md'])
})
