/**
 * The card's private observable snapshot source. It is the whole contract the
 * slot renderer needs from an injected `hooks` entry — `getSnapshot` plus
 * `subscribe` — which the renderer binds as the component's `use<Name>`
 * selector hook. Keeping the few lines here instead of importing the harness's
 * shared store engine leaves the browser bundle depending on React alone.
 * @module dsh-macos-notify/client/snapshot-store
 */

/** A snapshot source a card publishes to the renderer. */
export interface SnapshotStore<T> {
  /** @returns the current snapshot (stable reference until the next change). */
  getSnapshot(): T
  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each replacement.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void
  /**
   * Replace the snapshot and notify every listener.
   * @param next - the new snapshot.
   */
  set(next: T): void
}

/**
 * Create one snapshot store.
 * @param init - the initial snapshot.
 * @returns the store.
 */
export function createSnapshotStore<T>(init: T): SnapshotStore<T> {
  let snapshot = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      snapshot = next
      // Copied before dispatch: a listener that unsubscribes itself must not
      // shorten the iteration another listener depends on.
      for (const listener of [...listeners]) listener()
    },
  }
}
