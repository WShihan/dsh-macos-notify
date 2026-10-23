/**
 * Host-half coverage for dsh-macos-notify: banner text and per-operation
 * sounds, the settings namespace wiring, listener lifecycle, and one real
 * Loader composition through `cordis.yml`.
 *
 * `osascript` is the only external service, so every test substitutes a
 * recording `ctx.subprocess` stub and asserts the exact spawn spec the banner
 * would produce — the plugin's user-visible output.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context, resolveConfig, Service } from '@deepseek-ai/cordis'
import { createVolatile, updateVolatile } from '@deepseek-ai/cosmokit'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { TurnEndReason } from '@deepseek-ai/dsh-session'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import ApprovalService from '@deepseek-ai/dsh-user-approval'
import * as Notify from '../src/index.ts'
import {
  DEFAULT_MESSAGES, DEFAULT_SOUNDS, SOUND_KEYS, notificationScript, renderTemplate, resolveSettings,
} from '../src/index.ts'
import type { SoundKey } from '../src/index.ts'

/** A `ctx.subprocess` stand-in that records every spawn instead of running it. */
class RecordingSubprocess extends Service {
  static readonly specs: SubprocessSpawnSpec[] = []

  constructor(ctx: Context) {
    super(ctx, 'subprocess')
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    RecordingSubprocess.specs.push(spec)
    return {
      done: Promise.resolve({ exitCode: 0, signal: null }),
      collected: {},
      terminate: () => {},
      waitForExit: () => Promise.resolve({ exitCode: 0, signal: null }),
    } as unknown as SubprocessHandle
  }
}

/**
 * A `ctx.settings` stand-in that records the page policy. The preview clear is
 * the page's write, so the Host half never calls this service's `mutate`.
 */
class RecordingSettings extends Service {
  static configured: { auto?: boolean } | undefined

  static reset(): void {
    RecordingSettings.configured = undefined
  }

  constructor(ctx: Context) {
    super(ctx, 'settings')
  }

  configure(presentation: { auto?: boolean }): () => void {
    RecordingSettings.configured = presentation
    return () => {}
  }
}

/** The recorded osascript script of the latest banner, if any. */
function lastScript(): string | undefined {
  return RecordingSubprocess.specs.at(-1)?.argv[2]
}

/** A live-looking agent whose session is a real store session inside an open turn. */
function agentOf(session: Session): Agent {
  return { session } as unknown as Agent
}

/**
 * Resolve one composition entry into runtime references exactly as Cordis
 * does, so a test can commit a later value through `updateVolatile`.
 * @param input - plain fields from `cordis.yml`.
 * @returns the volatile configuration references.
 */
function configOf(input: Notify.ConfigInput = {}): Notify.Config {
  return resolveConfig(
    { Config: Notify.Config } as unknown as Parameters<typeof resolveConfig>[0],
    input,
  ) as Notify.Config
}

/** Mount the plugin over already-resolved configuration references. */
function mountConfig(ctx: Context, config: Notify.Config) {
  return ctx.plugin({
    name: Notify.name,
    inject: Notify.inject,
    apply: (owned: Context) => { Notify.apply(owned, config) },
  })
}

/** Configuration references of the most recently created test context. */
let current: Notify.Config

async function createContext(input: Notify.ConfigInput = {}): Promise<Context> {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  const ctx = new Context()
  await ctx.plugin(RecordingSubprocess)
  await ctx.plugin(SessionStore)
  await ctx.plugin(ApprovalService)
  await ctx.plugin(RecordingSettings)
  current = configOf(input)
  return ctx
}

async function setup(input: Notify.ConfigInput = {}, mount: boolean = true): Promise<Context> {
  const ctx = await createContext(input)
  if (mount) await mountConfig(ctx, current)
  return ctx
}

