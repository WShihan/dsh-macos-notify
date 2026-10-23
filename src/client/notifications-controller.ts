/**
 * The notification settings page's model over the plugin's own configuration
 * entry (the `macos-notify` profile entry).
 *
 * Sounds and toggles commit as the user picks them: a select has no free-text
 * state to stage, and the shared configuration form already serializes writes
 * and fences them by revision. Text is staged instead — one banner body is
 * typed character by character, and a settings write is a durable document
 * mutation, so committing per keystroke would store edits the user never
 * asked for. The staged text is written by one `mutate` when the user saves.
 *
 * The controller publishes one immutable snapshot for the page and keeps the
 * reference stable while nothing the page renders has moved, so an unrelated
 * configuration commit does not re-render it.
 * @module dsh-macos-notify/client/notifications-controller
 */

import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_MESSAGES, DEFAULT_SOUNDS, SOUND_KEYS, isSoundName, renderTemplate,
  type NotifySettings, type PreviewRequest, type SoundKey, type SoundName,
} from '../settings.ts'
import { createSnapshotStore, type SnapshotStore } from './snapshot-store.ts'

/** Boolean fields the page edits. */
export type ToggleField = 'notifyOnTurnEnd' | 'notifyOnApproval' | 'topLevelOnly'

/** Text fields one operation carries. */
export type TextField = 'title' | 'message'

/** Sample text one operation substitutes for its placeholders in a preview. */
export type PreviewSamples = Readonly<Record<SoundKey, Readonly<Record<string, string>>>>

/** One text field: what it resolves to, whether the user layer carries it, and the staged draft. */
export interface TextFieldState {
  /** Resolved text: the user layer over the composition layer over the default. */
  readonly value: string
  /** Whether the raw user layer carries this field, which a reset clears. */
  readonly overridden: boolean
  /** Text the input renders; equal to {@link value} while nothing is staged. */
  readonly draft: string
}

/** One operation's controls. */
export interface OperationState {
  /** Sound in force. */
  readonly sound: SoundName
  /** Whether the raw user layer carries the sound. */
  readonly soundOverridden: boolean
  /** Banner title field. */
  readonly title: TextFieldState
  /** Banner body field. */
  readonly message: TextFieldState
}

/** What the page renders. */
export interface NotificationsState {
  /** False until the Host answers with this namespace; the page renders nothing. */
  readonly available: boolean
  /** Whether the Host document accepts writes. */
  readonly writable: boolean
  /** Whether a write is crossing the wire. */
  readonly saving: boolean
  /** Whether the last write was refused; cleared by the next edit. */
  readonly failed: boolean
  /** Whether staged text differs from what is stored, which enables saving. */
  readonly dirty: boolean
  /** Operation whose preview is crossing the wire, if any. */
  readonly testing: SoundKey | undefined
  /** Banner one notification per completed agent turn. */
  readonly notifyOnTurnEnd: boolean
  /** Banner when an approval request reaches the answerer chain. */
  readonly notifyOnApproval: boolean
  /** Skip sessions owned by delegated subagent work. */
  readonly topLevelOnly: boolean
  /** Per-operation controls. */
  readonly operations: Readonly<Record<SoundKey, OperationState>>
}

/** Writes the page performs. */
export interface NotificationsActions {
  /**
   * Write one boolean field.
   * @param field - field to write.
   * @param value - value the user selected.
   */
  setToggle(field: ToggleField, value: boolean): void
  /**
   * Write one operation's sound.
   * @param key - operation whose sound changes.
   * @param value - sound the user selected.
   */
  setSound(key: SoundKey, value: SoundName): void
  /**
   * Send one preview banner for an operation, using the text as it currently
   * reads on the page — including staged edits.
   * @param key - operation to preview.
   */
  test(key: SoundKey): void
  /**
   * Stage one operation's text; equal to the stored text removes the stage.
   * @param key - operation whose text changes.
   * @param field - title or body.
   * @param text - the text in the input.
   */
  editText(key: SoundKey, field: TextField, text: string): void
  /** Write every staged text field in one settings mutation. */
  save(): void
  /** Drop every staged text field. */
  discard(): void
  /**
   * Clear all three overrides of one operation back to the composition layer.
   * @param key - operation to reset.
   */
  resetOperation(key: SoundKey): void
}

/** The registration-side face the page's slot entry injects. */
export interface NotificationsFace extends NotificationsActions {
  hooks: {
    /** Page snapshot bound by the renderer as useNotifications. */
    notifications: SnapshotStore<NotificationsState>
  }
}

