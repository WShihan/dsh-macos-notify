/**
 * The Notifications settings page: one switch per banner trigger and one block
 * per banner-producing operation, each holding that operation's sound, title,
 * and body. Rendered as a feature-owned section of the settings shell.
 * @module dsh-macos-notify/client/NotificationsSection
 */

import type { CSSProperties, ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  PLACEHOLDERS, SOUND_KEYS, SOUND_NAMES, isSoundName, type SoundKey, type SoundName,
} from '../settings.ts'
import type { NotificationsFace } from './notifications-controller.ts'
import { LOCALE_NAMESPACE, SOUND_LABEL_KEYS } from './locales.ts'

/** Props the renderer binds for the Notifications section. */
export type NotificationsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<typeof LOCALE_NAMESPACE>
  & InjectFace<NotificationsFace>

/** Operations whose banner belongs to a turn ending; approval renders apart. */
const TURN_END_KEYS: readonly SoundKey[] = SOUND_KEYS.filter(key => key !== 'approval')

const styles: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', padding: '4px 2px 16px', maxWidth: 620 },
  intro: {
    margin: '0 0 6px', fontSize: 12, lineHeight: 1.6,
    color: 'var(--dsw-alias-label-secondary, inherit)',
  },
  groupTitle: {
    margin: '14px 0 2px', paddingTop: 10, fontSize: 12, fontWeight: 600,
    color: 'var(--dsw-alias-label-secondary, inherit)',
    borderTop: '1px solid var(--dsw-alias-border-l1, #e5e7eb)',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, minHeight: 34,
  },
  operation: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' },
  operationHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  field: { display: 'flex', alignItems: 'center', gap: 10 },
  fieldLabel: {
    flex: '0 0 46px', fontSize: 12,
    color: 'var(--dsw-alias-label-secondary, inherit)',
  },
  input: {
    flex: '1 1 auto', minWidth: 0, padding: '4px 8px', fontSize: 13, borderRadius: 6,
    color: 'var(--dsw-alias-label-primary, inherit)',
    background: 'var(--dsw-alias-bg-overlay, transparent)',
    border: '1px solid var(--dsw-alias-border-l2, #d1d5db)',
  },
  label: { fontSize: 13, color: 'var(--dsw-alias-label-primary, inherit)' },
  hint: { margin: '2px 0 0', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, inherit)' },
  controls: { display: 'flex', alignItems: 'center', gap: 6 },
  select: {
    minWidth: 140, padding: '3px 6px', fontSize: 13, borderRadius: 6,
    color: 'var(--dsw-alias-label-primary, inherit)',
    background: 'var(--dsw-alias-bg-overlay, transparent)',
    border: '1px solid var(--dsw-alias-border-l2, #d1d5db)',
  },
  button: {
    padding: '3px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6,
    color: 'var(--dsw-alias-label-secondary, inherit)',
    background: 'transparent',
    border: '1px solid var(--dsw-alias-border-l2, #d1d5db)',
  },
  primary: {
    padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6,
    color: 'var(--dsw-alias-label-primary-inverted, #fff)',
    background: 'var(--dsw-alias-brand-primary, #2563eb)',
    border: '1px solid var(--dsw-alias-brand-primary, #2563eb)',
  },
  badge: {
    marginLeft: 6, padding: '1px 5px', borderRadius: 4, fontSize: 10,
    color: 'var(--dsw-alias-brand-primary, #2563eb)',
    border: '1px solid var(--dsw-alias-brand-primary, #2563eb)',
  },
  saveBar: {
    position: 'sticky', bottom: 0, marginTop: 14, padding: '8px 10px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1, transparent)',
    border: '1px solid var(--dsw-alias-border-l1, #e5e7eb)',
  },
  notice: {
    margin: '10px 0 0', fontSize: 11,
    color: 'var(--dsw-alias-state-error-primary, #dc2626)',
  },
  status: {
    margin: '8px 0 0', fontSize: 11,
    color: 'var(--dsw-alias-label-tertiary, inherit)',
  },
}

/**
 * Render the Notifications settings page.
 * @param props - locale copy, the page snapshot, and its write actions.
 * @returns the page, or nothing until the Host serves the namespace.
 */