/** Publish a settings write the way the Loader's volatile commit does. */
function commitVolatile(field: 'sounds' | 'messages' | 'preview', value: unknown): void {
  if (field === 'sounds') updateVolatile(current.sounds as never, createVolatile(value))
  else if (field === 'messages') updateVolatile(current.messages as never, createVolatile(value))
  else updateVolatile(current.preview as never, createVolatile(value))
}

/** Write one preview request and emit the Loader's volatile commit. */
function firePreview(ctx: Context, request: Partial<Notify.PreviewRequest>): void {
  commitVolatile('preview', {
    op: '', nonce: 0, sound: '', title: '', message: '', ...request,
  })
  ctx.emit('loader/volatile-update', [['preview']])
}

beforeEach(() => {
  RecordingSubprocess.specs.length = 0
  RecordingSettings.reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('macos-notify settings resolution', () => {
  it('fills every default when the composition entry is empty', () => {
    expect(resolveSettings({})).toEqual({
      notifyOnTurnEnd: true,
      notifyOnApproval: true,
      topLevelOnly: true,
      sounds: { ...DEFAULT_SOUNDS },
      messages: { ...DEFAULT_MESSAGES },
    })
  })

  it('resolves every sound and text key from the composition entry', () => {
    const sounds = Object.fromEntries(SOUND_KEYS.map(key => [key, 'Tink']))
    const messages = Object.fromEntries(SOUND_KEYS.map(key => [key, { title: `t-${key}`, message: `m-${key}` }]))
    const resolved = resolveSettings({ sounds, messages })
    expect(resolved.sounds).toEqual(Object.fromEntries(SOUND_KEYS.map(key => [key, 'Tink'])))
    expect(resolved.messages.completed).toEqual({ title: 't-completed', message: 'm-completed' })
    expect(resolved.messages.approval).toEqual({ title: 't-approval', message: 'm-approval' })
  })

  it('rejects an unknown sound, naming the field', () => {
    expect(() => resolveSettings({ sounds: { completed: 'Kazoo' } }))
      .toThrow(/sounds\.completed is not a macOS alert sound: "Kazoo"/)
  })

  it('rejects a template field that is not a string', () => {
    expect(() => resolveSettings({ messages: { error: { title: 42 as unknown as string } } }))
      .toThrow(/messages\.error\.title must be a string, received number/)
  })

  it('maps every turn-end reason to its own operation', () => {
    const reasons: TurnEndReason[] = [
      { kind: 'completed' },
      { kind: 'blocked' },
      { kind: 'aborted', reason: { kind: 'user' } },
      { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } },
      { kind: 'max-tokens' },
      { kind: 'interrupted' },
    ]
    expect(reasons.map(Notify.soundKeyOf)).toEqual([
      'completed', 'blocked', 'aborted', 'error', 'maxTokens', 'interrupted',
    ])
    expect(Notify.soundKeyOf({ kind: 'future' } as unknown as TurnEndReason)).toBe('completed')
  })
})

describe('macos-notify template rendering', () => {
  it('substitutes known placeholders and leaves unknown ones verbatim', () => {
    expect(renderTemplate('turn {turn} failed: {error} ({nope})', { turn: '2', error: 'boom' }))
      .toBe('turn 2 failed: boom ({nope})')
  })

  it('escapes quotes and backslashes and strips control characters', () => {
    expect(Notify.asAppleScriptString('say "hi" \\ done')).toBe('"say \\"hi\\" \\\\ done"')
    expect(Notify.asAppleScriptString('a\nb\tc')).toBe('"a b c"')
  })

  it('omits the sound clause only for none', () => {
    const notice = { title: 'T', message: 'M' }
    expect(notificationScript(notice, 'none')).toBe('display notification "M" with title "T"')
    expect(notificationScript(notice, 'default'))
      .toBe('display notification "M" with title "T" sound name "default"')
    expect(notificationScript(notice, 'Tink'))
      .toBe('display notification "M" with title "T" sound name "Tink"')
  })

  it('documents the placeholders each operation exposes', () => {
    expect(Notify.PLACEHOLDERS.approval).toEqual(['tool', 'reason'])
    expect(Notify.PLACEHOLDERS.error).toEqual(['turn', 'error'])
    expect(Notify.PLACEHOLDERS.aborted).toEqual(['turn', 'cause'])
    expect(Notify.PLACEHOLDERS.completed).toEqual(['turn'])
  })
})

describe('macos-notify platform guard', () => {
  it('fails loud at load on non-macOS platforms', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    const ctx = new Context()
    // apply() directly: ctx.plugin() waits on the injected subprocess service,
    // so a bare context never reaches the platform guard through the loader.
    expect(() => Notify.apply(ctx, configOf({}))).toThrow(/requires macOS/)
  })

  it('rejects an unknown configured sound when the schema resolves the entry', async () => {
    expect(() => configOf({ sounds: { approval: 'Kazoo' } })).toThrow()
  })

  it('fails loud at load on a hand-built configuration with an unknown sound', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    const ctx = new Context()
    const config = {
      ...configOf({}),
      sounds: createVolatile({ approval: 'Kazoo' }),
    } as unknown as Notify.Config
    expect(() => Notify.apply(ctx, config)).toThrow(/sounds\.approval/)
  })
})

