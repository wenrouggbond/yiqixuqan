import { LocaleConfig } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';

export type Person = '我' | '她';
export type TodoAssignee = Person | '共同';

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  heat: string;
};

export type NewMenuItemInput = {
  name: string;
  category?: string;
  description?: string;
  tags?: string[];
  heat?: string;
};

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  assignee: TodoAssignee;
};

export type MessageItem = {
  id: string;
  author: Person;
  content: string;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  menuItemId: string;
  orderedBy: Person;
  createdAt: string;
};

export type DayRecord = {
  todos: TodoItem[];
  messages: MessageItem[];
  orders: OrderItem[];
};

export type SharedMeta = {
  lastEditedAt: string;
  lastEditedBy: string | null;
};

export type SharedState = {
  lastWheelPickId: string | null;
  menu: MenuItem[];
  days: Record<string, DayRecord>;
  meta: SharedMeta;
};

export type LocalSettings = {
  currentUser: Person;
  roomCode: string;
  roomSecret: string;
  clientId: string;
  recoveryToken: string;
  lastSyncedRoomCode: string;
  lastSyncedAt: string | null;
  lastSyncedSnapshot: string | null;
};

export type PersistedState = {
  shared: SharedState;
  local: LocalSettings;
};

type LegacyAppState = {
  currentUser?: Person;
  lastWheelPickId?: string | null;
  menu?: MenuItem[];
  days?: Record<string, DayRecord>;
};

export const STORAGE_KEY = 'couple-meal-app-state-v2';
export const LEGACY_STORAGE_KEYS = ['couple-meal-app-state'];
export const PEOPLE: Person[] = ['我', '她'];
export const TODO_ASSIGNEES: TodoAssignee[] = ['共同', '我', '她'];
export const WHEEL_COLORS = [
  '#c95f35',
  '#dc8b45',
  '#e8ba5a',
  '#79a96b',
  '#4f8371',
  '#4d678f',
  '#8a5a79',
  '#b24a55',
  '#e4784d',
  '#238b7e',
];

export const DEFAULT_MENU: MenuItem[] = [
  {
    id: 'gongbao-chicken',
    name: '宫保鸡丁',
    category: '下饭',
    description: '微辣、香口、配米饭很稳。',
    tags: ['经典', '快手'],
    heat: '热菜',
  },
  {
    id: 'tomato-beef',
    name: '番茄肥牛',
    category: '治愈',
    description: '带点汤汁，酸甜开胃。',
    tags: ['热乎', '有汤'],
    heat: '热菜',
  },
  {
    id: 'curry-rice',
    name: '咖喱鸡饭',
    category: '主食',
    description: '偏浓郁，适合想吃饭的时候。',
    tags: ['饱腹', '稳妥'],
    heat: '热菜',
  },
  {
    id: 'beef-noodle',
    name: '红烧牛肉面',
    category: '面食',
    description: '天冷或下雨的时候特别合适。',
    tags: ['面食', '有汤'],
    heat: '热菜',
  },
  {
    id: 'salad-bowl',
    name: '鸡胸沙拉碗',
    category: '轻食',
    description: '嘴馋但想克制一点的时候选它。',
    tags: ['轻负担', '清爽'],
    heat: '冷盘',
  },
  {
    id: 'hotpot',
    name: '寿喜锅',
    category: '共享',
    description: '适合两个人慢慢吃。',
    tags: ['双人', '仪式感'],
    heat: '锅物',
  },
  {
    id: 'malatang',
    name: '麻辣香锅',
    category: '重口',
    description: '想吃刺激一点的时候很顶。',
    tags: ['香辣', '满足'],
    heat: '热菜',
  },
  {
    id: 'grilled-fish',
    name: '蒜香烤鱼',
    category: '聚餐',
    description: '适合特别一点的晚餐。',
    tags: ['双人', '大满足'],
    heat: '热菜',
  },
];

LocaleConfig.locales.zh = {
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  today: '今天',
};
LocaleConfig.defaultLocale = 'zh';

export function pad(value: number) {
  return value.toString().padStart(2, '0');
}

