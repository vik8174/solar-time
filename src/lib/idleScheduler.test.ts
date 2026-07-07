import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDeferredRunner, scheduleOnIdle } from './idleScheduler';

describe('createDeferredRunner', () => {
  it('defers the task to the scheduler instead of running it synchronously', () => {
    const task = vi.fn();
    const run = createDeferredRunner(() => {
      /* never fires the task */
    });
    run(task);
    expect(task).not.toHaveBeenCalled();
  });

  it('runs the task when the scheduler fires', () => {
    const task = vi.fn();
    const run = createDeferredRunner((t) => {
      t();
    });
    run(task);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('schedules at most once no matter how many times it is invoked', () => {
    const schedule = vi.fn();
    const run = createDeferredRunner(schedule);
    run(vi.fn());
    run(vi.fn());
    run(vi.fn());
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('ignores tasks from repeat calls (only the first is ever scheduled)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const run = createDeferredRunner((t) => {
      t();
    });
    run(first);
    run(second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});

describe('scheduleOnIdle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses requestIdleCallback when the browser provides it', () => {
    const ric = vi.fn();
    vi.stubGlobal('requestIdleCallback', ric);
    scheduleOnIdle(() => {
      /* noop */
    });
    expect(ric).toHaveBeenCalledTimes(1);
  });

  it('runs the task via the requestIdleCallback callback', () => {
    const task = vi.fn();
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
    });
    scheduleOnIdle(task);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('falls back to setTimeout when requestIdleCallback is absent', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.useFakeTimers();
    const task = vi.fn();
    scheduleOnIdle(task);
    expect(task).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
