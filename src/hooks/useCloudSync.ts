import { startTransition, useEffect, useRef, useState } from 'react';

import { clearReconnectTimer, scheduleReconnect } from './reconnect';
import {
  isKnownSyncedSnapshot,
  LocalSettings,
  normalizeRemoteSharedState,
  normalizeRoomCode,
  normalizeRoomSecret,
  serializeSharedStateSnapshot,
  SharedState,
} from '../models';
import {
  fetchSharedState,
  isSupabaseConfigured,
  prepareRoomAccess,
  subscribeSharedState,
  upsertSharedState,
} from '../sync';

type SyncTone = 'idle' | 'live' | 'error';
type RoomInitStatus = 'pending' | 'applying_remote' | 'ready';

type Params = {
  sharedState: SharedState;
  localSettings: LocalSettings;
  sharedStateRef: React.MutableRefObject<SharedState>;
  localSettingsRef: React.MutableRefObject<LocalSettings>;
  isHydrated: boolean;
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>;
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>;
  setSyncTone: React.Dispatch<React.SetStateAction<SyncTone>>;
  setSyncTitle: React.Dispatch<React.SetStateAction<string>>;
  setSyncDetail: React.Dispatch<React.SetStateAction<string>>;
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>;
  syncCleanupRef: React.MutableRefObject<null | (() => void)>;
  syncTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingRemoteSerializedRef: React.MutableRefObject<string | null>;
  lastSyncedSerializedRef: React.MutableRefObject<string | null>;
};

type ManualSyncResult =
  | { status: 'success' }
  | { status: 'missing_room' }
  | { status: 'room_changed'; roomCode: string }
  | { status: 'not_ready'; hasConflict: boolean }
  | { status: 'error' }
  | { status: 'conflict' };

type ConflictResolution = 'use_remote' | 'use_local';

type ConflictResolutionResult =
  | { status: 'success' }
  | { status: 'missing_room' }
  | { status: 'error' }
  | { status: 'conflict' };

const CONNECT_FIRST_MESSAGE = '先保存房间码并等待首次拉取完成，再手动同步，避免覆盖远端已有数据。';
const CONFLICT_MESSAGE = '云端已被另一台设备更新，当前已暂停上传，请先确认保留哪一端的数据。';
const CONFLICT_PENDING_MESSAGE = '检测到双端同时修改。当前已暂停上传，避免互相覆盖；请先确认保留哪一端的数据。';

function canApplyRemoteImmediately(currentState: SharedState, nextState: SharedState) {
  return serializeSharedStateSnapshot(nextState) === serializeSharedStateSnapshot(currentState);
}

function normalizeRequestedRoomCode(roomCode: string) {
  return normalizeRoomCode(roomCode);
}

function normalizeRequestedRoomSecret(roomSecret: string) {
  return normalizeRoomSecret(roomSecret);
}

function isManualSyncBlocked(
  requestedRoomCode: string,
  requestedRoomSecret: string,
  currentRoomCode: string,
  currentRoomSecret: string,
  canManualSync: boolean,
  hasSyncConflict: boolean
) {
  if (!requestedRoomCode || !requestedRoomSecret) {
    return { status: 'missing_room' } as const;
  }

  if (requestedRoomCode !== currentRoomCode || requestedRoomSecret !== currentRoomSecret) {
    return { status: 'room_changed', roomCode: requestedRoomCode } as const;
  }

  if (!canManualSync) {
    return { status: 'not_ready', hasConflict: hasSyncConflict } as const;
  }

  return null;
}

function handleManualSyncSuccess(
  roomCode: string,
  state: SharedState,
  updatedAt: string | null,
  roomInitStatusRef: React.MutableRefObject<Record<string, RoomInitStatus>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setManualSyncReadyRoom: React.Dispatch<React.SetStateAction<string>>,
  lastSyncedSerializedRef: React.MutableRefObject<string | null>,
  lastRemoteUpdatedAtRef: React.MutableRefObject<string | null>,
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>,
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>,
  setSyncTone: React.Dispatch<React.SetStateAction<SyncTone>>,
  setSyncTitle: React.Dispatch<React.SetStateAction<string>>,
  setSyncDetail: React.Dispatch<React.SetStateAction<string>>
) {
  markSynced(
    roomCode,
    state,
    updatedAt,
    setLocalSettings,
    lastSyncedSerializedRef,
    lastRemoteUpdatedAtRef,
    setLastSyncedAt
  );
  setSharedState(state);
  markRoomReady(roomCode, roomInitStatusRef, setLocalSettings, setManualSyncReadyRoom);
  setSyncTone('live');
  setSyncTitle(`已连接房间 ${roomCode}`);
  setSyncDetail('当前数据已经手动同步到云端。');
}

