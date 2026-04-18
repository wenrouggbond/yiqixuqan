import { describe, expect, test, vi } from 'vitest';

vi.mock('react-native-calendars', () => ({
  LocaleConfig: {
    locales: {},
    defaultLocale: 'zh',
  },
}));

import {
  addMenuItemToSharedState,
  addTodoToDay,
  createEmptyDay,
  createId,
  createInitialLocalSettings,
  createInitialPersistedState,
  createInitialSharedState,
  createRoomCode,
  createRoomSecret,
  describeSlicePath,
  getDisplayDate,
  getDateKey,
  pad,
  getLatestWheelPick,
  getLocalTimeLabel,
  getMarkedDates,
  getOrderCounts,
  getShortTime,
  getTimeLabel,
  normalizeDegree,
  isKnownSyncedSnapshot,
  normalizePersistedState,
  serializeSharedStateSnapshot,
  normalizeRemoteSharedState,
  normalizeRoomCode,
  normalizeRoomSecret,
  polarToCartesian,
  toggleTodoInDay,
  updateSharedDay,
} from './models';
import { getVisibleWheelPick } from './wheel';

describe('models', () => {
  test('normalizes room code and secret', () => {
    expect(normalizeRoomCode(' ab-cd_12xyz!@# ')).toBe('ABCD12XYZ');
    expect(normalizeRoomSecret(' q8mn-4r2k7x5c999 ')).toBe('Q8MN4R2K7X5C999');
  });

  test('restores persisted state with sync metadata', () => {
    const persisted = createInitialPersistedState();
    const snapshot = serializeSharedStateSnapshot(persisted.shared);

    const restored = normalizePersistedState({
      shared: persisted.shared,
      local: {
        ...persisted.local,
        currentUser: '她',
        roomCode: 'ab12cd34',
        roomSecret: 'xy98zt76',
        lastSyncedRoomCode: 'ab12cd34',
        lastSyncedAt: '2026-04-17T05:00:00.000Z',
        lastSyncedSnapshot: snapshot,
      },
    });

    expect(restored).not.toBeNull();
    expect(restored?.local.currentUser).toBe('她');
    expect(restored?.local.roomCode).toBe('AB12CD34');
    expect(restored?.local.roomSecret).toBe('XY98ZT76');
    expect(restored?.local.lastSyncedRoomCode).toBe('AB12CD34');
    expect(restored?.local.lastSyncedAt).toBe('2026-04-17T05:00:00.000Z');
    expect(restored?.local.lastSyncedSnapshot).toBe(snapshot);
  });

  test('falls back safely when persisted sync metadata is missing or invalid', () => {
    const persisted = createInitialPersistedState();

    const restored = normalizePersistedState({
      shared: persisted.shared,
      local: {
        ...persisted.local,
        roomCode: 'ab12cd34',
        roomSecret: 'xy98zt76',
        lastSyncedRoomCode: 'ab12cd34',
        lastSyncedAt: 'not-a-date',
      },
    });

    expect(restored).not.toBeNull();
    expect(restored?.local.lastSyncedAt).toBeNull();
    expect(restored?.local.lastSyncedSnapshot).toBeNull();
  });

  test('restores legacy persisted state', () => {
    const restored = normalizePersistedState({
      currentUser: '她',
      lastWheelPickId: 'gongbao-chicken',
      menu: [
        {
          id: 'gongbao-chicken',
          name: '宫保鸡丁',
          category: '下饭',
          description: 'desc',
          tags: ['经典'],
          heat: '热菜',
        },
      ],
      days: {
        '2026-04-17': {
          todos: [],
          messages: [],
          orders: [],
        },
      },
    });

    expect(restored).not.toBeNull();
    expect(restored?.local.currentUser).toBe('她');
    expect(restored?.local.lastSyncedAt).toBeNull();
    expect(restored?.local.lastSyncedSnapshot).toBeNull();
  });

  test('updates shared day immutably', () => {
    const state = createInitialPersistedState().shared;
    const nextState = updateSharedDay(state, '2026-04-20', (day) => addTodoToDay(day, '买酸奶', '共同'));

    expect(nextState).not.toBe(state);
    expect(nextState.days['2026-04-20']).toBeDefined();
    expect(nextState.days['2026-04-20'].todos[0].text).toBe('买酸奶');
    expect(state.days['2026-04-20']).toBeUndefined();
  });

  test('adds custom menu item with full fields', () => {
    const state = createInitialPersistedState().shared;
    const nextState = addMenuItemToSharedState(state, {
      name: '酸汤肥牛',
      category: '下饭',
      description: '酸辣开胃，很适合晚饭。',
      tags: ['酸香', '开胃'],
      heat: '热菜',
    });
    const addedItem = nextState.menu.at(-1);

    expect(addedItem).toMatchObject({
      name: '酸汤肥牛',
      category: '下饭',
      description: '酸辣开胃，很适合晚饭。',
      tags: ['酸香', '开胃'],
      heat: '热菜',
    });
  });

  test('adds custom menu item with fallback defaults', () => {
    const state = createInitialPersistedState().shared;
    const nextState = addMenuItemToSharedState(state, {
      name: '煎蛋面',
    });
    const addedItem = nextState.menu.at(-1);

    expect(addedItem).toMatchObject({
      name: '煎蛋面',
      category: '自定义',
      description: '你们后来新加进来的备选项。',
      tags: ['新菜'],
      heat: '待定',
    });
  });

  test('toggles todo without mutating original day', () => {
    const day = addTodoToDay(createEmptyDay(), '洗菜', '我');
    const [todo] = day.todos;

    const toggledDay = toggleTodoInDay(day, todo.id);

    expect(toggledDay).not.toBe(day);
    expect(toggledDay.todos[0].done).toBe(true);
    expect(day.todos[0].done).toBe(false);
  });

  test('returns null when persisted shared state is malformed', () => {
    expect(
      normalizePersistedState({
        shared: {
          lastWheelPickId: null,
          menu: [{ id: 1 }],
          days: {},
        },
        local: {},
      })
    ).toBeNull();
  });

  test('builds marked dates and order counts correctly', () => {
    const day = createEmptyDay();
    const todoDay = addTodoToDay(day, '做饭', '共同');
    const state = updateSharedDay(createInitialPersistedState().shared, '2026-04-21', () => todoDay);

    const markedDates = getMarkedDates(state.days, '2026-04-21');
    const counts = getOrderCounts([
      { id: '1', menuItemId: 'gongbao-chicken', orderedBy: '我', createdAt: '2026-04-17T00:00:00.000Z' },
      { id: '2', menuItemId: 'gongbao-chicken', orderedBy: '她', createdAt: '2026-04-17T01:00:00.000Z' },
      { id: '3', menuItemId: 'hotpot', orderedBy: '我', createdAt: '2026-04-17T02:00:00.000Z' },
    ]);

    expect(markedDates['2026-04-21']).toMatchObject({
      marked: true,
      selected: true,
      dotColor: '#c95f35',
      selectedColor: '#1f4438',
    });
    expect(counts).toEqual({
      'gongbao-chicken': 2,
      hotpot: 1,
    });
  });

  test('starts without a wheel result until first spin', () => {
    const shared = createInitialPersistedState().shared;

    expect(shared.lastWheelPickId).toBeNull();
    expect(getLatestWheelPick(shared.menu, shared.lastWheelPickId)).toBeUndefined();
  });

  test('hides visible wheel pick while spinning', () => {
    const shared = createInitialPersistedState().shared;
    const chosenId = shared.menu[1].id;

    expect(getVisibleWheelPick(false, shared.menu, chosenId)?.id).toBe(chosenId);
    expect(getVisibleWheelPick(true, shared.menu, chosenId)).toBeUndefined();
  });

  test('returns latest wheel pick and geometric helpers', () => {
    const shared = createInitialPersistedState().shared;
    const latestPick = getLatestWheelPick(shared.menu, shared.menu[1].id);
    const point = polarToCartesian(100, 50, 90);
    const path = describeSlicePath(100, 50, 0, 120);

    expect(latestPick?.id).toBe(shared.menu[1].id);
    expect(point.x).toBeCloseTo(150);
    expect(point.y).toBeCloseTo(100);
    expect(path.startsWith('M 100 100')).toBe(true);
  });

  test('formats local date and time helpers', () => {
    const isoString = '2026-04-17T08:09:10.000Z';
    const date = new Date(isoString);
    const expectedTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    const expectedShortTime = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    expect(getTimeLabel(date)).toBe(expectedTime);
    expect(getShortTime(isoString)).toBe(expectedShortTime);
    expect(getLocalTimeLabel(isoString)).toBe(expectedShortTime);
    expect(getDisplayDate('2026-04-17')).toContain('4月17日');
  });

  test('creates initial local settings and room credentials in expected shape', () => {
    const local = createInitialLocalSettings();
    const roomCode = createRoomCode();
    const roomSecret = createRoomSecret();

    expect(local.currentUser).toBe('我');
    expect(local.lastSyncedAt).toBeNull();
    expect(local.lastSyncedSnapshot).toBeNull();
    expect(local.clientId).toMatch(/^client-[a-z0-9]{8}$/);
    expect(local.recoveryToken).toMatch(/^[a-z0-9]{32}$/);
    expect(roomCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(roomSecret).toMatch(/^[A-Z2-9]{12}$/);
  });

  test('regenerates invalid persisted recovery token during normalization', () => {
    const restored = normalizePersistedState({
      shared: createInitialSharedState(),
      local: {
        currentUser: '我',
        roomCode: 'ab12cd34',
        roomSecret: 'xy98zt76',
        clientId: 'client-abc12345',
        recoveryToken: 'bad-token',
      },
    });

    expect(restored?.local.recoveryToken).toMatch(/^[a-z0-9]{32}$/);
    expect(restored?.local.recoveryToken).not.toBe('bad-token');
  });

  test('normalizes valid persisted recovery token to lowercase', () => {
    const restored = normalizePersistedState({
      shared: createInitialSharedState(),
      local: {
        currentUser: '我',
        roomCode: 'ab12cd34',
        roomSecret: 'xy98zt76',
        clientId: 'client-abc12345',
        recoveryToken: 'ABCD1234ABCD1234ABCD1234ABCD1234',
      },
    });

    expect(restored?.local.recoveryToken).toBe('abcd1234abcd1234abcd1234abcd1234');
  });

  test('creates ids with stable format using secure random source', () => {
    const id = createId('todo');

    expect(id).toMatch(/^todo-\d+-[a-z0-9]{6}$/);
  });

  test('rejects invalid day collections and non-object persisted values', () => {
    expect(normalizePersistedState('bad-data')).toBeNull();
    expect(
      normalizeRemoteSharedState({
        lastWheelPickId: null,
        menu: [],
        days: {
          '2026-04-17': {
            todos: [{ id: '1', text: 'x', done: false, assignee: '错误' }],
            messages: [],
            orders: [],
          },
        },
      })
    ).toBeNull();
    expect(
      normalizeRemoteSharedState({
        lastWheelPickId: null,
        menu: [],
        days: [],
      })
    ).toBeNull();
  });

  test('normalizes degree into the 0-359 range', () => {
    expect(normalizeDegree(725)).toBe(5);
    expect(normalizeDegree(-30)).toBe(330);
  });

  test('matches synced snapshot by payload and server timestamp only', () => {
    const state = createInitialPersistedState().shared;
    const snapshot = serializeSharedStateSnapshot(state);
    const reorderedState = {
      ...state,
      days: Object.fromEntries(Object.entries(state.days).reverse()),
    };
    const updatedAt = '2026-04-17T12:00:00.000Z';

    expect(isKnownSyncedSnapshot(state, updatedAt, snapshot, updatedAt)).toBe(true);
    expect(isKnownSyncedSnapshot(reorderedState, updatedAt, snapshot, updatedAt)).toBe(true);
    expect(isKnownSyncedSnapshot(state, '2026-04-17T12:01:00.000Z', snapshot, updatedAt)).toBe(false);
    expect(isKnownSyncedSnapshot({ ...state, meta: { ...state.meta, lastEditedBy: '她' } }, updatedAt, snapshot, updatedAt)).toBe(false);
    expect(isKnownSyncedSnapshot(state, updatedAt, null, updatedAt)).toBe(false);
  });

  test('keeps selected date visible without faking activity markers', () => {
    const day = addTodoToDay(createEmptyDay(), '做饭', '共同');
    const markedDates = getMarkedDates({ '2026-04-17': day }, '2026-04-18');

    expect(markedDates['2026-04-17']).toMatchObject({
      marked: true,
      dotColor: '#c95f35',
    });
    expect(markedDates['2026-04-18']).toMatchObject({
      selected: true,
      selectedColor: '#1f4438',
      selectedTextColor: '#fffdf8',
    });
    expect(markedDates['2026-04-18'].marked).toBeUndefined();
  });

  test('counts large order collections accurately', () => {
    const orders = Array.from({ length: 2400 }, (_, index) => {
      const orderedBy: '我' | '她' = index % 2 === 0 ? '我' : '她';

      return {
        id: `order-${index}`,
        menuItemId: index % 3 === 0 ? 'gongbao-chicken' : index % 3 === 1 ? 'hotpot' : 'noodle-🍜',
        orderedBy,
        createdAt: `2026-04-17T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      };
    });

    expect(getOrderCounts(orders)).toEqual({
      'gongbao-chicken': 800,
      hotpot: 800,
      'noodle-🍜': 800,
    });
  });

  test('preserves previous states during repeated shared day updates', () => {
    const dateKey = '2026-04-30';
    const snapshots = [];
    let state = createInitialPersistedState().shared;

    for (let index = 0; index < 12; index += 1) {
      state = updateSharedDay(state, dateKey, (day) => addTodoToDay(day, `任务-${index}`, '共同'));
      snapshots.push(state);
    }

    expect(snapshots[0].days[dateKey].todos).toHaveLength(1);
    expect(snapshots[5].days[dateKey].todos).toHaveLength(6);
    expect(state.days[dateKey].todos).toHaveLength(12);
    expect(snapshots[0].days[dateKey].todos[0].text).toBe('任务-0');
    expect(snapshots[5].days[dateKey].todos[0].text).toBe('任务-5');
  });

  test('normalizes large valid remote payloads and rejects a single malformed nested record', () => {
    const baseDate = new Date('2026-01-01T00:00:00.000Z');
    const sharedMenu = createInitialPersistedState().shared.menu;
    const days = Object.fromEntries(
      Array.from({ length: 180 }, (_, index) => {
        const dayDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000);
        const dateKey = getDateKey(dayDate);

        return [
          dateKey,
          {
            todos: [{ id: `todo-${index}`, text: `事项-${index}`, done: false, assignee: '共同' }],
            messages: [{ id: `message-${index}`, author: '我', content: `留言-${index}`, createdAt: '2026-04-17T00:00:00.000Z' }],
            orders: [{ id: `order-${index}`, menuItemId: 'hotpot', orderedBy: '她', createdAt: '2026-04-17T00:00:00.000Z' }],
          },
        ];
      })
    );

    const normalized = normalizeRemoteSharedState({
      lastWheelPickId: null,
      menu: sharedMenu,
      days,
    });

    expect(normalized).not.toBeNull();
    expect(Object.keys(normalized?.days ?? {})).toHaveLength(180);
    expect(normalized?.days['2026-01-01']).toBeDefined();
    expect(normalized?.days['2026-03-01']).toBeDefined();
    expect(normalized?.days['2026-06-29']).toBeDefined();

    const malformedDays = {
      ...days,
      '2026-06-30': {
        todos: [{ id: 'bad', text: '坏数据', done: false, assignee: '错误' }],
        messages: [],
        orders: [],
      },
    };

    expect(
      normalizeRemoteSharedState({
        lastWheelPickId: null,
        menu: sharedMenu,
        days: malformedDays,
      })
    ).toBeNull();
  });

  test('rejects malformed remote shared state', () => {
    expect(normalizeRemoteSharedState(null)).toBeNull();
    expect(
      normalizeRemoteSharedState({
        lastWheelPickId: null,
        menu: [{ id: 1 }],
        days: {},
      })
    ).toBeNull();
  });
});
