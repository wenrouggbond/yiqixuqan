import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Animated, Alert, Easing, SafeAreaView, ScrollView } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  addMenuItemToSharedState,
  addMessageToDay,
  addOrderToDay,
  addTodoToDay,
  createEmptyDay,
  createInitialLocalSettings,
  createInitialSharedState,
  createRoomCode,
  createRoomSecret,
  getDateKey,
  getLocalTimeLabel,
  getMarkedDates,
  getOrderCounts,
  LocalSettings,
  normalizeDegree,
  normalizeRoomCode,
  normalizeRoomSecret,
  SharedState,
  TodoAssignee,
  toggleTodoInDay,
  touchSharedState,
  updateSharedDay,
} from './src/models';
import { styles } from './src/styles';
import { prepareRoomAccess } from './src/sync';
import { usePersistentAppState } from './src/hooks/usePersistentAppState';
import { useCloudSync } from './src/hooks/useCloudSync';
import { HeroSection } from './src/sections/HeroSection';
import { SyncSection } from './src/sections/SyncSection';
import { CalendarSection } from './src/sections/CalendarSection';
import { TodoSection } from './src/sections/TodoSection';
import { MessagesSection } from './src/sections/MessagesSection';
import { MenuSection } from './src/sections/MenuSection';
import { WheelSection } from './src/sections/WheelSection';
import { getVisibleWheelPick } from './src/wheel';

type SyncTone = 'idle' | 'live' | 'error';

