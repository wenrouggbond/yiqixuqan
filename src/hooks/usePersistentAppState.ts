import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import {
  LEGACY_STORAGE_KEYS,
  LocalSettings,
  normalizePersistedState,
  PersistedState,
  SharedState,
  STORAGE_KEY,
} from '../models';

type Params = {
  sharedState: SharedState;
  localSettings: LocalSettings;
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>;
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>;
  setRoomCodeInput: React.Dispatch<React.SetStateAction<string>>;
  setRoomSecretInput: React.Dispatch<React.SetStateAction<string>>;
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>;
  isReadyToPersist: boolean;
  setIsHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReadyToPersist: React.Dispatch<React.SetStateAction<boolean>>;
  reportPersistenceError: (title: string, detail: string) => void;
};

function getPersistenceErrorDetail(action: 'read' | 'write') {
  return action === 'read'
    ? '本地数据恢复失败，已暂停本地自动保存，避免覆盖原有数据。请先清理本地存储后再继续使用。'
    : '本地数据暂未成功保存。请先不要卸载或重启应用，稍后再试。';
}

async function loadStoredState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    const savedState = await AsyncStorage.getItem(key);
    if (savedState) {
      return savedState;
    }
  }

  return null;
}

function restorePersistedState(
  parsedState: PersistedState,
  setSharedState: React.Dispatch<React.SetStateAction<SharedState>>,
  setLocalSettings: React.Dispatch<React.SetStateAction<LocalSettings>>,
  setRoomCodeInput: React.Dispatch<React.SetStateAction<string>>,
  setRoomSecretInput: React.Dispatch<React.SetStateAction<string>>,
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>
) {
  setSharedState(parsedState.shared);
  setLocalSettings(parsedState.local);
  setRoomCodeInput(parsedState.local.roomCode);
  setRoomSecretInput(parsedState.local.roomSecret);
  setLastSyncedAt(
    parsedState.local.lastSyncedRoomCode === parsedState.local.roomCode ? parsedState.local.lastSyncedAt : null
  );
}

export function usePersistentAppState({
  sharedState,
  localSettings,
  setSharedState,
  setLocalSettings,
  setRoomCodeInput,
  setRoomSecretInput,
  setLastSyncedAt,
  isReadyToPersist,
  setIsHydrated,
  setIsReadyToPersist,
  reportPersistenceError,
}: Params) {
  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const savedState = await loadStoredState();
        let canPersist = true;

        if (savedState) {
          const parsedState = normalizePersistedState(JSON.parse(savedState));
          if (!parsedState) {
            canPersist = false;
            if (mounted) {
              reportPersistenceError('本地数据恢复失败', getPersistenceErrorDetail('read'));
            }
          } else if (mounted) {
            restorePersistedState(
              parsedState,
              setSharedState,
              setLocalSettings,
              setRoomCodeInput,
              setRoomSecretInput,
              setLastSyncedAt
            );
          }
        }

        if (mounted) {
          setIsReadyToPersist(canPersist);
          setIsHydrated(true);
        }
      } catch {
        if (mounted) {
          setIsReadyToPersist(false);
          setIsHydrated(true);
          reportPersistenceError('本地数据恢复失败', getPersistenceErrorDetail('read'));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    reportPersistenceError,
    setIsHydrated,
    setIsReadyToPersist,
    setLastSyncedAt,
    setLocalSettings,
    setRoomCodeInput,
    setRoomSecretInput,
    setSharedState,
  ]);

  useEffect(() => {
    if (!isReadyToPersist) {
      return;
    }

    const persistedState: PersistedState = {
      shared: sharedState,
      local: localSettings,
    };

    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState)).catch(() => {
      reportPersistenceError('本地保存失败', getPersistenceErrorDetail('write'));
    });
  }, [isReadyToPersist, localSettings, reportPersistenceError, sharedState]);
}
