import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listMarkdown } from './files.js'

test('listMarkdown returns recursive relative md paths, skips dot/node_modules', async () => {
  const root = mkdtempSync(join(tmpdir(), 'mdtest-'))
  writeFileSync(join(root, 'a.md'), '#')
  writeFileSync(join(root, 'b.txt'), 'x')
  mkdirSync(join(root, 'sub'))
  writeFileSync(join(root, 'sub', 'c.md'), '#')
  mkdirSync(join(root, '.hidden'))
  writeFileSync(join(root, '.hidden', 'd.md'), '#')
  mkdirSync(join(root, 'node_modules'))
  writeFileSync(join(root, 'node_modules', 'e.md'), '#')

  const found = (await listMarkdown(root)).sort()
  assert.deepEqual(found, ['a.md', 'sub/c.md'])
})
