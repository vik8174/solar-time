/**
 * idleScheduler — the pure scheduling core behind `deferredInit` (D-012).
 *
 * Booting the analytics/monitoring SDKs must never block first paint, so their
 * start is deferred to browser idle and must happen **exactly once** even though
 * the mounting `<script>` re-runs on every View-Transition navigation. This
 * module owns only that decision — "defer this task to idle, but run it at most
 * once" — with the actual idle primitive injected so it is testable without a
 * real `requestIdleCallback`. The browser entry (`src/scripts/deferredInit.ts`)
 * is the thin adapter that supplies the real scheduler.
 */

/** A function that runs `task` at some later, non-blocking point. */
export type IdleSchedule = (task: () => void) => void;

/**
 * The production idle primitive: `requestIdleCallback` when available, else a
 * short `setTimeout` fallback (Safari historically lacks rIC). Never runs the
 * task synchronously, so first paint is never blocked.
 */
export const scheduleOnIdle: IdleSchedule = (task) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      task();
    });
  } else {
    setTimeout(task, 1);
  }
};

/**
 * Builds a run-once deferred runner. The returned function schedules `task` on
 * idle the first time it is called and is a no-op on every later call — so a
 * `<script>` that re-executes across navigations still boots the SDKs once.
 *
 * @param schedule - Idle primitive (injected in tests). Defaults to the real one.
 * @returns A function that defers its `task` to idle, at most once.
 */
export const createDeferredRunner = (
  schedule: IdleSchedule = scheduleOnIdle,
): ((task: () => void) => void) => {
  let started = false;
  return (task: () => void): void => {
    if (started) return;
    started = true;
    schedule(task);
  };
};
