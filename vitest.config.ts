import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { defineConfig } from 'vitest/config'

// Resolve every @deepseek-ai/* import to a harness workspace's source plane
// when one is beside this checkout, mirroring tsconfig.base.json's paths
// facade: bare package names map to each real workspace package's src entry,
// and the base config's exact subpath entries (types/invariant/… files) map
// verbatim. Without a checkout — the standalone repository — the installed
// packages' published declarations and bundles are the test plane.
const candidates = [
  // The plugin checked out inside <harness>/plugins/<name>.
  fileURLToPath(new URL('../', import.meta.url)),
  // The plugin checked out beside <harness>.
  fileURLToPath(new URL('../deepseek-harness/', import.meta.url)),
]
// `DSH_PLUGIN_STANDALONE=1` forces the installed-package plane, which is what
// a clone with no harness checkout beside it uses.
const harnessRoot = process.env.DSH_PLUGIN_STANDALONE === '1'
  ? undefined
  : candidates.find(candidate =>
    existsSync(resolve(candidate, 'packages')) && existsSync(resolve(candidate, 'vendor')))

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const aliases: { find: RegExp; replacement: string }[] = []
const seen = new Set<string>()

function addAlias(name: string, replacement: string): void {
  if (seen.has(name)) return
  seen.add(name)
  aliases.push({ find: new RegExp(`^${escapeRegExp(name)}$`), replacement })
}

if (harnessRoot !== undefined) {
  // Every workspace package by its real manifest name (the @deepseek-ai/dsh-*
  // wildcard in tsconfig.base.json expands to exactly these src entries).
  for (const group of readdirSync(resolve(harnessRoot, 'packages'))) {
    const groupDir = resolve(harnessRoot, 'packages', group)
    if (!statSync(groupDir).isDirectory()) continue
    for (const pkg of readdirSync(groupDir)) {
      const manifestPath = resolve(groupDir, pkg, 'package.json')
      if (!existsSync(manifestPath)) continue
      let name: string | undefined
      try {
        name = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: string }).name
      } catch {
        continue
      }
      if (name === undefined || !name.startsWith('@deepseek-ai/')) continue
      addAlias(name, resolve(groupDir, pkg, 'src'))
    }
  }

  // Vendored packages (cordis, cosmokit, schemastery, loader, include, …).
  for (const vendor of readdirSync(resolve(harnessRoot, 'vendor'))) {
    const src = resolve(harnessRoot, 'vendor', vendor, 'src')
    if (existsSync(src)) addAlias(`@deepseek-ai/${vendor}`, src)
  }

  // Exact subpath entries from tsconfig.base.json (e.g. @deepseek-ai/dsh-session/types).
  const baseConfig = resolve(harnessRoot, 'tsconfig.base.json')
  if (existsSync(baseConfig)) {
    const raw = readFileSync(baseConfig, 'utf8')
      .split('\n').filter(line => !line.trim().startsWith('//')).join('\n')
    const basePaths = (JSON.parse(raw) as { compilerOptions: { paths: Record<string, string[]> } })
      .compilerOptions.paths
    for (const [name, targets] of Object.entries(basePaths)) {
      if (name.includes('*')) continue
      addAlias(name, resolve(harnessRoot, targets[0]!))
    }
  }
}

// Harness sources use standard TypeScript decorators (the Remote method
// decorators). Vite's default parser leaves them untouched, so the source
// plane this config aliases into would fail to evaluate without lowering them
// first. The extracted repository resolves built packages and needs no such
// transform, but the plugin is harmless there.
const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/** Lower standard TypeScript decorators before Vite's parser sees a source file. */
function standardDecoratorPlugin() {
  return {
    name: 'dsh-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2024,
        module: ts.ModuleKind.ESNext,
        sourceMap: true,
      }
      if (file.endsWith('x')) compilerOptions.jsx = ts.JsxEmit.ReactJSX
      const result = ts.transpileModule(code, { fileName: file, compilerOptions })
      return {
        code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: {
    alias: aliases,
    // A client subpath the paths facade leaves to node resolution
    // (…/client) would otherwise load the harness's unbuilt package main.
    conditions: ['import', 'module', 'browser', 'default'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
  },
})
