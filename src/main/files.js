import { promises as fs } from 'node:fs'
import { join, resolve, relative, dirname, sep } from 'node:path'
import chokidar from 'chokidar'

const toPosix = (p) => p.split(sep).join('/')

// Resolve rel under root and refuse anything that escapes the folder (e.g. "../x.md").
function within(root, rel) {
  const full = resolve(root, rel)
  if (full !== resolve(root) && !full.startsWith(resolve(root) + sep)) {
    throw new Error(`path escapes folder: ${rel}`)
  }
  return full
}

export async function listMarkdown(root) {
  const out = []
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && e.name.endsWith('.md')) out.push(toPosix(relative(root, full)))
    }
  }
  await walk(root)
  return out
}

export const readFile = async (root, rel) => fs.readFile(within(root, rel), 'utf8')

export async function writeFile(root, rel, content) {
  const full = within(root, rel)
  await fs.mkdir(dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf8')
}

export async function renameFile(root, rel, newRel) {
  const dst = within(root, newRel)
  await fs.mkdir(dirname(dst), { recursive: true })
  await fs.rename(within(root, rel), dst)
}

export const deleteFile = async (root, rel) => fs.rm(within(root, rel))

export function watchFolder(root, send) {
  const w = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (p) => p.includes('node_modules') || /(^|[/\\])\../.test(p)
  })
  const emit = (type) => (full) => {
    if (full.endsWith('.md')) send({ type, rel: relative(root, full).split(sep).join('/') })
  }
  w.on('add', emit('add')).on('change', emit('change')).on('unlink', emit('unlink'))
  return () => w.close()
}
