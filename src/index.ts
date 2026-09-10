/**
 * macOS Notification Center bridge. Mount this plugin in an interactive macOS
 * deployment to receive a system banner when an agent turn ends or an approval
 * request reaches the answerer chain; banners are produced through the managed
 * subprocess seam (`/usr/bin/osascript`, fire-and-forget) and never touch the
 * model transcript or the session log.
 *
 * Each banner-producing operation carries its own sound and its own text. Both
 * live in the `macos-notify` settings namespace, so the shipped web settings
 * page can change them at runtime without a restart and without a `cordis.yml`
 * edit; without a settings provider the composition entry is the only source.
 *
 * The plugin is macOS-only by contract: mounting it on another platform fails
 * loud at load instead of silently dropping notifications.
 * @module dsh-macos-notify
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Session, SessionEvent, TurnEndReason } from '@deepseek-ai/dsh-session'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { ApprovalRequest } from '@deepseek-ai/dsh-user-approval'
import {
  DEFAULT_MESSAGES, DEFAULT_SOUNDS, PREVIEW_NAMESPACE, SETTINGS_NAMESPACE, SOUND_KEYS, SOUND_NAMES,
  isSoundKey, isSoundName, renderTemplate,
  type MessagesSettings, type NotifySettings, type PreviewRequest, type ResolvedMessage,
  type ResolvedNotifySettings, type SoundKey, type SoundName,
} from './settings.ts'
import { notificationScript, type Notice } from './script.ts'

export {
  DEFAULT_MESSAGES, DEFAULT_SOUNDS, PLACEHOLDERS, PREVIEW_NAMESPACE, SETTINGS_NAMESPACE, SOUND_KEYS,
  SOUND_NAMES, SYSTEM_SOUNDS, isSoundKey, isSoundName, renderTemplate,
} from './settings.ts'
export type {
  MessageTemplate, MessagesSettings, NotifySettings, PreviewRequest, ResolvedMessage,
  ResolvedNotifySettings, SoundKey, SoundName, SoundsSettings, SystemSound,
} from './settings.ts'
export { asAppleScriptString, notificationScript } from './script.ts'
export type { Notice } from './script.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'macos-notify'

/** The managed process-tree service this plugin spawns `osascript` through. */
export const inject = ['subprocess']

/** Composition entry of the `macos-notify` settings namespace. */
export interface Config extends NotifySettings {}

export const Config: z<Config> = z.object({
  notifyOnTurnEnd: z.boolean().default(true),
  notifyOnApproval: z.boolean().default(true),
  topLevelOnly: z.boolean().default(true),
  sounds: z.object({
    completed: z.string().default(DEFAULT_SOUNDS.completed),
    blocked: z.string().default(DEFAULT_SOUNDS.blocked),
    aborted: z.string().default(DEFAULT_SOUNDS.aborted),
    error: z.string().default(DEFAULT_SOUNDS.error),
    maxTokens: z.string().default(DEFAULT_SOUNDS.maxTokens),
    interrupted: z.string().default(DEFAULT_SOUNDS.interrupted),
    approval: z.string().default(DEFAULT_SOUNDS.approval),
  }),
  messages: z.object({
    completed: messageSchema('completed'),
    blocked: messageSchema('blocked'),
    aborted: messageSchema('aborted'),
    error: messageSchema('error'),
    maxTokens: messageSchema('maxTokens'),
    interrupted: messageSchema('interrupted'),
    approval: messageSchema('approval'),
  }),
})

/**
 * Schema of the preview namespace. Every field is defaulted, so a cleared
 * request resolves back to "no request" without the page writing an empty
 * object.
 */
export const PreviewConfig: z<PreviewRequest> = z.object({
  op: z.string().default(''),
  nonce: z.number().default(0),
  sound: z.string().default(DEFAULT_SOUNDS.completed),
  title: z.string().default(''),
  message: z.string().default(''),
})

/**
 * Schema for one operation's banner text, defaulted from
 * {@link DEFAULT_MESSAGES}. The return type stays inferred: annotating it
 * would erase the defaults and make both template fields required input.
 * @param key - operation the template belongs to.
 * @returns the object schema for that operation.
 */
function messageSchema(key: SoundKey) {
  return z.object({
    title: z.string().default(DEFAULT_MESSAGES[key].title),
    message: z.string().default(DEFAULT_MESSAGES[key].message),
  })
}

/** `osascript` ships at a fixed absolute path on every macOS release. */
const OSASCRIPT = '/usr/bin/osascript'
/** Termination grace for a spawned banner; banners normally exit on their own. */
const GRACE_MS = 5_000
/** Cap on a banner field; long failure details must not fill the banner. */
const MAX_MESSAGE_CHARS = 160

