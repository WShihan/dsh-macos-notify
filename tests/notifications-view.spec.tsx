/**
 * Presentation coverage for the Notifications settings page: the copy, the
 * per-operation sound selects and text inputs, the placeholder hints, and the
 * save bar that appears only while text is staged. Props are fed directly, as
 * the client test policy expects.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MESSAGES, PLACEHOLDERS, SOUND_KEYS, type SoundKey } from '../src/settings.ts'
import {
  NotificationsSection, type NotificationsSectionProps,
} from '../src/client/NotificationsSection.tsx'
import type { NotificationsState, OperationState } from '../src/client/notifications-controller.ts'
import { en, type NotifyLocaleKey } from '../src/client/locales.ts'

function operation(init: Partial<OperationState> = {}): OperationState {
  return {
    sound: 'Glass',
    soundOverridden: false,
    title: { value: 'Title', overridden: false, draft: 'Title' },
    message: { value: 'Body', overridden: false, draft: 'Body' },
    ...init,
  }
}

function state(init: Partial<NotificationsState> = {}): NotificationsState {
  const operations = {} as Record<SoundKey, OperationState>
  for (const key of SOUND_KEYS) operations[key] = operation()
  return {
    available: true,
    writable: true,
    saving: false,
    failed: false,
    dirty: false,
    testing: undefined,
    notifyOnTurnEnd: true,
    notifyOnApproval: true,
    topLevelOnly: true,
    operations,
    ...init,
  }
}

function propsFor(current: NotificationsState): NotificationsSectionProps {
  return {
    t: (key: NotifyLocaleKey) => en[key],
    useNotifications: (select: (snapshot: NotificationsState) => unknown) => select(current),
    setToggle: vi.fn(),
    setSound: vi.fn(),
    test: vi.fn(),
    editText: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    resetOperation: vi.fn(),
  } as unknown as NotificationsSectionProps
}

describe('macos-notify notifications page', () => {
  it('renders nothing while the namespace is not served', () => {
    expect(renderToStaticMarkup(<NotificationsSection {...propsFor(state({ available: false }))} />)).toBe('')
  })

  it('renders one sound select and two text inputs per operation', () => {
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state())} />)
    expect(html).toContain('System banners through osascript')
    expect(html).toContain('When to notify')
    expect(html).toContain('Turn-end banners')
    expect(html).toContain('Permission banner')
    expect(html.match(/<select/g)).toHaveLength(SOUND_KEYS.length)
    expect(html.match(/type="text"/g)).toHaveLength(SOUND_KEYS.length * 2)
    expect(html).toContain('value="none"')
    expect(html).toContain('value="default"')
  })

  it('offers a test button per operation', () => {
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state())} />)
    expect(html.match(/>Test</g)).toHaveLength(SOUND_KEYS.length)
  })

  it('styles the test and reset buttons identically', () => {
    const operations = state().operations
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state({
      operations: { ...operations, error: operation({ soundOverridden: true }) },
    }))} />)
    const styles = [...html.matchAll(/<button[^>]*style="([^"]*)"[^>]*>([^<]*)<\/button>/g)]
      .filter(match => match[2] === 'Test' || match[2] === 'Reset to default')
      .map(match => match[1])
    expect(styles.length).toBe(SOUND_KEYS.length + 1)
    expect(new Set(styles).size).toBe(1)
  })

  it('shows the preview of one operation as in flight while the others stay ready', () => {
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state({ testing: 'error' }))} />)
    expect(html).toContain('Sending…')
    expect(html.match(/>Test</g)).toHaveLength(SOUND_KEYS.length - 1)
  })

  it('lists each operation\'s placeholders', () => {
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state())} />)
    for (const key of SOUND_KEYS) {
      for (const placeholder of PLACEHOLDERS[key]) {
        expect(html).toContain(`{${placeholder}}`)
      }
    }
  })

  it('renders the stored text as the current input value', () => {
    const operations = state().operations
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state({
      operations: {
        ...operations,
        error: operation({
          message: {
            value: DEFAULT_MESSAGES.error.message,
            overridden: true,
            draft: '第 {turn} 轮失败了：{error}',
          },
        }),
      },
    }))} />)
    expect(html).toContain('第 {turn} 轮失败了：{error}')
    expect(html).toContain('Overridden')
    expect(html).toContain('Reset to default')
  })

  it('shows the save bar only while text is staged', () => {
    const plain = renderToStaticMarkup(<NotificationsSection {...propsFor(state())} />)
    expect(plain).not.toContain('Unsaved changes')

    const staged = renderToStaticMarkup(<NotificationsSection {...propsFor(state({ dirty: true }))} />)
    expect(staged).toContain('Unsaved changes')
    expect(staged).toContain('Save')
    expect(staged).toContain('Discard')
  })

  it('disables every control and explains itself when the deployment is read-only', () => {
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state({ writable: false }))} />)
    expect(html).toContain('read-only')
    // Seven sound selects, fourteen text inputs, seven test buttons, and three
    // trigger switches.
    expect(html.match(/disabled/g)?.length ?? 0).toBe(SOUND_KEYS.length * 4 + 3)
  })

  it('reports a refused write', () => {
    const html = renderToStaticMarkup(<NotificationsSection {...propsFor(state({ failed: true }))} />)
    expect(html).toContain('did not accept this change')
  })
})
