import { beforeEach, describe, expect, test, vi } from 'vitest';

type RpcResponse = { data?: unknown; error?: { message?: string } | null };
type SelectResponse = { data?: unknown; error?: { message?: string } | null };

type MockChannel = {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

type MockClient = {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    signInAnonymously: ReturnType<typeof vi.fn>;
  };
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
};

const createClientMock = vi.fn();
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: mockStorage,
}));

vi.mock('react-native-url-polyfill/auto', () => ({}));

vi.mock('react-native-calendars', () => ({
  LocaleConfig: {
    locales: {},
    defaultLocale: 'zh',
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

function createMockClient(options?: {
  session?: object | null;
  rpcResponses?: RpcResponse[];
  selectResponse?: SelectResponse;
}) {
  const rpcResponses = [...(options?.rpcResponses ?? [])];
  const maybeSingle = vi.fn(async () => ({
    data: options?.selectResponse?.data ?? null,
    error: options?.selectResponse?.error ?? null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const on = vi.fn(function () {
    return channel;
  });
  const subscribe = vi.fn(function (_callback?: (status: string) => void) {
    return channel;
  });
  const channel: MockChannel = { on, subscribe };

  const client: MockClient = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: options?.session ?? { user: { id: 'user-1' } } }, error: null })),
      signInAnonymously: vi.fn(async () => ({ error: null })),
    },
    rpc: vi.fn(async () => rpcResponses.shift() ?? { data: null, error: null }),
    from: vi.fn(() => ({ select })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => undefined),
  };

  return { client, maybeSingle, select, eq, channel };
}

async function loadSyncModule() {
  vi.resetModules();
  return import('./sync');
}

describe('sync access side effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'x'.repeat(100) + '.y.z';
  });

  test('prepareRoomAccess joins or creates the room explicitly with recovery token', async () => {
    const { client } = createMockClient();
    createClientMock.mockReturnValue(client);
    const sync = await loadSyncModule();

    await sync.prepareRoomAccess('ROOM1234', 'SECRET1234', 'abcd1234abcd1234abcd1234abcd1234');

    expect(client.rpc).toHaveBeenCalledWith('join_or_create_couple_room', {
      p_room_code: 'ROOM1234',
      p_join_secret: 'SECRET1234',
      p_recovery_token: 'abcd1234abcd1234abcd1234abcd1234',
    });
  });

  test('fetchSharedState reads without join side effects', async () => {
    const { client } = createMockClient({
      selectResponse: {
        data: {
          room_code: 'ROOM1234',
          payload: { lastWheelPickId: null, menu: [], days: {} },
          updated_by: 'client-1',
          updated_at: '2026-04-18T10:00:00.000Z',
        },
      },
    });
    createClientMock.mockReturnValue(client);
    const sync = await loadSyncModule();

    await sync.fetchSharedState('ROOM1234', 'SECRET1234');

    expect(client.rpc).not.toHaveBeenCalledWith(
      'join_or_create_couple_room',
      expect.anything()
    );
    expect(client.from).toHaveBeenCalledWith('couple_shared_states');
  });

  test('upsertSharedState saves without join side effects', async () => {
    const { client } = createMockClient({
      rpcResponses: [
        {
          data: [
            {
              room_code: 'ROOM1234',
              payload: {
                lastWheelPickId: null,
                menu: [],
                days: {},
                meta: { lastEditedAt: '2026-04-18T10:00:00.000Z', lastEditedBy: null },
              },
              updated_by: 'client-1',
              updated_at: '2026-04-18T10:00:00.000Z',
              result: 'updated',
            },
          ],
        },
      ],
    });
    createClientMock.mockReturnValue(client);
    const sync = await loadSyncModule();

    await sync.upsertSharedState(
      'ROOM1234',
      'SECRET1234',
      {
        lastWheelPickId: null,
        menu: [],
        days: {},
        meta: { lastEditedAt: '2026-04-18T10:00:00.000Z', lastEditedBy: null },
      },
      'client-1',
      null
    );

    expect(client.rpc).toHaveBeenCalledWith('save_couple_shared_state', {
      p_room_code: 'ROOM1234',
      p_payload: {
        lastWheelPickId: null,
        menu: [],
        days: {},
        meta: { lastEditedAt: '2026-04-18T10:00:00.000Z', lastEditedBy: null },
      },
      p_updated_by: 'client-1',
      p_expected_updated_at: null,
    });
    expect(client.rpc).not.toHaveBeenCalledWith(
      'join_or_create_couple_room',
      expect.anything()
    );
  });

  test('subscribeSharedState subscribes without join side effects', async () => {
    const { client } = createMockClient();
    createClientMock.mockReturnValue(client);
    const sync = await loadSyncModule();

    await sync.subscribeSharedState('ROOM1234', 'SECRET1234', vi.fn(), vi.fn());

    expect(client.channel).toHaveBeenCalledWith('couple-room-ROOM1234');
    expect(client.rpc).not.toHaveBeenCalledWith(
      'join_or_create_couple_room',
      expect.anything()
    );
  });
});