/**
 * Fill schema defaults and validate every configured sound and template.
 * Called on the composition entry at load and on every settings write, so an
 * unknown sound name or a non-string template fails loud instead of producing
 * a wrong banner.
 * @param config - composition entry or resolved settings section.
 * @returns the section with defaults filled, sounds narrowed to {@link SoundName}.
 * @throws {Error} when a configured sound or template value is invalid.
 */
export function resolveSettings(config: NotifySettings): ResolvedNotifySettings {
  const configuredSounds = config.sounds ?? {}
  const sounds = {} as Record<SoundKey, SoundName>
  for (const key of SOUND_KEYS) sounds[key] = resolveSound(key, configuredSounds[key])
  return {
    notifyOnTurnEnd: config.notifyOnTurnEnd ?? true,
    notifyOnApproval: config.notifyOnApproval ?? true,
    topLevelOnly: config.topLevelOnly ?? true,
    sounds,
    messages: resolveMessages(config.messages),
  }
}

/**
 * Narrow one configured sound, naming the offending field when it is not a
 * macOS alert sound.
 * @param key - operation field being resolved.
 * @param value - configured value, absent when the field inherits its default.
 * @returns the validated sound name.
 */
function resolveSound(key: SoundKey, value: string | undefined): SoundName {
  if (value === undefined) return DEFAULT_SOUNDS[key]
  if (isSoundName(value)) return value
  throw new Error(
    `dsh-macos-notify: sounds.${key} is not a macOS alert sound: ${JSON.stringify(value)}; `
    + `use one of ${SOUND_NAMES.join(', ')}`,
  )
}

/**
 * Fill every operation's banner text and reject a field that is not a string.
 * @param configured - messages layer from the composition entry or settings.
 * @returns one resolved template per operation.
 */
function resolveMessages(configured: MessagesSettings | undefined): Record<SoundKey, ResolvedMessage> {
  const messages = {} as Record<SoundKey, ResolvedMessage>
  for (const key of SOUND_KEYS) {
    const template = configured?.[key]
    messages[key] = {
      title: textOr(`messages.${key}.title`, template?.title, DEFAULT_MESSAGES[key].title),
      message: textOr(`messages.${key}.message`, template?.message, DEFAULT_MESSAGES[key].message),
    }
  }
  return messages
}

/**
 * Read one configured template field.
 * @param field - field path used in the failure message.
 * @param value - configured value, absent when the field inherits its default.
 * @param fallback - default text.
 * @returns the configured or default text.
 */
function textOr(field: string, value: unknown, fallback: string): string {
  if (value === undefined) return fallback
  if (typeof value === 'string') return value
  throw new Error(`dsh-macos-notify: ${field} must be a string, received ${typeof value}`)
}

/**
 * The sound a turn-end reason plays. Unknown (merge-extended) kinds have no
 * own setting and fall through to the `completed` entry, as does its text.
 * @param reason - the `turn/end` reason appended by the agent loop.
 * @returns the operation key to play and render.
 */
export function soundKeyOf(reason: TurnEndReason): SoundKey {
  switch (reason.kind) {
    case 'completed': return 'completed'
    case 'blocked': return 'blocked'
    case 'aborted': return 'aborted'
    case 'error': return 'error'
    case 'max-tokens': return 'maxTokens'
    case 'interrupted': return 'interrupted'
    default: return 'completed'
  }
}

/**
 * Placeholder values a turn-end banner exposes: `{turn}` always, `{error}` on
 * a failure, `{cause}` on a cancellation.
 * @param reason - the `turn/end` reason appended by the agent loop.
 * @param turn - the closed turn's number.
 * @returns the value table for template substitution.
 */
export function turnEndValues(reason: TurnEndReason, turn: number): Record<string, string> {
  return {
    turn: String(turn),
    ...reason.kind === 'error' ? { error: truncate(reason.error.message) } : {},
    ...reason.kind === 'aborted' ? { cause: reason.reason.kind } : {},
  }
}

/**
 * Placeholder values an approval banner exposes: `{tool}` always, `{reason}`
 * with the asker's reason, or the word `approval` when none was given.
 * @param req - the pending approval decision being dispatched.
 * @returns the value table for template substitution.
 */
export function approvalValues(req: ApprovalRequest): Record<string, string> {
  return {
    tool: req.toolName,
    reason: req.reason === undefined ? 'approval' : truncate(req.reason),
  }
}

/**
 * Render one banner from its template and placeholder values.
 * @param template - the operation's resolved title and message.
 * @param values - placeholder values for this firing.
 * @returns the banner content, with the body bounded to the banner cap.
 */
export function renderNotice(template: ResolvedMessage, values: Readonly<Record<string, string>>): Notice {
  return {
    title: truncate(renderTemplate(template.title, values)),
    message: truncate(renderTemplate(template.message, values)),
  }
}

/**
 * Bound a banner field to the cap, eliding the tail.
 * @param value - the full text.
 * @returns the value unchanged when short enough, else a truncated tail.
 */
