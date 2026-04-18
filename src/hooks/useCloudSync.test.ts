import { beforeEach, describe, expect, test, vi } from 'vitest';

import { scheduleReconnect } from './reconnect';

describe('scheduleReconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('retries once after delay when still active', () => {
    const reconnectTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const activeRef = { current: true };
    const onReconnect = vi.fn();

    scheduleReconnect(reconnectTimerRef, activeRef, onReconnect, 1200);
    expect(onReconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1199);
    expect(onReconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  test('cancels previous timer before scheduling next retry', () => {
    const reconnectTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const activeRef = { current: true };
    const onReconnect = vi.fn();

    scheduleReconnect(reconnectTimerRef, activeRef, onReconnect, 1200);
    scheduleReconnect(reconnectTimerRef, activeRef, onReconnect, 1200);

    vi.runAllTimers();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  test('does not retry after cleanup marks connection inactive', () => {
    const reconnectTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const activeRef = { current: true };
    const onReconnect = vi.fn();

    scheduleReconnect(reconnectTimerRef, activeRef, onReconnect, 1200);
    activeRef.current = false;

    vi.runAllTimers();
    expect(onReconnect).not.toHaveBeenCalled();
  });
});