describe('macos-notify turn-end banners', () => {
  it('banners a completed turn once, with the default text and sound', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('top'))
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    expect(RecordingSubprocess.specs).toHaveLength(1)
    const spec = RecordingSubprocess.specs[0]!
    expect(spec.argv[0]).toBe('/usr/bin/osascript')
    expect(spec.argv[1]).toBe('-e')
    expect(spec.argv[2]).toBe(
      'display notification "The agent finished its turn." with title "Task completed" sound name "Glass"',
    )
    expect(spec.stdio).toEqual({ stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' })
    expect(spec.graceMs).toBe(5_000)
  })

  const reasonCases: ReadonlyArray<readonly [reason: TurnEndReason, key: SoundKey]> = [
    [{ kind: 'completed' }, 'completed'],
    [{ kind: 'blocked' }, 'blocked'],
    [{ kind: 'aborted', reason: { kind: 'user' } }, 'aborted'],
    [{ kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } }, 'error'],
    [{ kind: 'max-tokens' }, 'maxTokens'],
    [{ kind: 'interrupted' }, 'interrupted'],
  ]

  it.each(reasonCases)('renders reason %s from its own template and sound', async (reason, key) => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('reason'))
    session.append('turn/end', { turn: 1, reason })

    const values = reason.kind === 'error'
      ? { turn: '1', error: 'boom' }
      : reason.kind === 'aborted' ? { turn: '1', cause: 'user' } : { turn: '1' }
    expect(lastScript()).toBe(notificationScript(
      Notify.renderNotice(DEFAULT_MESSAGES[key], values),
      DEFAULT_SOUNDS[key],
    ))
  })

  it('plays each operation\'s configured sound', async () => {
    const ctx = await setup({
      sounds: { completed: 'Glass', blocked: 'Funk', error: 'Basso', maxTokens: 'Tink' },
    })
    const session = ctx.sessions.create(SessionId('sounds'))
    session.append('turn/end', { turn: 1, reason: { kind: 'max-tokens' } })
    expect(lastScript()).toContain('sound name "Tink"')

    session.append('turn/start', { turn: 2 })
    session.append('turn/end', { turn: 2, reason: { kind: 'blocked' } })
    expect(lastScript()).toContain('sound name "Funk"')
  })

  it('renders a configured template with its placeholder values', async () => {
    const ctx = await setup({
      messages: { completed: { title: '完成', message: '第 {turn} 轮结束' } },
    })
    const session = ctx.sessions.create(SessionId('custom'))
    session.append('turn/end', { turn: 3, reason: { kind: 'completed' } })

    expect(lastScript()).toBe('display notification "第 3 轮结束" with title "完成" sound name "Glass"')
  })

  it('keeps an unknown placeholder visible instead of dropping the sentence', async () => {
    const ctx = await setup({ messages: { blocked: { message: 'blocked for {nope} reasons' } } })
    const session = ctx.sessions.create(SessionId('typo'))
    session.append('turn/end', { turn: 1, reason: { kind: 'blocked' } })

    expect(lastScript()).toContain('"blocked for {nope} reasons"')
  })

  it('renders a failure with its error text and the operation template', async () => {
    const ctx = await setup({ messages: { error: { title: '出错了', message: '第 {turn} 轮：{error}' } } })
    const session = ctx.sessions.create(SessionId('error'))
    session.append('turn/end', {
      turn: 4,
      reason: { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } },
    })

    expect(lastScript()).toBe('display notification "第 4 轮：boom" with title "出错了" sound name "Basso"')
  })

  it('renders a cancellation cause', async () => {
    const ctx = await setup({ messages: { aborted: { message: 'cancelled by {cause}' } } })
    const session = ctx.sessions.create(SessionId('abort'))
    session.append('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } })

    expect(lastScript()).toContain('"cancelled by user"')
  })

  it('falls through to the completed banner for an unknown merge-extended reason', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('unknown'))
    session.append('turn/end', { turn: 1, reason: { kind: 'future' } as unknown as TurnEndReason })

    expect(lastScript()).toBe(
      'display notification "The agent finished its turn." with title "Task completed" sound name "Glass"',
    )
  })

  it('truncates a long failure message to the banner cap', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('long'))
    session.append('turn/end', {
      turn: 1,
      reason: { kind: 'error', error: { message: 'x'.repeat(300), code: 'UNKNOWN' } },
    })

    expect(lastScript()).toContain('with title "Task failed"')
    expect(lastScript()).toMatch(/"x{159}…"/)
  })

  it('silences an operation configured as none', async () => {
    const ctx = await setup({ sounds: { completed: 'none' } })
    const session = ctx.sessions.create(SessionId('silent'))
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(lastScript()).not.toContain('sound name')
  })

  it('ignores non-turn-end session events', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('noise'))
    session.append('turn/start', { turn: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    expect(RecordingSubprocess.specs).toHaveLength(0)
  })

  it('banners nothing for turn end when notifyOnTurnEnd is false', async () => {
    const ctx = await setup({ notifyOnTurnEnd: false })
    const session = ctx.sessions.create(SessionId('muted'))
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(RecordingSubprocess.specs).toHaveLength(0)
  })

  it('skips delegated subagent sessions when topLevelOnly (default)', async () => {
    const ctx = await setup()
    const child = ctx.sessions.create(SessionId('child'), { meta: { delegationDepth: 1, origin: 'subagent' } })
    child.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(RecordingSubprocess.specs).toHaveLength(0)
  })

  it('notifies delegated subagent sessions when topLevelOnly is false', async () => {
    const ctx = await setup({ topLevelOnly: false })
    const child = ctx.sessions.create(SessionId('child'), { meta: { delegationDepth: 1, origin: 'subagent' } })
    child.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(RecordingSubprocess.specs).toHaveLength(1)
  })
})