function truncate(value: string): string {
  if (value.length <= MAX_MESSAGE_CHARS) return value
  return `${value.slice(0, MAX_MESSAGE_CHARS - 1)}…`
}

/**
 * Spawn one `display notification` banner, fire-and-forget. The banner exits
 * on its own; a failed spawn or a non-zero exit is logged as a warning, never
 * surfaced to the caller or the model.
 * @param ctx - the plugin context whose subprocess seam runs the banner.
 * @param sound - sound the banner plays; `none` keeps it silent.
 * @param notice - the banner content.
 */
export function notify(ctx: Context, sound: SoundName, notice: Notice): void {
  const spec: SubprocessSpawnSpec = {
    argv: [OSASCRIPT, '-e', notificationScript(notice, sound)],
    cwd: process.cwd(),
    stdio: { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' },
    graceMs: GRACE_MS,
  }
  try {
    const handle = ctx.subprocess.spawn(spec)
    void handle.done.catch((error: unknown) => {
      ctx.logger.warn(`macos-notify: osascript banner failed: ${error}`)
    })
  } catch (error: unknown) {
    ctx.logger.warn(`macos-notify: could not start osascript: ${error}`)
  }
}

/**
 * Register the notification listeners and the settings namespace. Each
 * listener observes without answering or changing anything: the
 * `session/event` observer only reads the `turn/end` reason, and the
 * `approval/request` waterfall listener always delegates with `next()` so it
 * never claims a decision. Every listener resolves the settings source at
 * event time, so a sound or text changed on the settings page applies to the
 * next banner without a reload.
 * @param ctx - the plugin context.
 * @param config - the composition entry for the `macos-notify` namespace.
 * @throws {Error} when the host is not macOS or the entry config is invalid.
 */
export function apply(ctx: Context, config: Config): void {
  if (process.platform !== 'darwin') {
    throw new Error(
      `dsh-macos-notify requires macOS: osascript Notification Center banners `
      + `are unavailable on "${process.platform}"`,
    )
  }
  resolveSettings(config)

  // The composition entry is the source until a settings provider attaches;
  // `installSection` swaps in the resolved scope and restores this fallback
  // when the provider goes away.
  let source: () => NotifySettings = () => config
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
      setSource: (current) => { source = current },
      onChange: () => {},
      validate: (value) => { resolveSettings(value) },
    })
    installPreview(ctx, settingsCtx.settings)
  })

  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    if (event.type !== 'turn/end') return
    const settings = resolveSettings(source())
    if (!settings.notifyOnTurnEnd) return
    if (settings.topLevelOnly && isDelegated(session)) return
    const key = soundKeyOf(event.data.reason)
    const values = turnEndValues(event.data.reason, event.data.turn)
    notify(ctx, settings.sounds[key], renderNotice(settings.messages[key], values))
  })

  ctx.on('approval/request', (req: ApprovalRequest, next) => {
    const settings = resolveSettings(source())
    if (settings.notifyOnApproval && !(settings.topLevelOnly && isDelegated(req.agent.session))) {
      notify(ctx, settings.sounds.approval, renderNotice(settings.messages.approval, approvalValues(req)))
    }
    return next()
  })
}

/**
 * Wire the preview namespace: the settings page writes one request there, the
 * Host fires that banner, then drops the request again.
 *
 * The document is durable and a preview is not configuration, so a fired
 * request is cleared rather than left in `settings.yaml`. The clear is
 * skipped when a newer request already replaced the one that fired, and the
 * nonce carried by each request is what makes "newer" decidable.
 * @param ctx - the plugin context whose subprocess seam runs the banner.
 * @param settings - the settings service holding the preview namespace.
 */
function installPreview(ctx: Context, settings: SettingsProvider): void {
  const previews = settings.register(PREVIEW_NAMESPACE, PreviewConfig)
  // A request left over from an earlier run must not fire at this boot.
  let fired = previews.get().nonce
  previews.watch((request) => {
    if (!isSoundKey(request.op) || request.nonce === 0 || request.nonce === fired) return
    fired = request.nonce
    notify(ctx, isSoundName(request.sound) ? request.sound : DEFAULT_SOUNDS[request.op], {
      title: truncate(request.title),
      message: truncate(request.message),
    })
    if (previews.get().nonce !== request.nonce) return
    void settings.replace(PREVIEW_NAMESPACE, {}).catch((error: unknown) => {
      ctx.logger.warn(`macos-notify: could not clear the preview request: ${error}`)
    })
  })
}

/**
 * Whether a session is a subagent child. `delegationDepth` is the durable
 * subagent marker (absent or zero for a top-level session, parent depth + 1
 * for a child); a user fork carries `parentSession` but no depth, so it stays
 * top-level.
 * @param session - the session being classified.
 * @returns true only when the session belongs to delegated subagent work.
 */
function isDelegated(session: Session): boolean {
  return (session.header.delegationDepth ?? 0) > 0
}
