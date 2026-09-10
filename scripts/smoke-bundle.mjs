/**
 * Load the built browser half the way the client module system does, without a
 * browser: the bundle calls `window.__ModuleLoader__.load({ id, factory })`,
 * and the factory receives the shared module table's `require`.
 *
 * Run after `pnpm run build`:
 *
 *   node scripts/smoke-bundle.mjs
 *
 * It fails on a missing bundle, a wrong module id, a require the module table
 * cannot answer, or an `apply` that registers no settings card.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/** Package name the Loader and the module table spell. */
const ID = 'dsh-macos-notify'

/** Settings namespace the page is bound to (the Host half's registration). */
const SETTINGS_NAMESPACE = 'macos-notify'

/** Settings section key the page registers into the navigation. */
const SECTION_ID = 'notifications'

const require = createRequire(import.meta.url)
const bundle = fileURLToPath(new URL('../lib/client.js', import.meta.url))
if (!existsSync(bundle)) {
  console.error(`missing ${bundle}; run \`pnpm run build\` first`)
  process.exit(1)
}

let definition
globalThis.window = {
  __ModuleLoader__: {
    load(value) {
      definition = value
    },
  },
}

await import(bundle)

if (definition === undefined) throw new Error('bundle never called window.__ModuleLoader__.load')
if (definition.id !== ID) throw new Error(`bundle announced id ${definition.id}, expected ${ID}`)
if (typeof definition.factory !== 'function') throw new Error('bundle announced no factory')

/** Every request the factory makes, so an unanswered external fails loudly here. */
const requested = []
const plugin = definition.factory((specifier) => {
  requested.push(specifier)
  return require(specifier)
})

if (typeof plugin.apply !== 'function') throw new Error('client half exports no apply()')
if (!Array.isArray(plugin.inject) || plugin.inject.length === 0) throw new Error('client half declares no inject')

const registrations = []
const context = {
  effect: (callback) => {
    const disposer = callback()
    return typeof disposer === 'function' ? disposer : () => {}
  },
  locale: {
    register: (namespace) => { registrations.push(`locale:${namespace}`); return () => {} },
    bind: () => key => key,
  },
  settingsScope: {
    bind: (spec) => {
      registrations.push(`scope:${spec.namespace}`)
      return {
        getSnapshot: () => ({
          status: 'unavailable', value: undefined, base: undefined, user: undefined,
          revision: undefined, writable: false, mode: 'memory',
        }),
        subscribe: () => () => {},
        set: async () => {},
        unset: async () => {},
        mutate: async () => {},
      }
    },
  },
  slots: {
    inject: (name, factory) => { factory() },
    register: (options) => {
      registrations.push(`slot:${options.name}:${options.id ?? options.key}`)
      return () => {}
    },
  },
}

plugin.apply(context)

const section = registrations.find(entry => entry.startsWith('slot:settings.section:'))
if (section !== `slot:settings.section:${SECTION_ID}`) {
  throw new Error(`client half registered no settings section: ${JSON.stringify(registrations)}`)
}

console.log(`client bundle ok: id=${ID} requires=[${requested.join(', ')}] registrations=[${registrations.join(', ')}]`)