async function performManualSync(
  requestedRoomCode: string,
  requestedRoomSecret: string,
  canManualSync: boolean,
  hasSyncConflict: boolean,
  localSettings: LocalSettings,
  sharedStateRef: React.MutableRefObject<SharedState>,
  localSettingsRef: React.MutableRefObject<LocalSettings>,
  roomInitStatusRef: React.MutableRefObject<Record<string, RoomInitStatus>>,
  conflictRoomRef: React.MutableRefObject<Record<string, boolean>>,
  lastSyncedSerializedRef: React.MutableRefObject<string | null>,
  lastRemoteUpdatedAtRef: React.MutableRefObject<string | null>,
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setSyncTone: React.Dispatch<React.SetStateAction<SyncTone>>,
  setSyncTitle: React.Dispatch<React.SetStateAction<string>>,
  setSyncDetail: React.Dispatch<React.SetStateAction<string>>,
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>,
  setManualSyncReadyRoom: React.Dispatch<React.SetStateAction<string>>,
  setHasSyncConflict: React.Dispatch<React.SetStateAction<boolean>>,
  expectedUpdatedAt: string | null
): Promise<ManualSyncResult> {
  const nextRoomCode = normalizeRequestedRoomCode(requestedRoomCode);
  const nextRoomSecret = normalizeRequestedRoomSecret(requestedRoomSecret);
  const blocked = isManualSyncBlocked(
    nextRoomCode,
    nextRoomSecret,
    localSettings.roomCode,
    localSettings.roomSecret,
    canManualSync,
    hasSyncConflict
  );

  if (blocked) {
    return blocked;
  }

  const roomAccess = await prepareRoomAccess(nextRoomCode, nextRoomSecret, localSettingsRef.current.recoveryToken);

  if (roomAccess.error) {
    setFriendlyError('手动同步失败', setSyncTone, setSyncTitle, setSyncDetail, roomAccess.error);
    return { status: 'error' };
  }

  try {
    const upload = await upsertSharedState(
      nextRoomCode,
      nextRoomSecret,
      sharedStateRef.current,
      localSettingsRef.current.clientId,
      expectedUpdatedAt
    );

    if (upload.error) {
      setFriendlyError('手动同步失败', setSyncTone, setSyncTitle, setSyncDetail, upload.error);
      return { status: 'error' };
    }

    if (upload.conflict || !upload.state) {
      lastRemoteUpdatedAtRef.current = upload.updatedAt;
      markConflict(
        nextRoomCode,
        '手动同步冲突',
        CONFLICT_MESSAGE,
        conflictRoomRef,
        setHasSyncConflict,
        setManualSyncReadyRoom,
        setSyncTone,
        setSyncTitle,
        setSyncDetail
      );
      return { status: 'conflict' };
    }

    clearConflict(
      nextRoomCode,
      roomInitStatusRef,
      conflictRoomRef,
      setLocalSettings,
      setManualSyncReadyRoom,
      setHasSyncConflict
    );

    handleManualSyncSuccess(
      nextRoomCode,
      upload.state,
      upload.updatedAt,
      roomInitStatusRef,
      setLocalSettings,
      setManualSyncReadyRoom,
      lastSyncedSerializedRef,
      lastRemoteUpdatedAtRef,
      setLastSyncedAt,
      setSharedState,
      setSyncTone,
      setSyncTitle,
      setSyncDetail
    );
  } catch {
    setFriendlyError('手动同步失败', setSyncTone, setSyncTitle, setSyncDetail, '手动同步过程中发生异常，请稍后重试。');
    return { status: 'error' };
  }

  return { status: 'success' };
}

function setFriendlyError(
  title: string,
  setSyncTone: React.Dispatch<React.SetStateAction<SyncTone>>,
  setSyncTitle: React.Dispatch<React.SetStateAction<string>>,
  setSyncDetail: React.Dispatch<React.SetStateAction<string>>,
  detail?: string
) {
  setSyncTone('error');
  setSyncTitle(title);
  setSyncDetail(detail ?? '同步失败，请检查网络、房间码、配对口令或云端配置。');
}

function getSafeTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getSafeSyncTime(value: string | null | undefined) {
  return getSafeTimestamp(value) === null ? null : value ?? null;
}