function formatSyncTime(isoString: string | null) {
  if (!isoString) {
    return '还没有云端同步记录';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '还没有云端同步记录';
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${getLocalTimeLabel(date.toISOString())}`;
}

function getVisibleLastSyncedAt(lastSyncedAt: string | null, roomCode: string, lastSyncedRoomCode: string) {
  return roomCode && roomCode === lastSyncedRoomCode ? lastSyncedAt : null;
}

export default function App() {
  const initialDate = getDateKey(new Date());
  const [sharedState, setSharedState] = useState<SharedState>(createInitialSharedState);
  const [localSettings, setLocalSettings] = useState<LocalSettings>(createInitialLocalSettings);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isReadyToPersist, setIsReadyToPersist] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const [newTodoText, setNewTodoText] = useState('');
  const [todoAssignee, setTodoAssignee] = useState<TodoAssignee>('共同');
  const [newMessageText, setNewMessageText] = useState('');
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('');
  const [newMenuDescription, setNewMenuDescription] = useState('');
  const [newMenuTags, setNewMenuTags] = useState('');
  const [newMenuHeat, setNewMenuHeat] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomSecretInput, setRoomSecretInput] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncTone, setSyncTone] = useState<SyncTone>('idle');
  const [syncTitle, setSyncTitle] = useState('仅本机模式');
  const [syncDetail, setSyncDetail] = useState('还没配置云端同步时，App 仍然可以在本机正常使用。');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [wheelMenuSnapshot, setWheelMenuSnapshot] = useState(sharedState.menu);

  const spinValue = useRef(new Animated.Value(0)).current;
  const spinRotationRef = useRef(0);
  const spinningChoiceRef = useRef<{ id: string; index: number } | null>(null);
  const sharedStateRef = useRef(sharedState);
  const localSettingsRef = useRef(localSettings);
  const syncCleanupRef = useRef<null | (() => void)>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemoteSerializedRef = useRef<string | null>(null);
  const lastSyncedSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    sharedStateRef.current = sharedState;
  }, [sharedState]);

  useEffect(() => {
    localSettingsRef.current = localSettings;
  }, [localSettings]);

  useEffect(() => {
    if (!isSpinning) {
      setWheelMenuSnapshot(sharedState.menu);
    }
  }, [isSpinning, sharedState.menu]);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const reportPersistenceError = useCallback((title: string, detail: string) => {
    setSyncTone('error');
    setSyncTitle(title);
    setSyncDetail(detail);
  }, []);

  usePersistentAppState({
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
  });

  const { cloudConfigured, canManualSync, hasSyncConflict, syncNow, resolveConflict } = useCloudSync({
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
  });

  const currentDay = sharedState.days[selectedDate] ?? createEmptyDay();
  const markedDates = getMarkedDates(sharedState.days, selectedDate);
  const orderCounts = getOrderCounts(currentDay.orders);
  const latestWheelPick = getVisibleWheelPick(isSpinning, sharedState.menu, sharedState.lastWheelPickId);
  const statusStyle =
    syncTone === 'live'
      ? styles.statusBannerLive
      : syncTone === 'error'
        ? styles.statusBannerError
        : styles.statusBannerIdle;

  const applySharedUpdate = (updater: (current: SharedState) => SharedState) => {
    setSharedState((current) => touchSharedState(updater(current), localSettingsRef.current.clientId));
  };

  const updateCurrentDayState = (updater: (day: typeof currentDay) => typeof currentDay) => {
    applySharedUpdate((current) => updateSharedDay(current, selectedDate, updater));
  };

  const addTodo = () => {
    const text = newTodoText.trim();
    if (!text) {
      return;
    }

    void Haptics.selectionAsync();
    updateCurrentDayState((day) => addTodoToDay(day, text, todoAssignee));
    setNewTodoText('');
  };

  const toggleTodo = (todoId: string) => {
    void Haptics.selectionAsync();
    updateCurrentDayState((day) => toggleTodoInDay(day, todoId));
  };

  const addMessage = () => {
    const content = newMessageText.trim();
    if (!content) {
      return;
    }

    void Haptics.selectionAsync();
    updateCurrentDayState((day) => addMessageToDay(day, localSettings.currentUser, content));
    setNewMessageText('');
  };

  const addOrder = (menuItemId: string) => {
    void Haptics.selectionAsync();
    updateCurrentDayState((day) => addOrderToDay(day, menuItemId, localSettings.currentUser));
  };

  const addMenuItem = () => {
    const name = newMenuName.trim();
    const category = newMenuCategory.trim();
    const description = newMenuDescription.trim();
    const tags = newMenuTags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const heat = newMenuHeat.trim();

    if (!name) {
      return;
    }

    void Haptics.selectionAsync();
    applySharedUpdate((current) =>
      addMenuItemToSharedState(current, {
        name,
        category,
        description,
        tags,
        heat,
      })
    );
    setNewMenuName('');
    setNewMenuCategory('');
    setNewMenuDescription('');
    setNewMenuTags('');
    setNewMenuHeat('');
  };

  const saveRoomCode = async () => {
    const normalizedRoomCode = normalizeRoomCode(roomCodeInput);
    const normalizedRoomSecret = normalizeRoomSecret(roomSecretInput);
    setRoomCodeInput(normalizedRoomCode);
    setRoomSecretInput(normalizedRoomSecret);

    if (!normalizedRoomCode || !normalizedRoomSecret) {
      Alert.alert('缺少配对信息', '请先输入房间码和配对口令，再保存配对信息。');
      return;
    }

    const result = await prepareRoomAccess(normalizedRoomCode, normalizedRoomSecret, localSettingsRef.current.recoveryToken);
    if (result.error) {
      Alert.alert('保存配对信息失败', result.error);
      return;
    }

    setLocalSettings((current) => ({
      ...current,
      roomCode: normalizedRoomCode,
      roomSecret: normalizedRoomSecret,
    }));
  };

  const generateNewRoomCode = () => {
    setRoomCodeInput(createRoomCode());
    setRoomSecretInput(createRoomSecret());
  };

  const handleSyncNow = async () => {
    if (!cloudConfigured) {
      Alert.alert('未配置云同步', '先把 Supabase 环境变量配好，才可以让两台手机实时互通。');
      return;
    }

    const requestedRoomCode = normalizeRoomCode(roomCodeInput || localSettings.roomCode);
    const requestedRoomSecret = normalizeRoomSecret(roomSecretInput || localSettings.roomSecret);
    setRoomCodeInput(requestedRoomCode);
    setRoomSecretInput(requestedRoomSecret);

    setIsManualSyncing(true);
    try {
      const result = await syncNow(requestedRoomCode, requestedRoomSecret);

      if (result.status === 'missing_room') {
        Alert.alert('缺少配对信息', '请先生成或输入房间码和配对口令，然后在两台手机上保存为同一组配对信息。');
        return;
      }

      if (result.status === 'room_changed') {
        Alert.alert('请先完成连接', '先保存房间码并等待首次拉取完成，再手动同步，避免覆盖远端已有数据。');
        return;
      }

      if (result.status === 'not_ready') {
        Alert.alert(
          result.hasConflict ? '同步冲突待处理' : '请先完成连接',
          result.hasConflict
            ? '检测到双端同时修改。当前已暂停上传，避免互相覆盖；请先确认保留哪一端的数据。'
            : '当前房间还没完成首次同步，暂时不能手动上传。请等待连接完成后再试。'
        );
        return;
      }

      if (result.status === 'conflict') {
        Alert.alert('手动同步冲突', '云端内容刚被另一台设备更新，当前未覆盖远端数据，请先查看最新同步结果。');
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleResolveConflict = async (resolution: 'use_remote' | 'use_local') => {
    if (!cloudConfigured) {
      Alert.alert('未配置云同步', '先把 Supabase 环境变量配好，才可以恢复双端同步。');
      return;
    }

    setIsManualSyncing(true);
    try {
      const result = await resolveConflict(resolution);

      if (result.status === 'missing_room') {
        Alert.alert('缺少配对信息', '请先保存房间码和配对口令，再处理同步冲突。');
        return;
      }

      if (result.status === 'error') {
        Alert.alert('冲突处理失败', '请稍后重试，并检查网络、房间码和 Supabase 配置。');
        return;
      }

      if (result.status === 'conflict') {
        Alert.alert('冲突仍未解决', '处理期间云端内容又发生变化，请重新选择保留哪一端的数据。');
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const spinWheel = () => {
    if (sharedState.menu.length === 0) {
      Alert.alert('菜单为空', '先加几道菜，再让转盘来帮你们做决定。');
      return;
    }

    if (isSpinning) {
      return;
    }

    const menuSnapshot = sharedState.menu;
    const chosenIndex = Math.floor(Math.random() * menuSnapshot.length);
    const chosenItem = menuSnapshot[chosenIndex];
    const segmentAngle = 360 / menuSnapshot.length;
    const currentRotation = normalizeDegree(spinRotationRef.current);
    const finalRotation = normalizeDegree(360 - chosenIndex * segmentAngle);
    let delta = finalRotation - currentRotation;
    if (delta < 0) {
      delta += 360;
    }

    const targetRotation = spinRotationRef.current + 1800 + delta;
    spinningChoiceRef.current = { id: chosenItem.id, index: chosenIndex };
    setWheelMenuSnapshot(menuSnapshot);
    setIsSpinning(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(spinValue, {
      toValue: targetRotation,
      duration: 4200,
      easing: Easing.bezier(0.12, 0.9, 0.18, 1),
      useNativeDriver: true,
    }).start(() => {
      spinRotationRef.current = targetRotation;
      const finishedChoice = spinningChoiceRef.current;
      if (finishedChoice) {
        applySharedUpdate((current) =>
          current.menu.some((item) => item.id === finishedChoice.id)
            ? { ...current, lastWheelPickId: finishedChoice.id }
            : current
        );
      }
      spinningChoiceRef.current = null;
      setIsSpinning(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#f4e4c9', '#f6efe3', '#efe2cd']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
          <HeroSection
            liveTime={liveTime}
            selectedDate={selectedDate}
            syncTone={syncTone}
            cloudConfigured={cloudConfigured}
            currentUser={localSettings.currentUser}
            onChangeUser={(person) => setLocalSettings((current) => ({ ...current, currentUser: person }))}
          />

          <SyncSection
            statusStyle={statusStyle}
            syncTitle={syncTitle}
            syncDetail={syncDetail}
            roomCode={localSettings.roomCode}
            lastSyncedText={formatSyncTime(
              getVisibleLastSyncedAt(lastSyncedAt, localSettings.roomCode, localSettings.lastSyncedRoomCode)
            )}
            roomCodeInput={roomCodeInput}
            roomSecretInput={roomSecretInput}
            isManualSyncing={isManualSyncing}
            canManualSync={canManualSync}
            hasSyncConflict={hasSyncConflict}
            onChangeRoomCodeInput={setRoomCodeInput}
            onChangeRoomSecretInput={setRoomSecretInput}
            onGenerateRoomCode={generateNewRoomCode}
            onSaveRoomCode={() => void saveRoomCode()}
            onSyncNow={() => void handleSyncNow()}
            onUseRemote={() => void handleResolveConflict('use_remote')}
            onUseLocal={() => void handleResolveConflict('use_local')}
          />

          <CalendarSection
            selectedDate={selectedDate}
            markedDates={markedDates}
            currentDay={currentDay}
            onSelectDate={setSelectedDate}
          />

          <TodoSection
            todoAssignee={todoAssignee}
            newTodoText={newTodoText}
            todos={currentDay.todos}
            onChangeTodoAssignee={setTodoAssignee}
            onChangeNewTodoText={setNewTodoText}
            onAddTodo={addTodo}
            onToggleTodo={toggleTodo}
          />

          <MessagesSection
            currentUser={localSettings.currentUser}
            newMessageText={newMessageText}
            messages={currentDay.messages}
            onChangeNewMessageText={setNewMessageText}
            onAddMessage={addMessage}
          />

          <MenuSection
            currentUser={localSettings.currentUser}
            menu={sharedState.menu}
            orders={currentDay.orders}
            orderCounts={orderCounts}
            newMenuName={newMenuName}
            newMenuCategory={newMenuCategory}
            newMenuDescription={newMenuDescription}
            newMenuTags={newMenuTags}
            newMenuHeat={newMenuHeat}
            onChangeNewMenuName={setNewMenuName}
            onChangeNewMenuCategory={setNewMenuCategory}
            onChangeNewMenuDescription={setNewMenuDescription}
            onChangeNewMenuTags={setNewMenuTags}
            onChangeNewMenuHeat={setNewMenuHeat}
            onAddMenuItem={addMenuItem}
            onAddOrder={addOrder}
          />

          <WheelSection
            menu={wheelMenuSnapshot}
            spinValue={spinValue}
            isSpinning={isSpinning}
            latestWheelPick={latestWheelPick}
            onSpinWheel={spinWheel}
            onConfirmPick={addOrder}
          />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
