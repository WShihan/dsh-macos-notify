/**
 * macOS notification plugin, browser half: the **Notifications** settings page
 * over the plugin's own configuration entry.
 *
 * The page is a feature-owned `settings.section`, so it appears as its own row
 * in the settings navigation beside General, Models, Plugins, and Agent
 * presets. The page edits the `macos-notify` profile entry through the shared
 * `ctx.configForms` service: the same revision-fenced, schema-validated write
 * path every official settings page uses, and because the Host declares every
 * field volatile the running plugin keeps its listeners and applies the change
 * to the next banner.
 * @module dsh-macos-notify/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.configForms Context merge, so the page reads and writes
// through the service instead of value imports (client bundle purity).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { SETTINGS_NAMESPACE, type NotifySettings } from '../settings.ts'
import { NotificationsSection } from './NotificationsSection.tsx'
import { NotificationsController, type PreviewSamples } from './notifications-controller.ts'
import { LOCALE_NAMESPACE, en, zh } from './locales.ts'

export type { NotificationsSectionProps } from './NotificationsSection.tsx'
export type {
  NotificationsActions, NotificationsFace, NotificationsState, OperationState,
  PreviewSamples, TextField, TextFieldState, ToggleField,
} from './notifications-controller.ts'
export type { NotifyLocaleKey } from './locales.ts'

/** Section key the settings navigation lists and `openSection` addresses. */
export const SECTION_ID = 'notifications'

/**
 * Navigation position. General is 0, Models 10, Plugins 15, and Agent presets
 * 20 (the shipped sections), so a deployment-owned preference page lands after
 * them.
 */
export const SECTION_ORDER = 25

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Register the page's dictionary and its `settings.section` contribution.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(LOCALE_NAMESPACE)
  ctx.effect(
    () => ctx.locale.register(LOCALE_NAMESPACE, { en, zh }),
    'macos-notify: page dictionaries',
  )

  // Placeholder samples a preview substitutes. Read at click time, so the
  // samples follow the active locale; only the two free-text samples are
  // locale-owned — the rest are code tokens the Host substitutes verbatim.
  const samples = (): PreviewSamples => ({
    completed: { turn: '1' },
    blocked: { turn: '1' },
    aborted: { turn: '1', cause: 'user' },
    error: { turn: '1', error: t('sampleError') },
    maxTokens: { turn: '1' },
    interrupted: { turn: '1' },
    approval: { tool: 'shell', reason: t('sampleReason') },
  })

  const controller = new NotificationsController(
    ctx.configForms.get<NotifySettings>(SETTINGS_NAMESPACE),
    samples,
  )
  ctx.effect(() => () => { controller.dispose() }, 'macos-notify: page snapshot')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: SECTION_ID,
    order: SECTION_ORDER,
    label: () => t('nav'),
    locale: LOCALE_NAMESPACE,
    inject: () => controller.inject(),
  }, NotificationsSection))
}