function clearSyncTimer(syncTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (!syncTimerRef.current) {
    return;
  }

  clearTimeout(syncTimerRef.current);
  syncTimerRef.current = null;
}

async function retryUpsertAfterRoomAccess(
  roomCode: string,
  roomSecret: string,
  recoveryToken: string,
  clientId: string,
  sharedState: SharedState,
  expectedUpdatedAt: string | null
) {
  const roomAccess = await prepareRoomAccess(roomCode, roomSecret, recoveryToken);

  if (roomAccess.error) {
    return {
      error: roomAccess.error,
      retryWithRoomAccess: false,
      conflict: false,
      updatedAt: null,
      state: null,
      updatedBy: null,
    };
  }

  return upsertSharedState(roomCode, roomSecret, sharedState, clientId, expectedUpdatedAt);
}

function hasPendingLocalChanges(
  sharedStateRef: React.MutableRefObject<SharedState>,
  lastSyncedSerializedRef: React.MutableRefObject<string | null>
) {
  return serializeSharedStateSnapshot(sharedStateRef.current) !== lastSyncedSerializedRef.current;
}

function markSynced(
  roomCode: string,
  state: SharedState,
  updatedAt: string | null,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  lastSyncedSerializedRef: React.MutableRefObject<string | null>,
  lastRemoteUpdatedAtRef: React.MutableRefObject<string | null>,
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>
) {
  const syncedAt = getSafeSyncTime(updatedAt ?? state.meta.lastEditedAt);
  const serializedState = serializeSharedStateSnapshot(state);

  lastSyncedSerializedRef.current = serializedState;
  lastRemoteUpdatedAtRef.current = updatedAt;
  setLastSyncedAt(syncedAt);
  setLocalSettings((current) => {
    if (
      current.lastSyncedRoomCode === roomCode &&
      current.lastSyncedAt === syncedAt &&
      current.lastSyncedSnapshot === serializedState
    ) {
      return current;
    }

    return {
      ...current,
      lastSyncedRoomCode: roomCode,
      lastSyncedAt: syncedAt,
      lastSyncedSnapshot: serializedState,
    };
  });
}

function markRoomReady(
  roomCode: string,
  roomInitStatusRef: React.MutableRefObject<Record<string, RoomInitStatus>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setManualSyncReadyRoom: React.Dispatch<React.SetStateAction<string>>
) {
  roomInitStatusRef.current[roomCode] = 'ready';
  setLocalSettings((current) =>
    current.lastSyncedRoomCode === roomCode ? current : { ...current, lastSyncedRoomCode: roomCode }
  );
  setManualSyncReadyRoom(roomCode);
}

function clearConflict(
  roomCode: string,
  roomInitStatusRef: React.MutableRefObject<Record<string, RoomInitStatus>>,
  conflictRoomRef: React.MutableRefObject<Record<string, boolean>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setManualSyncReadyRoom: React.Dispatch<React.SetStateAction<string>>,
  setHasSyncConflict: React.Dispatch<React.SetStateAction<boolean>>
) {
  conflictRoomRef.current[roomCode] = false;
  setHasSyncConflict(false);
  markRoomReady(roomCode, roomInitStatusRef, setLocalSettings, setManualSyncReadyRoom);
}

function markConflict(
  roomCode: string,
  title: string,
  detail: string,
  conflictRoomRef: React.MutableRefObject<Record<string, boolean>>,
  setHasSyncConflict: React.Dispatch<React.SetStateAction<boolean>>,
  setManualSyncReadyRoom: React.Dispatch<React.SetStateAction<string>>,
  setSyncTone: React.Dispatch<React.SetStateAction<SyncTone>>,
  setSyncTitle: React.Dispatch<React.SetStateAction<string>>,
  setSyncDetail: React.Dispatch<React.SetStateAction<string>>
) {
  conflictRoomRef.current[roomCode] = true;
  setHasSyncConflict(true);
  setManualSyncReadyRoom('');
  setSyncTone('error');
  setSyncTitle(title);
  setSyncDetail(detail);
}