describe('macos-notify approval banners', () => {
  it('banners an approval request and delegates with next() so nobody claims it', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('approval'))
    session.append('turn/start', { turn: 1 })

    const outcome = await ctx.approval.request({
      agent: agentOf(session),
      toolName: 'fs/write',
      callId: ToolCallId('call-1'),
      reason: 'write to /tmp/out',
    })

    // The notification listener observed and delegated; the empty answerer
    // chain fails closed.
    expect(outcome).toBe('unavailable')
    expect(RecordingSubprocess.specs).toHaveLength(1)
    expect(lastScript()).toBe(
      'display notification "fs/write needs write to /tmp/out" with title "Permission requested" sound name "Ping"',
    )
  })

  it('banners a request without a reason as a plain approval', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('bare'))
    session.append('turn/start', { turn: 1 })

    await ctx.approval.request({ agent: agentOf(session), toolName: 'shell' })

    expect(lastScript()).toContain('"shell needs approval"')
  })

  it('renders a configured approval template from the tool and reason', async () => {
    const ctx = await setup({
      messages: { approval: { title: '需要授权：{tool}', message: '原因：{reason}' } },
    })
    const session = ctx.sessions.create(SessionId('custom-approval'))
    session.append('turn/start', { turn: 1 })

    await ctx.approval.request({
      agent: agentOf(session),
      toolName: 'shell',
      callId: ToolCallId('call-2'),
      reason: 'rm -rf build',
    })

    expect(lastScript()).toBe('display notification "原因：rm -rf build" with title "需要授权：shell" sound name "Ping"')
  })

  it('banners nothing for approval when notifyOnApproval is false', async () => {
    const ctx = await setup({ notifyOnApproval: false })
    const session = ctx.sessions.create(SessionId('muted'))
    session.append('turn/start', { turn: 1 })

    await ctx.approval.request({ agent: agentOf(session), toolName: 'shell' })

    expect(RecordingSubprocess.specs).toHaveLength(0)
  })
})

