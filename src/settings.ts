/**
 * Browser-safe data contract shared by the Host half and the settings page:
 * the settings namespace, the macOS alert-sound catalog, the editable banner
 * text, and the section the Host acts on. This module imports nothing and
 * touches no Node API, so the browser bundle inlines it.
 * @module dsh-macos-notify/settings
 */

/** Settings namespace the Host registers and the page edits. */
export const SETTINGS_NAMESPACE = 'macos-notify'

/**
 * Settings namespace carrying one banner preview request. The page writes it,
 * the Host fires the banner and clears it again. A plugin's browser half
 * reaches the Host only through the generated remote namespaces, and this
 * package ships outside that assembly, so the settings document is the one
 * channel both halves already share.
 */
export const PREVIEW_NAMESPACE = 'macos-notify-preview'

/**
 * Alert sounds every macOS release ships in `/System/Library/Sounds`. The
 * names are Apple's, passed verbatim to AppleScript `sound name`.
 */
export const SYSTEM_SOUNDS = [
  'Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass', 'Hero',
  'Morse', 'Ping', 'Pop', 'Purr', 'Sosumi', 'Submarine', 'Tink',
] as const

/** One built-in macOS alert sound. */
export type SystemSound = (typeof SYSTEM_SOUNDS)[number]

/**
 * One banner sound: a built-in sound, the user's configured alert sound
 * (`default`), or `none` for a silent banner.
 */
export type SoundName = 'none' | 'default' | SystemSound

/** Every accepted banner sound, in the order the settings page offers them. */
export const SOUND_NAMES: readonly SoundName[] = ['none', 'default', ...SYSTEM_SOUNDS]

/**
 * Whether a configuration string names an accepted banner sound.
 * @param value - candidate value from configuration or a settings write.
 * @returns true when the value is one of {@link SOUND_NAMES}.
 */
export function isSoundName(value: unknown): value is SoundName {
  return typeof value === 'string' && (SOUND_NAMES as readonly string[]).includes(value)
}

/** The operations a banner reports; each carries its own sound and text. */
export const SOUND_KEYS = [
  'completed', 'blocked', 'aborted', 'error', 'maxTokens', 'interrupted', 'approval',
] as const

/** One banner-producing operation. */
export type SoundKey = (typeof SOUND_KEYS)[number]

/** Sound every operation plays until the user picks another. */
export const DEFAULT_SOUNDS: Readonly<Record<SoundKey, SoundName>> = Object.freeze({
  completed: 'Glass',
  blocked: 'Funk',
  aborted: 'Basso',
  error: 'Basso',
  maxTokens: 'Funk',
  interrupted: 'Basso',
  approval: 'Ping',
})

/**
 * One banner's editable text. `{name}` sequences are substituted from the
 * operation's placeholder table before the banner is built; a name with no
 * value stays in the text verbatim, so a typo is visible instead of silently
 * dropping the paragraph it sat in.
 */
export interface MessageTemplate {
  /** Banner title, shown bold. Absent inherits the default. */
  title?: string
  /** Banner body. Absent inherits the default. */
  message?: string
}

/** One operation's banner text with both fields present. */
export interface ResolvedMessage {
  /** Banner title, shown bold. */
  readonly title: string
  /** Banner body. */
  readonly message: string
}

/** Banner text every operation shows until the user writes another. */
export const DEFAULT_MESSAGES: Readonly<Record<SoundKey, ResolvedMessage>> = Object.freeze({
  completed: Object.freeze({ title: 'Task completed', message: 'The agent finished its turn.' }),
  blocked: Object.freeze({ title: 'Task blocked', message: 'The agent could not proceed.' }),
  aborted: Object.freeze({ title: 'Task cancelled', message: 'The agent was cancelled.' }),
  error: Object.freeze({ title: 'Task failed', message: '{error}' }),
  maxTokens: Object.freeze({ title: 'Token limit reached', message: 'The agent hit the output token ceiling.' }),
  interrupted: Object.freeze({ title: 'Turn interrupted', message: 'The turn was interrupted.' }),
  approval: Object.freeze({ title: 'Permission requested', message: '{tool} needs {reason}' }),
})