async function resolveSyncConflict(
  resolution: ConflictResolution,
  roomCode: string,
  roomSecret: string,
  recoveryToken: string,
  clientId: string,
  sharedStateRef: React.MutableRefObject<SharedState>,
  roomInitStatusRef: React.MutableRefObject<Record<string, RoomInitStatus>>,
  conflictRoomRef: React.MutableRefObject<Record<string, boolean>>,
  pendingRemoteSerializedRef: React.MutableRefObject<string | null>,
  lastSyncedSerializedRef: React.MutableRefObject<string | null>,
  lastRemoteUpdatedAtRef: React.MutableRefObject<string | null>,
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setSyncTone: React.Dispatch<React.SetStateAction<SyncTone>>,
  setSyncTitle: React.Dispatch<React.SetStateAction<string>>,
  setSyncDetail: React.Dispatch<React.SetStateAction<string>>,
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>,
  setManualSyncReadyRoom: React.Dispatch<React.SetStateAction<string>>,
  setHasSyncConflict: React.Dispatch<React.SetStateAction<boolean>>
): Promise<ConflictResolutionResult> {
  if (!roomCode || !roomSecret) {
    return { status: 'missing_room' };
  }

  try {
    const roomAccess = await prepareRoomAccess(roomCode, roomSecret, recoveryToken);

    if (roomAccess.error) {
      setFriendlyError('冲突处理失败', setSyncTone, setSyncTitle, setSyncDetail, roomAccess.error);
      return { status: 'error' };
    }

    if (resolution === 'use_remote') {
      const remoteResult = await fetchSharedState(roomCode, roomSecret);

      if (remoteResult.error) {
        setFriendlyError('冲突处理失败', setSyncTone, setSyncTitle, setSyncDetail, remoteResult.error);
        return { status: 'error' };
      }

      if (!remoteResult.state) {
        setFriendlyError('冲突处理失败', setSyncTone, setSyncTitle, setSyncDetail, '云端当前没有可恢复的数据。');
        return { status: 'error' };
      }

      const remoteState = normalizeRemoteSharedState(remoteResult.state);
      if (!remoteState) {
        setFriendlyError('冲突处理失败', setSyncTone, setSyncTitle, setSyncDetail, '云端同步数据格式不正确。');
        return { status: 'error' };
      }

      pendingRemoteSerializedRef.current = null;
      applyRemoteState(
        roomCode,
        remoteState,
        remoteResult.updatedAt,
        pendingRemoteSerializedRef,
        lastSyncedSerializedRef,
        lastRemoteUpdatedAtRef,
        setLastSyncedAt,
        setLocalSettings,
        setSharedState
      );
      clearConflict(
        roomCode,
        roomInitStatusRef,
        conflictRoomRef,
        setLocalSettings,
        setManualSyncReadyRoom,
        setHasSyncConflict
      );
      setSyncTone('live');
      setSyncTitle(`已恢复房间 ${roomCode}`);
      setSyncDetail('已采用云端版本，并恢复自动同步。');
      return { status: 'success' };
    }

    const upload = await upsertSharedState(
      roomCode,
      roomSecret,
      sharedStateRef.current,
      clientId,
      lastRemoteUpdatedAtRef.current
    );

    if (upload.error) {
      setFriendlyError('冲突处理失败', setSyncTone, setSyncTitle, setSyncDetail, upload.error);
      return { status: 'error' };
    }

    if (upload.conflict || !upload.state) {
      lastRemoteUpdatedAtRef.current = upload.updatedAt;
      markConflict(
        roomCode,
        `房间 ${roomCode} 仍有同步冲突`,
        CONFLICT_MESSAGE,
        conflictRoomRef,
        setHasSyncConflict,
        setManualSyncReadyRoom,
        setSyncTone,
        setSyncTitle,
        setSyncDetail
      );
      return { status: 'conflict' };
    }

    clearConflict(
      roomCode,
      roomInitStatusRef,
      conflictRoomRef,
      setLocalSettings,
      setManualSyncReadyRoom,
      setHasSyncConflict
    );
    handleManualSyncSuccess(
      roomCode,
      upload.state,
      upload.updatedAt,
      roomInitStatusRef,
      setLocalSettings,
      setManualSyncReadyRoom,
      lastSyncedSerializedRef,
      lastRemoteUpdatedAtRef,
      setLastSyncedAt,
      setSharedState,
      setSyncTone,
      setSyncTitle,
      setSyncDetail
    );
    return { status: 'success' };
  } catch (error) {
    setFriendlyError('冲突处理失败', setSyncTone, setSyncTitle, setSyncDetail, '处理同步冲突时发生异常，请稍后重试。');
    return { status: 'error' };
  }
}