describe('macos-notify settings integration', () => {
  it('turns the automatic page off so the shipped page owns the entry', async () => {
    await setup()
    expect(RecordingSettings.configured).toEqual({ auto: false })
  })

  it('applies a settings change to the next banner without a reload', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('live'))
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(lastScript()).toContain('sound name "Glass"')

    commitVolatile('sounds', { completed: 'Submarine' })
    commitVolatile('messages', { completed: { title: '改了', message: '改过的内容 {turn}' } })
    ctx.emit('loader/volatile-update', [['sounds'], ['messages']])
    session.append('turn/start', { turn: 2 })
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    expect(lastScript()).toBe('display notification "改过的内容 2" with title "改了" sound name "Submarine"')
  })
})

describe('macos-notify preview requests', () => {
  it('fires the requested banner', async () => {
    const ctx = await setup()
    firePreview(ctx, {
      op: 'error', nonce: 1, sound: 'Hero', title: '任务失败', message: '第 1 轮失败：boom',
    })

    expect(RecordingSubprocess.specs).toHaveLength(1)
    expect(lastScript()).toBe('display notification "第 1 轮失败：boom" with title "任务失败" sound name "Hero"')
  })

  it('ignores a repeat of the request it already fired', async () => {
    const ctx = await setup()
    firePreview(ctx, { op: 'completed', nonce: 1, sound: 'Glass', title: 'T', message: 'M' })
    firePreview(ctx, { op: 'completed', nonce: 1, sound: 'Glass', title: 'T', message: 'M' })

    expect(RecordingSubprocess.specs).toHaveLength(1)
  })

  it('fires each new request once', async () => {
    const ctx = await setup()
    firePreview(ctx, { op: 'completed', nonce: 1, sound: 'Glass', title: 'a', message: 'a' })
    firePreview(ctx, { op: 'completed', nonce: 2, sound: 'Tink', title: 'b', message: 'b' })

    expect(RecordingSubprocess.specs).toHaveLength(2)
    expect(lastScript()).toBe('display notification "b" with title "b" sound name "Tink"')
  })

  it('ignores a request that names no operation', async () => {
    const ctx = await setup()
    firePreview(ctx, { op: 'nope', nonce: 1, sound: 'Glass', title: 'T', message: 'M' })
    expect(RecordingSubprocess.specs).toHaveLength(0)
  })

  it('falls back to the operation default for an unknown requested sound', async () => {
    const ctx = await setup()
    firePreview(ctx, { op: 'approval', nonce: 1, sound: 'Kazoo', title: 'T', message: 'M' })
    expect(lastScript()).toBe('display notification "M" with title "T" sound name "Ping"')
  })

  it('does not fire a request left over from an earlier run', async () => {
    const ctx = await setup({
      preview: { op: 'completed', nonce: 7, sound: 'Glass', title: 'stale', message: 'stale' },
    })
    firePreview(ctx, { op: 'completed', nonce: 7, sound: 'Glass', title: 'stale', message: 'stale' })
    expect(RecordingSubprocess.specs).toHaveLength(0)

    firePreview(ctx, { op: 'completed', nonce: 8, sound: 'Glass', title: 'fresh', message: 'fresh' })
    expect(RecordingSubprocess.specs).toHaveLength(1)
  })
})