/**
 * Placeholders each operation's template may use. Every value is available
 * whenever that operation fires; a template may also use none of them.
 */
export const PLACEHOLDERS: Readonly<Record<SoundKey, readonly string[]>> = Object.freeze({
  completed: Object.freeze(['turn']),
  blocked: Object.freeze(['turn']),
  aborted: Object.freeze(['turn', 'cause']),
  error: Object.freeze(['turn', 'error']),
  maxTokens: Object.freeze(['turn']),
  interrupted: Object.freeze(['turn']),
  approval: Object.freeze(['tool', 'reason']),
})

/**
 * Banner text as it arrives from `cordis.yml` or the settings document. Every
 * field is a plain string because configuration is untyped YAML.
 */
export type MessagesSettings = Partial<Record<SoundKey, MessageTemplate>>

/** One `{name}` sequence, the whole placeholder grammar. */
const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Substitute `{name}` sequences from one operation's value table. A name with
 * no value stays verbatim, so a misspelled placeholder shows up in the banner
 * instead of erasing the sentence around it.
 * @param template - the configured or default template.
 * @param values - placeholder values for the operation that is firing.
 * @returns the template with every known placeholder replaced.
 */
export function renderTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (match, name: string) => values[name] ?? match)
}

/**
 * Whether a configuration string names one of {@link SOUND_KEYS}.
 * @param value - candidate value from configuration or the settings document.
 * @returns true when the value is an operation key.
 */
export function isSoundKey(value: unknown): value is SoundKey {
  return typeof value === 'string' && (SOUND_KEYS as readonly string[]).includes(value)
}

/**
 * One banner preview request as the settings page writes it: which operation
 * is being tried, a value that changes on every click, and the exact banner
 * text the click should produce.
 */
export interface PreviewRequest {
  /** Operation the request belongs to. */
  readonly op: string
  /** Monotonic request id; the Host fires once per new value. */
  readonly nonce: number
  /** Sound to play; an unknown name falls back to the operation's default. */
  readonly sound: string
  /** Banner title, already rendered. */
  readonly title: string
  /** Banner body, already rendered. */
  readonly message: string
}

/**
 * Sound names as they arrive from `cordis.yml` or the settings document.
 * Every field is a plain string because configuration is untyped YAML; the
 * Host validates it against {@link SOUND_NAMES} before use.
 */
export interface SoundsSettings {
  /** Sound for a turn that completed. */
  completed?: string
  /** Sound for a turn the agent could not continue. */
  blocked?: string
  /** Sound for a cancelled turn. */
  aborted?: string
  /** Sound for a failed turn. */
  error?: string
  /** Sound for a turn that hit the output-token ceiling. */
  maxTokens?: string
  /** Sound for a turn closed after a crash. */
  interrupted?: string
  /** Sound for an approval request reaching the answerer chain. */
  approval?: string
}

/**
 * The settings section as it is edited: schema-resolved on the wire, so every
 * field arrives populated; optional here so a partial composition entry and a
 * page rendered before the first read share one type.
 */
export interface NotifySettings {
  /** Banner one notification per completed agent turn. */
  notifyOnTurnEnd?: boolean
  /** Banner when an approval request reaches the answerer chain. */
  notifyOnApproval?: boolean
  /** Skip sessions owned by delegated subagent work. */
  topLevelOnly?: boolean
  /** Per-operation banner sounds. */
  sounds?: SoundsSettings
  /** Per-operation banner text. */
  messages?: MessagesSettings
}

/** The section the Host acts on: defaults filled, every sound validated. */
export interface ResolvedNotifySettings {
  /** Banner one notification per completed agent turn. */
  notifyOnTurnEnd: boolean
  /** Banner when an approval request reaches the answerer chain. */
  notifyOnApproval: boolean
  /** Skip sessions owned by delegated subagent work. */
  topLevelOnly: boolean
  /** Per-operation banner sounds, every key present. */
  sounds: Readonly<Record<SoundKey, SoundName>>
  /** Per-operation banner text, every key present. */
  messages: Readonly<Record<SoundKey, ResolvedMessage>>
}