function applyRemoteState(
  roomCode: string,
  nextState: SharedState,
  updatedAt: string | null,
  pendingRemoteSerializedRef: React.MutableRefObject<string | null>,
  lastSyncedSerializedRef: React.MutableRefObject<string | null>,
  lastRemoteUpdatedAtRef: React.MutableRefObject<string | null>,
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>
) {
  const serializedRemote = serializeSharedStateSnapshot(nextState);
  const syncedAt = getSafeSyncTime(updatedAt ?? nextState.meta.lastEditedAt);

  pendingRemoteSerializedRef.current = serializedRemote;
  lastSyncedSerializedRef.current = serializedRemote;
  lastRemoteUpdatedAtRef.current = updatedAt;
  setLastSyncedAt(syncedAt);
  setLocalSettings((current) => {
    if (
      current.lastSyncedRoomCode === roomCode &&
      current.lastSyncedAt === syncedAt &&
      current.lastSyncedSnapshot === serializedRemote
    ) {
      return current;
    }

    return {
      ...current,
      lastSyncedRoomCode: roomCode,
      lastSyncedAt: syncedAt,
      lastSyncedSnapshot: serializedRemote,
    };
  });
  startTransition(() => setSharedState(nextState));
}

export function useCloudSync({
  sharedState,
  localSettings,
  sharedStateRef,
  localSettingsRef,
  isHydrated,
  setSharedState,
  setLocalSettings,
  setSyncTone,
  setSyncTitle,
  setSyncDetail,
  setLastSyncedAt,
  syncCleanupRef,
  syncTimerRef,
  pendingRemoteSerializedRef,
  lastSyncedSerializedRef,
}: Params) {
  const cloudConfigured = isSupabaseConfigured();
  const roomCode = localSettings.roomCode;
  const roomSecret = localSettings.roomSecret;
  const clientId = localSettings.clientId;
  const roomInitStatusRef = useRef<Record<string, RoomInitStatus>>({});
  const conflictRoomRef = useRef<Record<string, boolean>>({});
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualSyncReadyRoom, setManualSyncReadyRoom] = useState('');
  const [hasSyncConflict, setHasSyncConflict] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    if (!cloudConfigured) {
      clearReconnectTimer(reconnectTimerRef);
      setSyncTone('idle');
      setSyncTitle('仅本机模式');
      setSyncDetail('还没配置 Supabase 环境变量。现在装到两台手机后，数据不会自动互通。');
      setManualSyncReadyRoom('');
      setHasSyncConflict(false);
      lastRemoteUpdatedAtRef.current = null;
      setLastSyncedAt(null);
      return;
    }

    if (!roomCode || !roomSecret) {
      clearReconnectTimer(reconnectTimerRef);
      setSyncTone('idle');
      setSyncTitle('待连接房间');
      setSyncDetail('两台手机保存同一个房间码和配对口令后，才会共享菜单、留言、待办和点菜记录。');
      setManualSyncReadyRoom('');
      setHasSyncConflict(false);
      lastRemoteUpdatedAtRef.current = null;
      setLastSyncedAt(null);
      return;
    }

    let active = true;
    const activeRef = { current: true };
    roomInitStatusRef.current[roomCode] = 'pending';
    conflictRoomRef.current[roomCode] = false;
    setManualSyncReadyRoom('');
    setHasSyncConflict(false);
    clearSyncTimer(syncTimerRef);

    if (syncCleanupRef.current) {
      syncCleanupRef.current();
      syncCleanupRef.current = null;
    }

    setSyncTone('idle');
    setSyncTitle(`正在连接房间 ${roomCode}`);
    setSyncDetail('首次连接会自动匿名登录 Supabase，并拉取最新共享数据。');

    void (async () => {
      try {
        if (localSettingsRef.current.lastSyncedRoomCode === roomCode) {
          lastSyncedSerializedRef.current = localSettingsRef.current.lastSyncedSnapshot;
          setLastSyncedAt(localSettingsRef.current.lastSyncedAt);
        } else {
          lastSyncedSerializedRef.current = null;
          setLastSyncedAt(null);
        }

        const roomAccess = await prepareRoomAccess(roomCode, roomSecret, localSettingsRef.current.recoveryToken);

        if (!active) {
          return;
        }

        if (roomAccess.error) {
          setFriendlyError('同步连接失败', setSyncTone, setSyncTitle, setSyncDetail, roomAccess.error);
          scheduleReconnect(reconnectTimerRef, activeRef, () => {
            setConnectionAttempt((current) => current + 1);
          });
          return;
        }

        const remoteResult = await fetchSharedState(roomCode, roomSecret);

        if (!active) {
          return;
        }

        if (remoteResult.error) {
          setFriendlyError('同步连接失败', setSyncTone, setSyncTitle, setSyncDetail, remoteResult.error);
          scheduleReconnect(reconnectTimerRef, activeRef, () => {
            setConnectionAttempt((current) => current + 1);
          });
          return;
        }

        const remoteState = remoteResult.state ? normalizeRemoteSharedState(remoteResult.state) : null;

        if (remoteResult.state && !remoteState) {
          setFriendlyError('同步数据异常', setSyncTone, setSyncTitle, setSyncDetail);
          return;
        }

        const localState = sharedStateRef.current;
        const isKnownRoom = localSettingsRef.current.lastSyncedRoomCode === roomCode;

        if (remoteState) {
          if (!isKnownRoom || !hasPendingLocalChanges(sharedStateRef, lastSyncedSerializedRef)) {
            if (canApplyRemoteImmediately(sharedStateRef.current, remoteState)) {
              pendingRemoteSerializedRef.current = null;
              conflictRoomRef.current[roomCode] = false;
              setHasSyncConflict(false);
              markSynced(
                roomCode,
                remoteState,
                remoteResult.updatedAt,
                setLocalSettings,
                lastSyncedSerializedRef,
                lastRemoteUpdatedAtRef,
                setLastSyncedAt
              );
              markRoomReady(roomCode, roomInitStatusRef, setLocalSettings, setManualSyncReadyRoom);
            } else {
              roomInitStatusRef.current[roomCode] = 'applying_remote';
              applyRemoteState(
                roomCode,
                remoteState,
                remoteResult.updatedAt,
                pendingRemoteSerializedRef,
                lastSyncedSerializedRef,
                lastRemoteUpdatedAtRef,
                setLastSyncedAt,
                setLocalSettings,
                setSharedState
              );
            }
          } else {
            lastRemoteUpdatedAtRef.current = remoteResult.updatedAt;
            markConflict(
              roomCode,
              `房间 ${roomCode} 出现同步冲突`,
              '进入房间时发现本地与云端都有未合并修改，已暂停上传，避免覆盖任一端数据。',
              conflictRoomRef,
              setHasSyncConflict,
              setManualSyncReadyRoom,
              setSyncTone,
              setSyncTitle,
              setSyncDetail
            );
          }
        } else {
          const uploadState = localState;
          const upload = await upsertSharedState(
            roomCode,
            roomSecret,
            uploadState,
            clientId,
            lastRemoteUpdatedAtRef.current
          );

          if (!active) {
            return;
          }

          if (upload.error) {
            setFriendlyError('同步初始化失败', setSyncTone, setSyncTitle, setSyncDetail, upload.error);
            scheduleReconnect(reconnectTimerRef, activeRef, () => {
              setConnectionAttempt((current) => current + 1);
            });
            return;
          }

          if (upload.conflict || !upload.state) {
            lastRemoteUpdatedAtRef.current = upload.updatedAt;
            markConflict(
              roomCode,
              `房间 ${roomCode} 出现同步冲突`,
              '云端已被另一台设备更新，当前已暂停上传，请先确认保留哪一端的数据。',
              conflictRoomRef,
              setHasSyncConflict,
              setManualSyncReadyRoom,
              setSyncTone,
              setSyncTitle,
              setSyncDetail
            );
            return;
          }

          markSynced(
            roomCode,
            upload.state,
            upload.updatedAt,
            setLocalSettings,
            lastSyncedSerializedRef,
            lastRemoteUpdatedAtRef,
            setLastSyncedAt
          );
          markRoomReady(roomCode, roomInitStatusRef, setLocalSettings, setManualSyncReadyRoom);
        }

        const cleanup = await subscribeSharedState(
          roomCode,
          roomSecret,
          (snapshot) => {
            if (!active || !snapshot.state) {
              return;
            }

            clearReconnectTimer(reconnectTimerRef);

            if (
              isKnownSyncedSnapshot(
                snapshot.state,
                snapshot.updatedAt,
                lastSyncedSerializedRef.current,
                lastRemoteUpdatedAtRef.current
              )
            ) {
              markSynced(
                roomCode,
                snapshot.state,
                snapshot.updatedAt,
                setLocalSettings,
                lastSyncedSerializedRef,
                lastRemoteUpdatedAtRef,
                setLastSyncedAt
              );
              return;
            }

            if (
              roomInitStatusRef.current[roomCode] !== 'applying_remote' &&
              hasPendingLocalChanges(sharedStateRef, lastSyncedSerializedRef)
            ) {
              lastRemoteUpdatedAtRef.current = snapshot.updatedAt;
              markConflict(
                roomCode,
                `房间 ${roomCode} 出现同步冲突`,
                '你这边和另一台设备同时改了数据。为避免互相覆盖，当前房间已暂停自动与手动上传。',
                conflictRoomRef,
                setHasSyncConflict,
                setManualSyncReadyRoom,
                setSyncTone,
                setSyncTitle,
                setSyncDetail
              );
              return;
            }

            applyRemoteState(
              roomCode,
              snapshot.state,
              snapshot.updatedAt,
              pendingRemoteSerializedRef,
              lastSyncedSerializedRef,
              lastRemoteUpdatedAtRef,
              setLastSyncedAt,
              setLocalSettings,
              setSharedState
            );
            setSyncTone('live');
            setSyncTitle(`已连接房间 ${roomCode}`);
            setSyncDetail('另一台手机的改动已经同步过来。');
          },
          (message) => {
            if (!active) {
              return;
            }

            setFriendlyError('实时同步异常', setSyncTone, setSyncTitle, setSyncDetail, message);
            setManualSyncReadyRoom('');

            if (syncCleanupRef.current) {
              syncCleanupRef.current();
              syncCleanupRef.current = null;
            }

            scheduleReconnect(reconnectTimerRef, activeRef, () => {
              setConnectionAttempt((current) => current + 1);
            });
          }
        );

        if (!active) {
          cleanup();
          return;
        }

        syncCleanupRef.current = cleanup;
        if (roomInitStatusRef.current[roomCode] !== 'applying_remote') {
          roomInitStatusRef.current[roomCode] = 'ready';
        }
        if (!conflictRoomRef.current[roomCode]) {
          setSyncTone('live');
          setSyncTitle(`已连接房间 ${roomCode}`);
          setSyncDetail('两台手机使用同一个房间码后，会自动共享最新内容。');
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setFriendlyError('同步连接失败', setSyncTone, setSyncTitle, setSyncDetail, '同步过程中发生异常，请检查网络后重试。');
        scheduleReconnect(reconnectTimerRef, activeRef, () => {
          setConnectionAttempt((current) => current + 1);
        });
      }
    })();

    return () => {
      active = false;
      activeRef.current = false;
      roomInitStatusRef.current[roomCode] = 'pending';
      clearSyncTimer(syncTimerRef);
      clearReconnectTimer(reconnectTimerRef);

      if (syncCleanupRef.current) {
        syncCleanupRef.current();
        syncCleanupRef.current = null;
      }
    };
  }, [
    clientId,
    cloudConfigured,
    connectionAttempt,
    roomCode,
    roomSecret,
    setLastSyncedAt,
    setLocalSettings,
    setSharedState,
    setSyncDetail,
    setSyncTitle,
    setSyncTone,
    sharedStateRef,
    localSettingsRef,
    pendingRemoteSerializedRef,
    lastSyncedSerializedRef,
    syncCleanupRef,
    syncTimerRef,
  ]);

  useEffect(() => {
    if (!isHydrated || !cloudConfigured || !roomCode || !roomSecret) {
      return;
    }

    const currentSerializedSharedState = serializeSharedStateSnapshot(sharedState);

    if (
      roomInitStatusRef.current[roomCode] === 'applying_remote' &&
      currentSerializedSharedState === pendingRemoteSerializedRef.current
    ) {
      pendingRemoteSerializedRef.current = null;
      markRoomReady(roomCode, roomInitStatusRef, setLocalSettings, setManualSyncReadyRoom);
      setSyncTone('live');
      setSyncTitle(`已连接房间 ${roomCode}`);
      setSyncDetail('两台手机使用同一个房间码后，会自动共享最新内容。');
      return;
    }

    if (roomInitStatusRef.current[roomCode] !== 'ready' || conflictRoomRef.current[roomCode]) {
      return;
    }

    if (currentSerializedSharedState === lastSyncedSerializedRef.current) {
      return;
    }

    clearSyncTimer(syncTimerRef);

    syncTimerRef.current = setTimeout(() => {
      const uploadState = sharedStateRef.current;
      const latestRoomCode = localSettingsRef.current.roomCode;
      const latestRoomSecret = localSettingsRef.current.roomSecret;
      const latestRecoveryToken = localSettingsRef.current.recoveryToken;
      const latestClientId = localSettingsRef.current.clientId;

      void (async () => {
        try {
          if (conflictRoomRef.current[latestRoomCode]) {
            return;
          }

          const roomAccess = await prepareRoomAccess(latestRoomCode, latestRoomSecret, latestRecoveryToken);

          if (roomAccess.error) {
            setFriendlyError('同步保存失败', setSyncTone, setSyncTitle, setSyncDetail, roomAccess.error);
            return;
          }

          const upload = await upsertSharedState(
            latestRoomCode,
            latestRoomSecret,
            uploadState,
            latestClientId,
            lastRemoteUpdatedAtRef.current
          );

          const uploadResult =
            upload.error && upload.retryWithRoomAccess
              ? await retryUpsertAfterRoomAccess(
                  latestRoomCode,
                  latestRoomSecret,
                  latestRecoveryToken,
                  latestClientId,
                  uploadState,
                  lastRemoteUpdatedAtRef.current
                )
              : upload;

          if (uploadResult.error) {
            setFriendlyError('同步保存失败', setSyncTone, setSyncTitle, setSyncDetail, uploadResult.error);
            return;
          }

          if (uploadResult.conflict || !uploadResult.state) {
            lastRemoteUpdatedAtRef.current = uploadResult.updatedAt;
            markConflict(
              latestRoomCode,
              `房间 ${latestRoomCode} 出现同步冲突`,
              '云端已被另一台设备更新，当前已暂停上传，请先确认保留哪一端的数据。',
              conflictRoomRef,
              setHasSyncConflict,
              setManualSyncReadyRoom,
              setSyncTone,
              setSyncTitle,
              setSyncDetail
            );
            return;
          }

          markSynced(
            latestRoomCode,
            uploadResult.state,
            uploadResult.updatedAt,
            setLocalSettings,
            lastSyncedSerializedRef,
            lastRemoteUpdatedAtRef,
            setLastSyncedAt
          );
          setSyncTone('live');
          setSyncTitle(`已连接房间 ${latestRoomCode}`);
          setSyncDetail('最新改动已经同步到云端。');
        } catch (error) {
          setFriendlyError('同步保存失败', setSyncTone, setSyncTitle, setSyncDetail, '同步保存过程中发生异常，请稍后重试。');
        } finally {
          clearSyncTimer(syncTimerRef);
        }
      })();
    }, 800);

    return () => {
      clearSyncTimer(syncTimerRef);
    };
  }, [
    cloudConfigured,
    isHydrated,
    roomCode,
    roomSecret,
    sharedState,
    setLastSyncedAt,
    setLocalSettings,
    setSyncDetail,
    setSyncTitle,
    setSyncTone,
    sharedStateRef,
    localSettingsRef,
    pendingRemoteSerializedRef,
    lastSyncedSerializedRef,
    syncTimerRef,
  ]);

  const canManualSync = manualSyncReadyRoom === roomCode && !hasSyncConflict;

  const syncNow = async (requestedRoomCode: string, requestedRoomSecret: string) =>
    performManualSync(
      requestedRoomCode,
      requestedRoomSecret,
      canManualSync,
      hasSyncConflict,
      localSettings,
      sharedStateRef,
      localSettingsRef,
      roomInitStatusRef,
      conflictRoomRef,
      lastSyncedSerializedRef,
      lastRemoteUpdatedAtRef,
      setSharedState,
      setLocalSettings,
      setSyncTone,
      setSyncTitle,
      setSyncDetail,
      setLastSyncedAt,
      setManualSyncReadyRoom,
      setHasSyncConflict,
      lastRemoteUpdatedAtRef.current
    );

  const resolveConflict = async (resolution: ConflictResolution) =>
    resolveSyncConflict(
      resolution,
      roomCode,
      roomSecret,
      localSettings.recoveryToken,
      clientId,
      sharedStateRef,
      roomInitStatusRef,
      conflictRoomRef,
      pendingRemoteSerializedRef,
      lastSyncedSerializedRef,
      lastRemoteUpdatedAtRef,
      setSharedState,
      setLocalSettings,
      setSyncTone,
      setSyncTitle,
      setSyncDetail,
      setLastSyncedAt,
      setManualSyncReadyRoom,
      setHasSyncConflict
    );

  return {
    cloudConfigured,
    canManualSync,
    hasSyncConflict,
    syncNow,
    resolveConflict,
  };
}
