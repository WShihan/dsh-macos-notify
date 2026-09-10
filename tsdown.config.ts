/**
 * Build for both halves of dsh-macos-notify.
 *
 * Host half: `src/index.ts` → ESM `lib/index.js` for Node, with every
 * `@deepseek-ai/*` package left as an import because a profile installs them.
 *
 * Browser half: `src/client/index.ts` → the client module system's lazy-CJS
 * factory artifact `lib/client.js`. Reproducing that format is the package's
 * own job outside the harness repository: the bundle announces itself through
 * `window.__ModuleLoader__.load({ id, factory })`, takes its externals from the
 * injectable `require` (the shared module table), and inlines everything else.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type UserConfig } from 'tsdown'

/** Package name: the Loader id, the client module id, and the patch row name. */
const ID = 'dsh-macos-notify'

/**
 * Module-table specifiers the shell seeds for every dynamic bundle
 * (packages/client/web/src/platform.ts). A name outside this list is inlined
 * into `lib/client.js`; inlining React or the store would fork their identity.
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Node builtins stay imports; every installed package is inlined. */
const isNodeBuiltin = (specifier: string): boolean => specifier.startsWith('node:')

/**
 * Vendored packages a harness checkout may hold as source only. When the
 * checkout is present, bundle the schema library from that source: an
 * unbuilt or unreachable `lib/` makes the bundler fall back to leaving the
 * import external, which is exactly what breaks a `link:`ed plugin. The
 * extracted repository has no `vendor/`, resolves the installed package
 * normally, and bundles the same library.
 */
const vendoredAlias: Record<string, string> = {}
for (const name of ['schemastery', 'cosmokit']) {
  const source = fileURLToPath(new URL(`../vendor/${name}/src/index.ts`, import.meta.url))
  if (existsSync(source)) vendoredAlias[`@deepseek-ai/${name}`] = source
}

const host: UserConfig = {
  name: ID,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: false,
  // `lib/index.js`, not `lib/index.mjs`: the Loader imports the `main` path.
  fixedExtension: false,
  // Self-contained on purpose. Besides relative modules, the Host half's only
  // runtime import is the schema library; every `@deepseek-ai/*` import is
  // type-only and erased, and Cordis reaches the plugin by service name. A
  // `link:`ed plugin resolves bare specifiers from its own directory rather
  // than from the profile that linked it, so an external import here is what
  // breaks a locally added checkout. Schemastery keys its schemas on
  // `Symbol.for('schemastery')`, so an inlined copy stays recognizable to the
  // harness's own copy.
  deps: { neverBundle: isNodeBuiltin, alwaysBundle: specifier => !isNodeBuiltin(specifier) },
  inputOptions: { resolve: { alias: vendoredAlias } },
}

const client: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: true,
  deps: {
    neverBundle: specifier => PLATFORM_MODULES.includes(specifier),
    alwaysBundle: specifier => !PLATFORM_MODULES.includes(specifier),
  },
  inputOptions: {
    resolve: { conditionNames: ['production', 'browser', 'import', 'module', 'default'] },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.MODE': JSON.stringify('production'),
    'import.meta.env': JSON.stringify({ MODE: 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([host, client])