export function getDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getTimeLabel(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function getShortTime(isoString: string) {
  const date = new Date(isoString);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getLocalTimeLabel(isoString: string) {
  const date = new Date(isoString);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getDisplayDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekDays[date.getDay()]}`;
}

function getRandomString(length: number, alphabet: string) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${getRandomString(6, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
}

export function createClientId() {
  return `client-${getRandomString(8, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
}

export function createRecoveryToken() {
  return getRandomString(32, 'abcdefghijklmnopqrstuvwxyz0123456789');
}

export function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return getRandomString(8, alphabet);
}

export function createRoomSecret() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return getRandomString(12, alphabet);
}

export function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function normalizeRoomSecret(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export function normalizeRecoveryToken(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9]{32}$/.test(normalized) ? normalized : '';
}

export function createEmptyDay(): DayRecord {
  return { todos: [], messages: [], orders: [] };
}

export function createInitialSharedState(): SharedState {
  const today = getDateKey(new Date());
  const now = Date.now();

  return {
    lastWheelPickId: null,
    menu: DEFAULT_MENU,
    days: {
      [today]: {
        todos: [
          { id: createId('todo'), text: '确认今晚几点一起吃饭', done: false, assignee: '共同' },
          { id: createId('todo'), text: '顺路买点水果', done: false, assignee: '我' },
        ],
        messages: [
          {
            id: createId('message'),
            author: '她',
            content: '今天想吃热乎一点的，最好带点汤。',
            createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
          },
          {
            id: createId('message'),
            author: '我',
            content: '可以，晚点让转盘帮我们二选一。',
            createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
          },
        ],
        orders: [
          {
            id: createId('order'),
            menuItemId: DEFAULT_MENU[1].id,
            orderedBy: '她',
            createdAt: new Date(now - 1000 * 60 * 15).toISOString(),
          },
        ],
      },
    },
    meta: {
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: null,
    },
  };
}

export function createInitialLocalSettings(): LocalSettings {
  return {
    currentUser: '我',
    roomCode: '',
    roomSecret: '',
    clientId: createClientId(),
    recoveryToken: createRecoveryToken(),
    lastSyncedRoomCode: '',
    lastSyncedAt: null,
    lastSyncedSnapshot: null,
  };
}

export function createInitialPersistedState(): PersistedState {
  return {
    shared: createInitialSharedState(),
    local: createInitialLocalSettings(),
  };
}

export function touchSharedState(state: SharedState, editorId: string) {
  return {
    ...state,
    meta: {
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: editorId,
    },
  };
}

export function updateSharedDay(
  state: SharedState,
  dateKey: string,
  updater: (day: DayRecord) => DayRecord
) {
  const day = state.days[dateKey] ?? createEmptyDay();
  return {
    ...state,
    days: {
      ...state.days,
      [dateKey]: updater(day),
    },
  };
}

export function addTodoToDay(day: DayRecord, text: string, assignee: TodoAssignee) {
  return {
    ...day,
    todos: [{ id: createId('todo'), text, done: false, assignee }, ...day.todos],
  };
}

export function toggleTodoInDay(day: DayRecord, todoId: string) {
  return {
    ...day,
    todos: day.todos.map((todo) => (todo.id === todoId ? { ...todo, done: !todo.done } : todo)),
  };
}

export function addMessageToDay(day: DayRecord, author: Person, content: string) {
  return {
    ...day,
    messages: [
      {
        id: createId('message'),
        author,
        content,
        createdAt: new Date().toISOString(),
      },
      ...day.messages,
    ],
  };
}

export function addOrderToDay(day: DayRecord, menuItemId: string, orderedBy: Person) {
  return {
    ...day,
    orders: [
      {
        id: createId('order'),
        menuItemId,
        orderedBy,
        createdAt: new Date().toISOString(),
      },
      ...day.orders,
    ],
  };
}

export function addMenuItemToSharedState(state: SharedState, input: NewMenuItemInput) {
  return {
    ...state,
    menu: [
      ...state.menu,
      {
        id: createId('menu'),
        name: input.name,
        category: input.category || '自定义',
        description: input.description || '你们后来新加进来的备选项。',
        tags: input.tags?.length ? input.tags : ['新菜'],
        heat: input.heat || '待定',
      },
    ],
  };
}

export function getMarkedDates(days: Record<string, DayRecord>, selectedDate: string): MarkedDates {
  const markedDates: MarkedDates = {};

  Object.entries(days).forEach(([dateKey, day]) => {
    if (day.todos.length > 0 || day.messages.length > 0 || day.orders.length > 0) {
      markedDates[dateKey] = { marked: true, dotColor: '#c95f35' };
    }
  });

  markedDates[selectedDate] = {
    ...(markedDates[selectedDate] ?? {}),
    selected: true,
    selectedColor: '#1f4438',
    selectedTextColor: '#fffdf8',
  };

  return markedDates;
}

export function getOrderCounts(orders: OrderItem[]) {
  return orders.reduce<Record<string, number>>((counts, order) => ({
    ...counts,
    [order.menuItemId]: (counts[order.menuItemId] ?? 0) + 1,
  }), {});
}

export function getLatestWheelPick(menu: MenuItem[], lastWheelPickId: string | null) {
  return menu.find((item) => item.id === lastWheelPickId);
}

function normalizeMenuItem(raw: unknown): MenuItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Partial<MenuItem>;

  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.category !== 'string' ||
    typeof item.description !== 'string' ||
    typeof item.heat !== 'string' ||
    !Array.isArray(item.tags) ||
    !item.tags.every((tag) => typeof tag === 'string')
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    tags: item.tags,
    heat: item.heat,
  };
}

