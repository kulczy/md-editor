import { promises as fs } from 'node:fs'
import { join, relative, dirname, sep } from 'node:path'

const toPosix = (p) => p.split(sep).join('/')

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

export const readFile = (root, rel) => fs.readFile(join(root, rel), 'utf8')

export async function writeFile(root, rel, content) {
  const full = join(root, rel)
  await fs.mkdir(dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf8')
}

export async function renameFile(root, rel, newRel) {
  const dst = join(root, newRel)
  await fs.mkdir(dirname(dst), { recursive: true })
  await fs.rename(join(root, rel), dst)
}

export const deleteFile = (root, rel) => fs.rm(join(root, rel))