describe('macos-notify failure containment', () => {
  it('logs a synchronous spawn failure instead of throwing into the event', async () => {
    const ctx = await setup({}, false)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => {})
    await ctx.plugin(Notify)
    const spy = vi.spyOn(ctx.subprocess, 'spawn').mockImplementation(() => {
      throw new Error('no osascript')
    })

    const session = ctx.sessions.create(SessionId('fail'))
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not start osascript'))
    spy.mockRestore()
  })

  it('logs a banner exit failure from handle.done', async () => {
    const ctx = await setup({}, false)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => {})
    await ctx.plugin(Notify)
    const spy = vi.spyOn(ctx.subprocess, 'spawn').mockImplementation(() => ({
      done: Promise.reject(new Error('osascript denied')),
      collected: {},
      terminate: () => {},
      waitForExit: () => Promise.resolve({ exitCode: 1, signal: null }),
    }) as unknown as SubprocessHandle)

    const session = ctx.sessions.create(SessionId('fail-exit'))
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    // The rejection is contained by the plugin's catch; let the microtask land.
    await Promise.resolve()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('osascript banner failed'))
    spy.mockRestore()
  })
})

describe('macos-notify disposal (HMR safety)', () => {
  it('removes both listeners when the plugin fiber disposes', async () => {
    const ctx = await setup({}, false)
    const fiber = await ctx.plugin(Notify)
    const session = ctx.sessions.create(SessionId('hmr'))
    session.append('turn/start', { turn: 1 })
    await ctx.approval.request({ agent: agentOf(session), toolName: 'shell' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    expect(RecordingSubprocess.specs).toHaveLength(2)

    await fiber.dispose()
    RecordingSubprocess.specs.length = 0
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 3 })
    await ctx.approval.request({ agent: agentOf(session), toolName: 'shell' })
    expect(RecordingSubprocess.specs).toHaveLength(0)
  })
})

describe('macos-notify real Loader composition through cordis.yml', () => {
  it('boots through the Loader and banners with the configured sound and text', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    const root = await mkdtemp(join(tmpdir(), 'dsh-macos-notify-'))
    try {
      await writeFile(join(root, 'cordis.yml'), [
        "- name: 'dsh-macos-notify'",
        '  config:',
        '    sounds:',
        '      completed: Tink',
        '    messages:',
        '      completed:',
        '        title: All done',
        '        message: turn {turn} closed',
        '',
      ].join('\n'))

      const ctx = new Context()
      await ctx.plugin(RecordingSubprocess)
      await ctx.plugin(SessionStore)
      await ctx.plugin(ApprovalService)
      ctx.baseUrl = pathToFileURL(root).href + '/'
      await ctx.plugin(Loader)
      ctx.loader.builtins.include = Include
      ctx.loader.internal = {
        version: 'v2',
        async import(specifier: string) {
          if (specifier === 'dsh-macos-notify') return Notify
          throw new Error(`unexpected Loader import: ${specifier}`)
        },
      } as unknown as NonNullable<typeof ctx.loader.internal>
      await ctx.loader.create({
        name: 'cordis:include',
        config: { path: pathToFileURL(join(root, 'cordis.yml')).href },
      })
      await ctx.loader.await()

      const session = ctx.sessions.create(SessionId('loader'))
      session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

      expect(RecordingSubprocess.specs).toHaveLength(1)
      expect(RecordingSubprocess.specs[0]!.argv[2]).toBe(
        'display notification "turn 1 closed" with title "All done" sound name "Tink"',
      )
      await ctx.fiber.dispose()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
