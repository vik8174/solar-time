/**
 * eventBuffer — the pure "hold events until the sink is ready" core behind
 * `deferredInit` (D-012).
 *
 * Analytics events can be emitted (a `page_view`, a `city_selected`) before the
 * SDK finishes its idle boot. This buffer holds them and, once the real sink is
 * attached, flushes them in order and forwards everything after directly — so no
 * event is lost to the boot delay, and no analytics code leaks into the callers.
 * Extracted from the browser orchestrator specifically so this ordering /
 * flush-once / bounded behavior is unit-testable without the SDKs or a DOM.
 *
 * Bounded: if the sink is never attached (analytics unconfigured or
 * unsupported), the buffer keeps only the most recent {@link BUFFER_LIMIT}
 * events instead of growing without limit for the life of the page.
 */

/** Max events retained while waiting for a sink; oldest are dropped past this. */
export const BUFFER_LIMIT = 50;

/** A buffered forwarder: push events now, attach the real sink later. */
export interface BufferedSink<T> {
  /** Forward to the sink if attached, else buffer (bounded). */
  push: (item: T) => void;
  /** Attach the real sink: flush the buffer in order, then forward directly. */
  attach: (sink: (item: T) => void) => void;
}

/**
 * Creates a bounded buffered sink.
 *
 * @param limit - Max items held before a sink is attached (default {@link BUFFER_LIMIT}).
 */
export const createEventBuffer = <T>(limit: number = BUFFER_LIMIT): BufferedSink<T> => {
  const pending: T[] = [];
  let sink: ((item: T) => void) | null = null;

  return {
    push: (item: T): void => {
      if (sink) {
        sink(item);
        return;
      }
      pending.push(item);
      if (pending.length > limit) pending.shift();
    },
    attach: (next: (item: T) => void): void => {
      sink = next;
      // splice(0) drains and empties in one pass, so a re-attach can't double-flush.
      for (const item of pending.splice(0)) next(item);
    },
  };
};