export function NotificationsSection(props: NotificationsSectionProps) {
  const { t } = props
  const state = props.useNotifications(snapshot => snapshot)
  if (!state.available) return null
  const disabled = !state.writable

  const soundLabel = (sound: SoundName): string =>
    sound === 'none' ? t('soundNone') : sound === 'default' ? t('soundDefault') : sound

  const textField = (key: SoundKey, name: string, field: 'title' | 'message', label: string) => {
    const current = state.operations[key][field]
    return (
      <label style={styles.field}>
        <span style={styles.fieldLabel}>{label}</span>
        <input
          type="text"
          style={styles.input}
          aria-label={`${name} ${label}`}
          value={current.draft}
          disabled={disabled}
          onChange={(event) => { props.editText(key, field, event.target.value) }}
        />
      </label>
    )
  }

  const operationBlock = (key: SoundKey): ReactElement => {
    const operation = state.operations[key]
    const name = t(SOUND_LABEL_KEYS[key])
    const overridden = operation.soundOverridden || operation.title.overridden || operation.message.overridden
    return (
      <div key={key} style={styles.operation}>
        <div style={styles.operationHead}>
          <span style={styles.label}>
            {name}
            {overridden ? <span style={styles.badge}>{t('overridden')}</span> : null}
          </span>
          <span style={styles.controls}>
            <select
              aria-label={name}
              style={styles.select}
              value={operation.sound}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.value
                if (isSoundName(next)) props.setSound(key, next)
              }}
            >
              {SOUND_NAMES.map(sound => <option key={sound} value={sound}>{soundLabel(sound)}</option>)}
            </select>
            <button
              type="button"
              style={styles.button}
              disabled={disabled || state.testing !== undefined}
              onClick={() => { props.test(key) }}
            >
              {state.testing === key ? t('testing') : t('test')}
            </button>
            {overridden
              ? (
                <button
                  type="button"
                  style={styles.button}
                  disabled={disabled}
                  onClick={() => { props.resetOperation(key) }}
                >
                  {t('reset')}
                </button>
              )
              : null}
          </span>
        </div>
        {textField(key, name, 'title', t('messageTitle'))}
        {textField(key, name, 'message', t('messageBody'))}
        <p style={styles.hint}>
          {t('placeholders')}: {PLACEHOLDERS[key].map(name => `{${name}}`).join('  ')}
        </p>
      </div>
    )
  }

  const toggleRow = (
    field: 'notifyOnTurnEnd' | 'notifyOnApproval' | 'topLevelOnly',
    labelKey: 'notifyOnTurnEnd' | 'notifyOnApproval' | 'topLevelOnly',
    hintKey: 'notifyOnTurnEndHint' | 'notifyOnApprovalHint' | 'topLevelOnlyHint',
    checked: boolean,
  ) => (
    <div style={styles.row}>
      <span>
        <span style={styles.label}>{t(labelKey)}</span>
        <p style={styles.hint}>{t(hintKey)}</p>
      </span>
      <input
        type="checkbox"
        aria-label={t(labelKey)}
        checked={checked}
        disabled={disabled}
        onChange={(event) => { props.setToggle(field, event.target.checked) }}
      />
    </div>
  )

  return (
    <div style={styles.page} aria-label={t('nav')}>
      <p style={styles.intro}>{t('description')}</p>

      <h3 style={styles.groupTitle}>{t('triggersSection')}</h3>
      {toggleRow('notifyOnTurnEnd', 'notifyOnTurnEnd', 'notifyOnTurnEndHint', state.notifyOnTurnEnd)}
      {toggleRow('notifyOnApproval', 'notifyOnApproval', 'notifyOnApprovalHint', state.notifyOnApproval)}
      {toggleRow('topLevelOnly', 'topLevelOnly', 'topLevelOnlyHint', state.topLevelOnly)}

      <h3 style={styles.groupTitle}>{t('turnEndSection')}</h3>
      {TURN_END_KEYS.map(operationBlock)}

      <h3 style={styles.groupTitle}>{t('approvalSection')}</h3>
      {operationBlock('approval')}

      {state.dirty
        ? (
          <div style={styles.saveBar}>
            <span style={styles.status}>{t('unsaved')}</span>
            <span style={styles.controls}>
              <button
                type="button"
                style={styles.primary}
                disabled={disabled || state.saving}
                onClick={() => { props.save() }}
              >
                {t('save')}
              </button>
              <button
                type="button"
                style={styles.button}
                disabled={state.saving}
                onClick={() => { props.discard() }}
              >
                {t('discard')}
              </button>
            </span>
          </div>
        )
        : null}

      {state.failed ? <p style={styles.notice}>{t('failed')}</p> : null}
      {disabled ? <p style={styles.status}>{t('readOnly')}</p> : null}
      {state.saving ? <p style={styles.status}>{t('saving')}</p> : null}
    </div>
  )
}