/** The state rendered before the Host answers. */
function initialState(): NotificationsState {
  const operations = {} as Record<SoundKey, OperationState>
  for (const key of SOUND_KEYS) {
    const text = { value: '', overridden: false, draft: '' }
    operations[key] = {
      sound: DEFAULT_SOUNDS[key],
      soundOverridden: false,
      title: { ...text, value: DEFAULT_MESSAGES[key].title, draft: DEFAULT_MESSAGES[key].title },
      message: { ...text, value: DEFAULT_MESSAGES[key].message, draft: DEFAULT_MESSAGES[key].message },
    }
  }
  return {
    available: false, writable: false, saving: false, failed: false, dirty: false,
    testing: undefined,
    notifyOnTurnEnd: true, notifyOnApproval: true, topLevelOnly: true, operations,
  }
}

/** Read one nested object from a raw settings layer, or an empty record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/** Stage key of one text field. */
function stageId(key: SoundKey, field: TextField): string {
  return `${key}.${field}`
}

/** Whether two published states render identically. */
function sameState(left: NotificationsState, right: NotificationsState): boolean {
  if (left.available !== right.available
    || left.writable !== right.writable
    || left.saving !== right.saving
    || left.failed !== right.failed
    || left.dirty !== right.dirty
    || left.testing !== right.testing
    || left.notifyOnTurnEnd !== right.notifyOnTurnEnd
    || left.notifyOnApproval !== right.notifyOnApproval
    || left.topLevelOnly !== right.topLevelOnly) return false
  return SOUND_KEYS.every((key) => {
    const a = left.operations[key]
    const b = right.operations[key]
    return a.sound === b.sound
      && a.soundOverridden === b.soundOverridden
      && sameText(a.title, b.title)
      && sameText(a.message, b.message)
  })
}

/** Whether two text fields render identically. */
function sameText(left: TextFieldState, right: TextFieldState): boolean {
  return left.value === right.value && left.overridden === right.overridden && left.draft === right.draft
}

/** Bridges the `macos-notify` settings scope onto the page's snapshot. */
export class NotificationsController {
  private readonly store = createSnapshotStore<NotificationsState>(initialState())
  private readonly unsubscribe: () => void
  /** Staged text by `${operation}.${field}`; an entry always differs from what is stored. */
  private readonly staged = new Map<string, string>()
  /**
   * Sounds written but not yet visible in the mirror. A preview taken right
   * after a pick, or while its write is still crossing, must play what the
   * page shows rather than the value it is replacing.
   */
  private readonly pickedSounds = new Map<SoundKey, SoundName>()
  private pending = 0
  private failed = false
  private testing: SoundKey | undefined
  /** Request id for the configuration's preview field; every click writes a new one. */
  private nonce = Date.now()
  private disposed = false

  /**
   * @param scope - the shared configuration form of the `macos-notify` entry.
   * @param samples - placeholder samples a preview substitutes, read at click
   * time so a locale change reaches the next preview.
   */
  constructor(
    private readonly scope: ConfigForm<NotifySettings>,
    private readonly samples: () => PreviewSamples,
  ) {
    this.unsubscribe = scope.subscribe(() => { this.publish() })
    this.publish()
  }

  /** Stop following the scope; later settlements publish nothing. */
  dispose(): void {
    this.disposed = true
    this.unsubscribe()
  }

  /**
   * Build the face the page's slot registration injects.
   * @returns the page's snapshot and its write actions.
   */
  inject(): NotificationsFace {
    return {
      hooks: { notifications: this.store },
      setToggle: (field, value) => { this.run(() => this.scope.set(field, value)) },
      setSound: (key, value) => {
        this.pickedSounds.set(key, value)
        this.run(
          () => this.scope.mutate([{ op: 'set', path: ['sounds', key], value }]),
          { onFailure: () => { this.pickedSounds.delete(key) } },
        )
      },
      test: (key) => { this.test(key) },
      editText: (key, field, text) => { this.stage(key, field, text) },
      save: () => { this.save() },
      discard: () => { this.discard() },
      resetOperation: (key) => { this.resetOperation(key) },
    }
  }

