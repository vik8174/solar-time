import { describe, expect, it, vi } from 'vitest';

import { BUFFER_LIMIT, createEventBuffer } from './eventBuffer';

describe('createEventBuffer', () => {
  it('buffers events pushed before a sink is attached, then flushes in order', () => {
    const buffer = createEventBuffer<string>();
    const sink = vi.fn();
    buffer.push('a');
    buffer.push('b');
    expect(sink).not.toHaveBeenCalled();

    buffer.attach(sink);
    expect(sink.mock.calls).toEqual([['a'], ['b']]);
  });

  it('forwards events pushed after attach directly to the sink', () => {
    const buffer = createEventBuffer<string>();
    const sink = vi.fn();
    buffer.attach(sink);
    buffer.push('later');
    expect(sink.mock.calls).toEqual([['later']]);
  });

  it('does not double-flush when attached twice', () => {
    const buffer = createEventBuffer<string>();
    const first = vi.fn();
    const second = vi.fn();
    buffer.push('x');
    buffer.attach(first);
    buffer.attach(second);
    expect(first.mock.calls).toEqual([['x']]);
    expect(second).not.toHaveBeenCalled();
  });

  it('drops the oldest events past the bound while no sink is attached', () => {
    const buffer = createEventBuffer<number>(3);
    for (const n of [1, 2, 3, 4, 5]) buffer.push(n);
    const sink = vi.fn();
    buffer.attach(sink);
    // Only the last 3 survive; 1 and 2 were dropped.
    expect(sink.mock.calls).toEqual([[3], [4], [5]]);
  });

  it('defaults the bound to BUFFER_LIMIT', () => {
    const buffer = createEventBuffer<number>();
    for (let n = 0; n < BUFFER_LIMIT + 10; n++) buffer.push(n);
    const sink = vi.fn();
    buffer.attach(sink);
    expect(sink).toHaveBeenCalledTimes(BUFFER_LIMIT);
    // The very first retained event is the (10)th pushed, oldest 10 dropped.
    expect(sink.mock.calls[0]).toEqual([10]);
  });
});
