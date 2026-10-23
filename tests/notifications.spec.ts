/**
 * Controller coverage for the Notifications settings page. The shared
 * configuration form is a recording stub: what the page renders and which path
 * operations it writes are this package's contract with the settings service.
 */

import { describe, expect, it } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  NotificationsController, type PreviewSamples,
} from '../src/client/notifications-controller.ts'
import {
  DEFAULT_MESSAGES, DEFAULT_SOUNDS, type NotifySettings,
} from '../src/settings.ts'

/** Deterministic placeholder samples a preview substitutes. */
const SAMPLES: PreviewSamples = {
  completed: { turn: '1' },
  blocked: { turn: '1' },
  aborted: { turn: '1', cause: 'user' },
  error: { turn: '1', error: 'boom!' },
  maxTokens: { turn: '1' },
  interrupted: { turn: '1' },
  approval: { tool: 'shell', reason: 'run a command' },
}

/** One recorded path operation. */
interface Write {
  readonly op: string
  readonly path: readonly string[]
  readonly value?: unknown
}

/** The smallest configuration form the controller consumes. */
class FakeForm {
  readonly writes: Write[] = []
  failWrites = false
  private listeners = new Set<() => void>()
  private snapshot: ConfigFormSnapshot<NotifySettings>

  constructor(init: Partial<ConfigFormSnapshot<NotifySettings>> = {}) {
    this.snapshot = {
      status: 'loading',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
      ...init,
    }
  }

  getSnapshot(): ConfigFormSnapshot<NotifySettings> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  mutate(ops: readonly Write[]): Promise<boolean> {
    if (this.failWrites) return Promise.resolve(false)
    this.writes.push(...ops.map(op => ({ ...op })))
    return Promise.resolve(true)
  }

  set(field: string, value: unknown): Promise<boolean> {
    return this.mutate([{ op: 'set', path: [field], value }])
  }

  unset(field: string): Promise<boolean> {
    return this.mutate([{ op: 'unset', path: [field] }])
  }

  publish(next: Partial<ConfigFormSnapshot<NotifySettings>> = {}): void {
    this.snapshot = { ...this.snapshot, ...next }
    for (const listener of [...this.listeners]) listener()
  }
}

function controllerOf(scope: FakeForm): NotificationsController {
  return new NotificationsController(
    scope as unknown as ConfigForm<NotifySettings>,
    () => SAMPLES,
  )
}

/** The preview request the controller wrote, if any. */
function previewPayload(scope: FakeForm): Record<string, unknown> {
  const write = [...scope.writes].reverse().find(candidate => candidate.path.join('.') === 'preview')
  return (write?.value ?? {}) as Record<string, unknown>
}

