/**
 * Copy for the notification settings page, in every shipped locale. Only
 * product text lives here: alert-sound names and placeholder names stay
 * verbatim because they are the identifiers AppleScript and the template
 * grammar resolve, not words this plugin owns.
 * @module dsh-macos-notify/client/locales
 */

// Type-only: the locale slot's declaration, so the page's `t` seat is typed.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { SoundKey } from '../settings.ts'

/** Locale namespace this page owns. */
export const LOCALE_NAMESPACE = 'macos-notify'

/** Locale keys this page renders. */
export type NotifyLocaleKey =
  | 'nav' | 'description'
  | 'notifyOnTurnEnd' | 'notifyOnTurnEndHint'
  | 'notifyOnApproval' | 'notifyOnApprovalHint'
  | 'topLevelOnly' | 'topLevelOnlyHint'
  | 'triggersSection' | 'turnEndSection' | 'approvalSection'
  | 'soundCompleted' | 'soundBlocked' | 'soundAborted'
  | 'soundError' | 'soundMaxTokens' | 'soundInterrupted' | 'soundApproval'
  | 'soundNone' | 'soundDefault'
  | 'messageTitle' | 'messageBody' | 'placeholders'
  | 'overridden' | 'reset' | 'test' | 'testing' | 'save' | 'discard' | 'unsaved'
  | 'sampleError' | 'sampleReason'
  | 'saving' | 'failed' | 'readOnly'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The notification settings page's copy. */
    'macos-notify': NotifyLocaleKey
  }
}

/** Locale key naming each operation's block. */
export const SOUND_LABEL_KEYS: Readonly<Record<SoundKey, NotifyLocaleKey>> = Object.freeze({
  completed: 'soundCompleted',
  blocked: 'soundBlocked',
  aborted: 'soundAborted',
  error: 'soundError',
  maxTokens: 'soundMaxTokens',
  interrupted: 'soundInterrupted',
  approval: 'soundApproval',
})

/** English copy. */
export const en: Record<NotifyLocaleKey, string> = {
  nav: 'Notifications',
  description: 'System banners through osascript when the agent finishes or asks for permission. Text and sound are configurable per operation.',
  notifyOnTurnEnd: 'Notify when a turn ends',
  notifyOnTurnEndHint: 'One banner per turn that closes, whatever its reason.',
  notifyOnApproval: 'Notify on permission requests',
  notifyOnApprovalHint: 'One banner when an approval request reaches you.',
  topLevelOnly: 'Only for my own sessions',
  topLevelOnlyHint: 'Subagent sessions run silently in the background.',
  triggersSection: 'When to notify',
  turnEndSection: 'Turn-end banners',
  approvalSection: 'Permission banner',
  soundCompleted: 'Turn completed',
  soundBlocked: 'Turn blocked',
  soundAborted: 'Turn cancelled',
  soundError: 'Turn failed',
  soundMaxTokens: 'Token limit reached',
  soundInterrupted: 'Turn interrupted',
  soundApproval: 'Permission requested',
  soundNone: 'Silent',
  soundDefault: 'System default',
  messageTitle: 'Title',
  messageBody: 'Body',
  placeholders: 'Placeholders',
  overridden: 'Overridden',
  reset: 'Reset to default',
  test: 'Test',
  testing: 'Sending…',
  save: 'Save',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  sampleError: 'Something went wrong.',
  sampleReason: 'run a command',
  saving: 'Saving…',
  failed: 'The deployment did not accept this change.',
  readOnly: 'This deployment stores settings read-only.',
}

/** Simplified Chinese copy. */
export const zh: Record<NotifyLocaleKey, string> = {
  nav: '通知',
  description: 'agent 结束任务或请求权限时，通过 osascript 弹出系统横幅通知。每种操作的文本与提示音都可配置。',
  notifyOnTurnEnd: '轮次结束时通知',
  notifyOnTurnEndHint: '每个关闭的轮次弹出一条横幅，不论结束原因。',
  notifyOnApproval: '权限请求时通知',
  notifyOnApprovalHint: '审批请求需要你处理时弹出一条横幅。',
  topLevelOnly: '仅通知我自己的会话',
  topLevelOnlyHint: '子 agent 会话在后台静默运行，不弹通知。',
  triggersSection: '通知时机',
  turnEndSection: '轮次结束横幅',
  approvalSection: '权限请求横幅',
  soundCompleted: '轮次完成',
  soundBlocked: '轮次受阻',
  soundAborted: '轮次取消',
  soundError: '轮次失败',
  soundMaxTokens: '达到 token 上限',
  soundInterrupted: '轮次中断',
  soundApproval: '权限请求',
  soundNone: '静音',
  soundDefault: '系统默认',
  messageTitle: '标题',
  messageBody: '内容',
  placeholders: '可用变量',
  overridden: '已覆盖',
  reset: '恢复默认',
  test: '测试',
  testing: '发送中…',
  save: '保存',
  discard: '放弃',
  unsaved: '有未保存的修改',
  sampleError: '出了点问题。',
  sampleReason: '运行一条命令',
  saving: '保存中…',
  failed: '本部署没有接受这次修改。',
  readOnly: '本部署的设置为只读。',
}
