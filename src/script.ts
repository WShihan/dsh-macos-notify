/**
 * AppleScript text construction for one Notification Center banner. Kept
 * apart from the plugin body so the escaping rules can be tested on their own;
 * placeholder substitution lives with the message contract in `settings.ts`.
 * @module dsh-macos-notify/script
 */

import type { SoundName } from './settings.ts'

/** One banner: title in bold, body below it. */
export interface Notice {
  /** Banner title, shown bold. */
  readonly title: string
  /** Banner body text. */
  readonly message: string
}

/**
 * Quote a string as an AppleScript literal. JSON escaping is the exact
 * AppleScript subset (`\"` and `\\`); control characters, which AppleScript
 * string literals cannot carry, become spaces first so no JSON `\n`-style
 * escape ever reaches the script.
 * @param value - the raw banner text.
 * @returns an AppleScript string literal.
 */
export function asAppleScriptString(value: string): string {
  return JSON.stringify(value.replace(/[\u0000-\u001f\u007f]/g, ' '))
}

/**
 * Build the `display notification` statement for one banner.
 * @param notice - the banner title and message.
 * @param sound - sound to play; `none` omits the sound clause entirely.
 * @returns one AppleScript statement for `osascript -e`.
 */
export function notificationScript(notice: Notice, sound: SoundName): string {
  const soundClause = sound === 'none' ? '' : ` sound name ${asAppleScriptString(sound)}`
  return `display notification ${asAppleScriptString(notice.message)}`
    + ` with title ${asAppleScriptString(notice.title)}${soundClause}`
}