function normalizeTodoItem(raw: unknown): TodoItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const todo = raw as Partial<TodoItem>;

  if (
    typeof todo.id !== 'string' ||
    typeof todo.text !== 'string' ||
    typeof todo.done !== 'boolean' ||
    (todo.assignee !== '共同' && todo.assignee !== '我' && todo.assignee !== '她')
  ) {
    return null;
  }

  return {
    id: todo.id,
    text: todo.text,
    done: todo.done,
    assignee: todo.assignee,
  };
}

function normalizeMessageItem(raw: unknown): MessageItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const message = raw as Partial<MessageItem>;

  if (
    typeof message.id !== 'string' ||
    (message.author !== '我' && message.author !== '她') ||
    typeof message.content !== 'string' ||
    typeof message.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: message.id,
    author: message.author,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function normalizeOrderItem(raw: unknown): OrderItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const order = raw as Partial<OrderItem>;

  if (
    typeof order.id !== 'string' ||
    typeof order.menuItemId !== 'string' ||
    (order.orderedBy !== '我' && order.orderedBy !== '她') ||
    typeof order.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: order.id,
    menuItemId: order.menuItemId,
    orderedBy: order.orderedBy,
    createdAt: order.createdAt,
  };
}

function normalizeDayRecord(raw: unknown): DayRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const day = raw as Partial<DayRecord>;

  if (!Array.isArray(day.todos) || !Array.isArray(day.messages) || !Array.isArray(day.orders)) {
    return null;
  }

  const todos = day.todos.map(normalizeTodoItem);
  const messages = day.messages.map(normalizeMessageItem);
  const orders = day.orders.map(normalizeOrderItem);

  if (
    todos.some((item) => item === null) ||
    messages.some((item) => item === null) ||
    orders.some((item) => item === null)
  ) {
    return null;
  }

  return {
    todos: todos as TodoItem[],
    messages: messages as MessageItem[],
    orders: orders as OrderItem[],
  };
}

function normalizeDays(raw: unknown): Record<string, DayRecord> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const entries = Object.entries(raw).map(([dateKey, day]) => {
    const normalizedDay = normalizeDayRecord(day);
    return normalizedDay ? [dateKey, normalizedDay] : null;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as [string, DayRecord][]);
}

