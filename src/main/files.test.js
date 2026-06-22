import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listMarkdown, writeFile, readFile } from './files.js'

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

test('writes stay inside the folder; "../" escapes are rejected', async () => {
  const root = mkdtempSync(join(tmpdir(), 'mdtest-'))
  await writeFile(root, 'sub/note.md', 'hi') // nested path inside root is fine
  assert.equal(await readFile(root, 'sub/note.md'), 'hi')
  await assert.rejects(() => writeFile(root, '../escape.md', 'x'), /escapes folder/)
  await assert.rejects(() => readFile(root, '../../etc/passwd'), /escapes folder/)
})
