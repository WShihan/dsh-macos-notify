/**
 * Link the harness checkout into this package's `node_modules` so in-repository
 * development resolves the same package names an installed copy gets from npm.
 *
 * The extracted repository does not need this: `pnpm install` there links
 * `@deepseek-ai/*` from the registry and React from the lockfile. Run it only
 * from inside a deepseek-harness checkout:
 *
 *   node scripts/link-harness.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const harnessRoot = resolve(packageRoot, '..')
const nodeModules = resolve(packageRoot, 'node_modules')

/** Third-party packages this package compiles or tests against. */
const THIRD_PARTY = [
  'react', 'react-dom', '@types/react', '@types/react-dom', '@types/node',
  'typescript', 'vitest', 'tsdown', 'vite-tsconfig-paths',
]

/**
 * Read one package manifest's name.
 * @param dir - package directory.
 * @returns the declared name, or undefined when the manifest has none.
 */
function manifestName(dir) {
  const manifest = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'))
  return typeof manifest.name === 'string' ? manifest.name : undefined
}

/**
 * Symlink one package name at a directory, creating parent scopes.
 * @param name - bare or scoped package name.
 * @param target - absolute directory the name resolves to.
 */
function link(name, target) {
  const linkPath = resolve(nodeModules, name)
  mkdirSync(dirname(linkPath), { recursive: true })
  rmSync(linkPath, { recursive: true, force: true })
  symlinkSync(relative(dirname(linkPath), target), linkPath, 'dir')
  console.log(`linked ${name} -> ${relative(packageRoot, target)}`)
}

/** Every workspace package directory the checkout publishes by manifest name. */
function workspacePackages() {
  const found = []
  for (const group of readdirSync(resolve(harnessRoot, 'packages'))) {
    const groupDir = resolve(harnessRoot, 'packages', group)
    if (!statSync(groupDir).isDirectory()) continue
    for (const pkg of readdirSync(groupDir)) {
      const dir = resolve(groupDir, pkg)
      if (existsSync(resolve(dir, 'package.json'))) found.push(dir)
    }
  }
  for (const vendor of readdirSync(resolve(harnessRoot, 'vendor'))) {
    const dir = resolve(harnessRoot, 'vendor', vendor)
    if (existsSync(resolve(dir, 'package.json'))) found.push(dir)
  }
  return found
}

/** The pnpm store directory holding one installed package, or undefined. */
function storePath(name) {
  const store = resolve(harnessRoot, 'node_modules/.pnpm')
  if (!existsSync(store)) return undefined
  const prefix = `${name.replace('/', '+')}@`
  for (const entry of readdirSync(store)) {
    if (!entry.startsWith(prefix)) continue
    const candidate = resolve(store, entry, 'node_modules', name)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

for (const dir of workspacePackages()) {
  const name = manifestName(dir)
  if (name !== undefined && name.startsWith('@deepseek-ai/')) link(name, dir)
}

for (const name of THIRD_PARTY) {
  const target = storePath(name)
  if (target === undefined) {
    console.warn(`skipped ${name}: not found in the harness pnpm store`)
    continue
  }
  link(name, target)
}