/** Let the controller's queued write settle. */
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('macos-notify notifications page controller', () => {
  it('renders nothing until the Host answers', () => {
    const state = controllerOf(new FakeForm()).inject().hooks.notifications.getSnapshot()
    expect(state.available).toBe(false)
    expect(state.operations.completed.sound).toBe(DEFAULT_SOUNDS.completed)
    expect(state.operations.completed.title.draft).toBe(DEFAULT_MESSAGES.completed.title)
  })

  it('publishes the resolved section once it is ready', () => {
    const scope = new FakeForm({
      status: 'ready',
      writable: true,
      value: {
        notifyOnTurnEnd: false,
        topLevelOnly: false,
        sounds: { completed: 'Tink' },
        messages: { completed: { title: '完成', message: '第 {turn} 轮' } },
      },
    })
    const state = controllerOf(scope).inject().hooks.notifications.getSnapshot()
    expect(state.available).toBe(true)
    expect(state.writable).toBe(true)
    expect(state.notifyOnTurnEnd).toBe(false)
    expect(state.topLevelOnly).toBe(false)
    expect(state.operations.completed.sound).toBe('Tink')
    expect(state.operations.completed.title.value).toBe('完成')
    expect(state.operations.completed.message.draft).toBe('第 {turn} 轮')
    expect(state.operations.approval.sound).toBe(DEFAULT_SOUNDS.approval)
    expect(state.operations.approval.message.draft).toBe(DEFAULT_MESSAGES.approval.message)
  })

  it('marks a field overridden from the raw user layer, not from its value', () => {
    const scope = new FakeForm({
      status: 'ready',
      writable: true,
      value: { sounds: { completed: DEFAULT_SOUNDS.completed }, messages: { completed: { title: DEFAULT_MESSAGES.completed.title } } },
      user: { sounds: { completed: DEFAULT_SOUNDS.completed }, messages: { completed: { title: DEFAULT_MESSAGES.completed.title } } },
    })
    const state = controllerOf(scope).inject().hooks.notifications.getSnapshot()
    expect(state.operations.completed.soundOverridden).toBe(true)
    expect(state.operations.completed.title.overridden).toBe(true)
    expect(state.operations.completed.message.overridden).toBe(false)
    expect(state.operations.error.soundOverridden).toBe(false)
    expect(state.operations.error.title.overridden).toBe(false)
  })

  it('writes one nested sound path per change', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    controllerOf(scope).inject().setSound('approval', 'Submarine')
    await settle()
    expect(scope.writes).toEqual([{ op: 'set', path: ['sounds', 'approval'], value: 'Submarine' }])
  })

  it('writes a boolean toggle as its own top-level field', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    controllerOf(scope).inject().setToggle('topLevelOnly', false)
    await settle()
    expect(scope.writes).toEqual([{ op: 'set', path: ['topLevelOnly'], value: false }])
  })

  it('stages text, saves it in one mutation, and clears the stage', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    expect(face.hooks.notifications.getSnapshot().dirty).toBe(false)

    face.editText('completed', 'message', '第 {turn} 轮结束')
    face.editText('approval', 'title', '需要授权')
    const staged = face.hooks.notifications.getSnapshot()
    expect(staged.dirty).toBe(true)
    expect(staged.operations.completed.message.draft).toBe('第 {turn} 轮结束')
    expect(staged.operations.completed.message.value).toBe(DEFAULT_MESSAGES.completed.message)

    face.save()
    await settle()
    expect(scope.writes).toEqual([
      { op: 'set', path: ['messages', 'completed', 'message'], value: '第 {turn} 轮结束' },
      { op: 'set', path: ['messages', 'approval', 'title'], value: '需要授权' },
    ])
    expect(face.hooks.notifications.getSnapshot().dirty).toBe(false)
  })

  it('un-stages text typed back to the stored value', () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    face.editText('blocked', 'title', 'changed')
    expect(face.hooks.notifications.getSnapshot().dirty).toBe(true)

    face.editText('blocked', 'title', DEFAULT_MESSAGES.blocked.title)
    expect(face.hooks.notifications.getSnapshot().dirty).toBe(false)
  })

  it('keeps a staged draft across an unrelated settings commit', () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    face.editText('error', 'message', 'boom: {error}')
    scope.publish({ revision: 9 })

    const state = face.hooks.notifications.getSnapshot()
    expect(state.dirty).toBe(true)
    expect(state.operations.error.message.draft).toBe('boom: {error}')
  })

  it('discards staged text without writing', () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    face.editText('error', 'message', 'boom')
    face.discard()

    expect(face.hooks.notifications.getSnapshot().dirty).toBe(false)
    expect(scope.writes).toEqual([])
  })

  it('resets all three fields of one operation', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    face.editText('approval', 'title', 'staged')
    face.resetOperation('approval')
    await settle()

    expect(scope.writes).toEqual([
      { op: 'unset', path: ['sounds', 'approval'] },
      { op: 'unset', path: ['messages', 'approval', 'title'] },
      { op: 'unset', path: ['messages', 'approval', 'message'] },
    ])
    expect(face.hooks.notifications.getSnapshot().dirty).toBe(false)
  })

  it('reports a refused write and clears the report on the next edit', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    scope.failWrites = true
    const face = controllerOf(scope).inject()
    face.setSound('completed', 'Pop')
    await settle()
    expect(face.hooks.notifications.getSnapshot().failed).toBe(true)
    expect(face.hooks.notifications.getSnapshot().saving).toBe(false)

    scope.failWrites = false
    face.setSound('completed', 'Purr')
    expect(face.hooks.notifications.getSnapshot().failed).toBe(false)
  })

  it('keeps a refused text write staged for correction', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    scope.failWrites = true
    const face = controllerOf(scope).inject()
    face.editText('error', 'message', 'rejected text')
    face.save()
    await settle()

    const state = face.hooks.notifications.getSnapshot()
    expect(state.failed).toBe(true)
    expect(state.dirty).toBe(true)
    expect(state.operations.error.message.draft).toBe('rejected text')
  })

  it('writes a preview request with the placeholder samples substituted', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const state = controllerOf(scope).inject()
    state.test('approval')

    expect(state.hooks.notifications.getSnapshot().testing).toBe('approval')
    await settle()
    expect(state.hooks.notifications.getSnapshot().testing).toBeUndefined()
    expect(previewPayload(scope)).toEqual({
      op: 'approval',
      nonce: expect.any(Number),
      sound: DEFAULT_SOUNDS.approval,
      title: DEFAULT_MESSAGES.approval.title,
      message: 'shell needs run a command',
    })
    expect(previewPayload(scope)['nonce']).toBeGreaterThan(0)
  })

  it('previews the staged text, not what is stored', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    face.editText('error', 'title', '出错了')
    face.editText('error', 'message', '第 {turn} 轮：{error}')
    face.setSound('error', 'Submarine')
    face.test('error')
    await settle()

    expect(previewPayload(scope)).toEqual({
      op: 'error',
      nonce: expect.any(Number),
      sound: 'Submarine',
      title: '出错了',
      message: '第 1 轮：boom!',
    })
    // Previewing is not saving: the staged text stays staged.
    expect(face.hooks.notifications.getSnapshot().dirty).toBe(true)
  })

  it('sends a distinct request id per preview', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const face = controllerOf(scope).inject()
    face.test('completed')
    await settle()
    const first = previewPayload(scope)['nonce'] as number
    scope.writes.length = 0
    face.test('completed')
    await settle()
    expect(previewPayload(scope)['nonce']).toBeGreaterThan(first)
  })

  it('reports a refused preview and stops showing it as in flight', async () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    scope.failWrites = true
    const face = controllerOf(scope).inject()
    face.test('completed')
    await settle()

    const state = face.hooks.notifications.getSnapshot()
    expect(state.failed).toBe(true)
    expect(state.testing).toBeUndefined()
  })

  it('keeps the published snapshot reference while nothing it renders moves', () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const store = controllerOf(scope).inject().hooks.notifications
    const before = store.getSnapshot()
    scope.publish({ revision: 7 })
    expect(store.getSnapshot()).toBe(before)
  })

  it('stops publishing after disposal', () => {
    const scope = new FakeForm({ status: 'ready', writable: true, value: {} })
    const controller = controllerOf(scope)
    const store = controller.inject().hooks.notifications
    const before = store.getSnapshot()
    controller.dispose()
    scope.publish({ user: { sounds: { completed: 'Tink' } } })
    expect(store.getSnapshot()).toBe(before)
  })
})