  /** Project the scope snapshot onto what the page renders. */
  private projection(): NotificationsState {
    const snapshot = this.scope.getSnapshot()
    const section = snapshot.value
    const user = asRecord(snapshot.user)
    const userSounds = asRecord(user.sounds)
    const userMessages = asRecord(user.messages)
    const operations = {} as Record<SoundKey, OperationState>
    let dirty = false

    const text = (key: SoundKey, field: TextField, stored: string, overridden: boolean): TextFieldState => {
      const draft = this.staged.get(stageId(key, field))
      if (draft === undefined || draft === stored) return { value: stored, overridden, draft: stored }
      dirty = true
      return { value: stored, overridden, draft }
    }

    for (const key of SOUND_KEYS) {
      const configured = section?.sounds?.[key]
      const configuredMessages = section?.messages?.[key]
      const userMessage = asRecord(userMessages[key])
      const defaults = DEFAULT_MESSAGES[key]
      const soundOverridden = userSounds[key] !== undefined
      const titleOverridden = userMessage.title !== undefined
      const messageOverridden = userMessage.message !== undefined
      const resolvedSound = isSoundName(configured) ? configured : DEFAULT_SOUNDS[key]
      const picked = this.pickedSounds.get(key)
      if (picked !== undefined && picked === resolvedSound) this.pickedSounds.delete(key)
      operations[key] = {
        sound: picked ?? resolvedSound,
        soundOverridden,
        title: text(key, 'title', configuredMessages?.title ?? defaults.title, titleOverridden),
        message: text(key, 'message', configuredMessages?.message ?? defaults.message, messageOverridden),
      }
    }

    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      saving: this.pending > 0,
      failed: this.failed,
      dirty,
      testing: this.testing,
      notifyOnTurnEnd: section?.notifyOnTurnEnd ?? true,
      notifyOnApproval: section?.notifyOnApproval ?? true,
      topLevelOnly: section?.topLevelOnly ?? true,
      operations,
    }
  }

  /** Stored text of one field in the current scope snapshot. */
  private storedText(key: SoundKey, field: TextField): string {
    const section = this.scope.getSnapshot().value
    return section?.messages?.[key]?.[field] ?? DEFAULT_MESSAGES[key][field]
  }

  private stage(key: SoundKey, field: TextField, text: string): void {
    const id = stageId(key, field)
    if (text === this.storedText(key, field)) this.staged.delete(id)
    else this.staged.set(id, text)
    this.publish()
  }

  private test(key: SoundKey): void {
    const operation = this.projection().operations[key]
    const values = this.samples()[key]
    const request: PreviewRequest = {
      op: key,
      nonce: ++this.nonce,
      sound: operation.sound,
      title: renderTemplate(operation.title.draft, values),
      message: renderTemplate(operation.message.draft, values),
    }
    this.testing = key
    this.run(
      () => this.scope.set('preview', request),
      { onSettle: () => { this.testing = undefined } },
    )
  }

  private save(): void {
    if (this.staged.size === 0) return
    const written = [...this.staged]
    const ops = written.map(([id, value]) => {
      const [key, field] = id.split('.') as [SoundKey, TextField]
      return { op: 'set' as const, path: ['messages', key, field], value }
    })
    this.run(() => this.scope.mutate(ops), {
      onSuccess: () => {
        // A field typed into again while the write was in flight keeps its
        // newer stage; only the text this write carried is settled.
        for (const [id, value] of written) {
          if (this.staged.get(id) === value) this.staged.delete(id)
        }
      },
    })
  }

  private discard(): void {
    if (this.staged.size === 0) return
    this.staged.clear()
    this.publish()
  }

  private resetOperation(key: SoundKey): void {
    this.run(
      () => this.scope.mutate([
        { op: 'unset', path: ['sounds', key] },
        { op: 'unset', path: ['messages', key, 'title'] },
        { op: 'unset', path: ['messages', key, 'message'] },
      ]),
      {
        onSuccess: () => {
          this.staged.delete(stageId(key, 'title'))
          this.staged.delete(stageId(key, 'message'))
        },
      },
    )
  }

  private publish(): void {
    if (this.disposed) return
    const next = this.projection()
    if (sameState(this.store.getSnapshot(), next)) return
    this.store.set(next)
  }

  /**
   * Run one settings write, publishing the in-flight and settled states. A
   * refusal is reported on the page; the configuration mirror is what
   * corrects the rendered values afterwards.
   * @param write - the queued configuration write.
   * @param hooks - staged state to settle once the write lands, optimistic
   * state to drop when it does not, and in-flight state to clear either way.
   */
  private run(
    write: () => Promise<boolean>,
    hooks: { onSuccess?: () => void; onFailure?: () => void; onSettle?: () => void } = {},
  ): void {
    this.failed = false
    this.pending += 1
    this.publish()
    void write().then(
      (accepted) => {
        if (!accepted) {
          this.failed = true
          hooks.onFailure?.()
        } else {
          hooks.onSuccess?.()
        }
        hooks.onSettle?.()
        this.settle()
      },
      () => { this.failed = true; hooks.onFailure?.(); hooks.onSettle?.(); this.settle() },
    )
  }

  private settle(): void {
    this.pending -= 1
    this.publish()
  }
}