function normalizeMeta(raw: SharedState['meta'] | undefined): SharedMeta {
  const fallbackTime = new Date().toISOString();
  const lastEditedAt = raw && typeof raw.lastEditedAt === 'string' ? raw.lastEditedAt : fallbackTime;

  return {
    lastEditedAt: Number.isNaN(Date.parse(lastEditedAt)) ? fallbackTime : lastEditedAt,
    lastEditedBy: raw && typeof raw.lastEditedBy === 'string' ? raw.lastEditedBy : null,
  };
}

function normalizeSharedState(raw: Partial<SharedState>): SharedState | null {
  const menu = Array.isArray(raw.menu) ? raw.menu.map(normalizeMenuItem) : null;
  const days = normalizeDays(raw.days);

  if (!menu || menu.some((item) => item === null) || !days) {
    return null;
  }

  return {
    lastWheelPickId: typeof raw.lastWheelPickId === 'string' ? raw.lastWheelPickId : null,
    menu: menu as MenuItem[],
    days,
    meta: normalizeMeta(raw.meta),
  };
}

function stableSerializeValue(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeValue(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerializeValue(nestedValue)}`).join(',')}}`;
}

export function serializeSharedStateSnapshot(state: SharedState) {
  return stableSerializeValue(state);
}

export function isKnownSyncedSnapshot(
  state: SharedState | null,
  updatedAt: string | null,
  lastSyncedSnapshot: string | null,
  lastRemoteUpdatedAt: string | null
) {
  if (!state || !updatedAt || !lastSyncedSnapshot || !lastRemoteUpdatedAt) {
    return false;
  }

  return serializeSharedStateSnapshot(state) === lastSyncedSnapshot && updatedAt === lastRemoteUpdatedAt;
}

function normalizeLocalSettings(raw: Partial<LocalSettings> | undefined): LocalSettings {
  const lastSyncedAt = typeof raw?.lastSyncedAt === 'string' ? raw.lastSyncedAt : null;
  const lastSyncedSnapshot = typeof raw?.lastSyncedSnapshot === 'string' ? raw.lastSyncedSnapshot : null;

  return {
    currentUser: raw?.currentUser === '她' ? '她' : '我',
    roomCode: typeof raw?.roomCode === 'string' ? normalizeRoomCode(raw.roomCode) : '',
    roomSecret: typeof raw?.roomSecret === 'string' ? normalizeRoomSecret(raw.roomSecret) : '',
    clientId:
      typeof raw?.clientId === 'string' && raw.clientId.trim()
        ? raw.clientId
        : createClientId(),
    recoveryToken:
      typeof raw?.recoveryToken === 'string'
        ? normalizeRecoveryToken(raw.recoveryToken) || createRecoveryToken()
        : createRecoveryToken(),
    lastSyncedRoomCode:
      typeof raw?.lastSyncedRoomCode === 'string' ? normalizeRoomCode(raw.lastSyncedRoomCode) : '',
    lastSyncedAt: lastSyncedAt && !Number.isNaN(Date.parse(lastSyncedAt)) ? lastSyncedAt : null,
    lastSyncedSnapshot: lastSyncedSnapshot,
  };
}

export function normalizeRemoteSharedState(raw: unknown): SharedState | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  return normalizeSharedState(raw as Partial<SharedState>);
}

export function normalizePersistedState(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const maybePersisted = raw as Partial<PersistedState>;

  if (maybePersisted.shared) {
    const shared = normalizeSharedState(maybePersisted.shared);
    if (!shared) {
      return null;
    }

    return {
      shared,
      local: normalizeLocalSettings(maybePersisted.local),
    };
  }

  const legacy = raw as LegacyAppState;
  const shared = normalizeSharedState({
    lastWheelPickId: legacy.lastWheelPickId,
    menu: legacy.menu,
    days: legacy.days,
  });

  if (!shared) {
    return null;
  }

  return {
    shared,
    local: normalizeLocalSettings({ currentUser: legacy.currentUser }),
  };
}

export function polarToCartesian(center: number, radius: number, angleInDegrees: number) {
  const radians = (angleInDegrees - 90) * (Math.PI / 180);
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

export function describeSlicePath(center: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(center, radius, startAngle);
  const end = polarToCartesian(center, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [`M ${center} ${center}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`, 'Z'].join(' ');
}

export function normalizeDegree(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
