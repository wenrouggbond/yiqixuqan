import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { normalizePersistedState, normalizeRemoteSharedState, PersistedState, SharedState } from './models';

type SharedStateRow = {
  room_code: string;
  payload: PersistedState['shared'];
  updated_by: string | null;
  updated_at: string;
};

type SaveSharedStateRow = SharedStateRow & {
  result: 'inserted' | 'updated' | 'conflict';
};

type SharedStateSnapshot = {
  state: SharedState | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

function needsRoomAccessRetry(message: string | null | undefined) {
  return message === 'ROOM_ACCESS_DENIED' || message === 'AUTH_REQUIRED';
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  return process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
}

function getSupabaseAnonKey() {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

export async function ensureSupabaseSession() {
  const client = getSupabaseClient();

  if (!client) {
    return { client: null, error: '未配置 Supabase 环境变量。' };
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError) {
    return { client: null, error: sessionError.message };
  }

  if (session) {
    return { client, error: null };
  }

  const { error } = await client.auth.signInAnonymously();
  return {
    client: error ? null : client,
    error: error?.message ?? null,
  };
}

function mapRoomAccessError(message: string | null | undefined) {
  if (message === 'ROOM_ACCESS_DENIED') {
    return '配对信息不正确，或房间已满。';
  }

  if (message === 'ROOM_CODE_INVALID' || message === 'ROOM_SECRET_INVALID') {
    return '房间码或配对口令格式不正确。';
  }

  if (message === 'AUTH_REQUIRED') {
    return '登录状态已失效，请稍后重试。';
  }

  if (message === 'RECOVERY_TOKEN_INVALID') {
    return '当前设备恢复凭据无效，请重新进入房间。';
  }

  return message ? '云同步暂时不可用，请稍后再试。' : null;
}

function mapSyncError(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (message === 'PAYLOAD_INVALID') {
    return '云端同步数据格式不正确。';
  }

  if (message === 'PAYLOAD_TOO_LARGE') {
    return '共享内容过多，请先删减后再同步。';
  }

  if (message === 'RATE_LIMITED') {
    return '操作太频繁了，请稍后再试。';
  }

  return mapRoomAccessError(message) ?? '云同步暂时不可用，请稍后再试。';
}

function normalizeRecoveryToken(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return /^[a-z0-9]{32}$/.test(normalized) ? normalized : null;
}

async function ensureRoomAccess(client: SupabaseClient, roomCode: string, roomSecret: string, recoveryToken: string | null) {
  const { error } = await client.rpc('join_or_create_couple_room', {
    p_room_code: roomCode,
    p_join_secret: roomSecret,
    p_recovery_token: normalizeRecoveryToken(recoveryToken),
  });

  return { error: mapRoomAccessError(error?.message) };
}

function normalizeClientId(value: string | null | undefined) {
  const normalized = value?.trim().slice(0, 64) ?? '';
  return normalized || null;
}

function normalizeSnapshot(row: Partial<SharedStateRow> | null | undefined): SharedStateSnapshot | null {
  const state = row?.payload ? normalizeRemoteSharedState(row.payload) : null;

  if (row?.payload && !state) {
    return null;
  }

  return {
    state,
    updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : null,
    updatedBy: normalizeClientId(typeof row?.updated_by === 'string' ? row.updated_by : null),
  };
}

export async function prepareRoomAccess(roomCode: string, roomSecret: string, recoveryToken?: string | null) {
  const session = await ensureSupabaseSession();

  if (!session.client) {
    return { error: mapSyncError(session.error) ?? '连接 Supabase 失败。' };
  }

  return ensureRoomAccess(session.client, roomCode, roomSecret, recoveryToken ?? null);
}

export async function fetchSharedState(roomCode: string, roomSecret: string) {
  const session = await ensureSupabaseSession();

  if (!session.client) {
    return { state: null, updatedAt: null, updatedBy: null, error: mapSyncError(session.error) ?? '连接 Supabase 失败。' };
  }

  const { data, error } = await session.client
    .from('couple_shared_states')
    .select('room_code,payload,updated_by,updated_at')
    .eq('room_code', roomCode)
    .maybeSingle<SharedStateRow>();

  if (error) {
    return { state: null, updatedAt: null, updatedBy: null, error: mapSyncError(error.message) ?? '连接 Supabase 失败。' };
  }

  const snapshot = normalizeSnapshot(data);

  if (!snapshot) {
    return { state: null, updatedAt: null, updatedBy: null, error: '远端同步数据格式不正确。' };
  }

  return {
    state: snapshot.state,
    updatedAt: snapshot.updatedAt,
    updatedBy: snapshot.updatedBy,
    error: null,
  };
}

export async function upsertSharedState(
  roomCode: string,
  roomSecret: string,
  sharedState: SharedState,
  clientId: string,
  expectedUpdatedAt: string | null
) {
  const session = await ensureSupabaseSession();

  if (!session.client) {
    return {
      error: mapSyncError(session.error) ?? '连接 Supabase 失败。',
      retryWithRoomAccess: needsRoomAccessRetry(session.error),
      conflict: false,
      updatedAt: null,
      state: null,
      updatedBy: null,
    };
  }

  const { data, error } = await session.client.rpc('save_couple_shared_state', {
    p_room_code: roomCode,
    p_payload: sharedState,
    p_updated_by: normalizeClientId(clientId),
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) {
    return {
      error: mapSyncError(error.message) ?? '连接 Supabase 失败。',
      retryWithRoomAccess: needsRoomAccessRetry(error.message),
      conflict: false,
      updatedAt: null,
      state: null,
      updatedBy: null,
    };
  }

  const row = Array.isArray(data) ? (data[0] as Partial<SaveSharedStateRow> | undefined) : undefined;
  const snapshot = normalizeSnapshot(row as Partial<SharedStateRow> | undefined);

  if (!row || !snapshot) {
    return {
      error: '云端同步返回了无法识别的数据。',
      retryWithRoomAccess: false,
      conflict: false,
      updatedAt: null,
      state: null,
      updatedBy: null,
    };
  }

  return {
    error: null,
    retryWithRoomAccess: false,
    conflict: row.result === 'conflict',
    updatedAt: snapshot.updatedAt,
    updatedBy: snapshot.updatedBy,
    state: snapshot.state,
  };
}

export async function subscribeSharedState(
  roomCode: string,
  roomSecret: string,
  onState: (snapshot: SharedStateSnapshot) => void,
  onError: (message: string) => void
) {
  const session = await ensureSupabaseSession();

  if (!session.client) {
    onError(mapSyncError(session.error) ?? '连接 Supabase 失败。');
    return () => undefined;
  }

  const channel = session.client
    .channel(`couple-room-${roomCode}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'couple_shared_states',
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => {
        const row = payload.new as Partial<SharedStateRow> | undefined;
        const snapshot = normalizeSnapshot(row);

        if (!snapshot) {
          onError('远端同步数据格式不正确。');
          return;
        }

        onState(snapshot);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        onError('实时同步通道连接失败。');
      }
    });

  return () => {
    void removeChannel(channel);
  };
}

async function removeChannel(channel: RealtimeChannel) {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  await client.removeChannel(channel);
}
