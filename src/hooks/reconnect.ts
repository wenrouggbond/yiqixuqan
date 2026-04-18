export function clearReconnectTimer(reconnectTimerRef: { current: ReturnType<typeof setTimeout> | null }) {
  if (!reconnectTimerRef.current) {
    return;
  }

  clearTimeout(reconnectTimerRef.current);
  reconnectTimerRef.current = null;
}

export function scheduleReconnect(
  reconnectTimerRef: { current: ReturnType<typeof setTimeout> | null },
  activeRef: { current: boolean },
  onReconnect: () => void,
  delay = 1200
) {
  clearReconnectTimer(reconnectTimerRef);
  reconnectTimerRef.current = setTimeout(() => {
    if (!activeRef.current) {
      return;
    }

    onReconnect();
  }, delay);
}
