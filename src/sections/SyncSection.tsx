import { Pressable, StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';

import { SectionCard } from '../components/ui';
import { normalizeRoomCode, normalizeRoomSecret } from '../models';
import { styles } from '../styles';

type Props = {
  statusStyle: StyleProp<ViewStyle>;
  syncTitle: string;
  syncDetail: string;
  roomCode: string;
  lastSyncedText: string;
  roomCodeInput: string;
  roomSecretInput: string;
  isManualSyncing: boolean;
  canManualSync: boolean;
  hasSyncConflict: boolean;
  onChangeRoomCodeInput: (value: string) => void;
  onChangeRoomSecretInput: (value: string) => void;
  onGenerateRoomCode: () => void;
  onSaveRoomCode: () => void;
  onSyncNow: () => void;
  onUseRemote: () => void;
  onUseLocal: () => void;
};

export function SyncSection({
  statusStyle,
  syncTitle,
  syncDetail,
  roomCode,
  lastSyncedText,
  roomCodeInput,
  roomSecretInput,
  isManualSyncing,
  canManualSync,
  hasSyncConflict,
  onChangeRoomCodeInput,
  onChangeRoomSecretInput,
  onGenerateRoomCode,
  onSaveRoomCode,
  onSyncNow,
  onUseRemote,
  onUseLocal,
}: Props) {
  return (
    <SectionCard title="双人同步" subtitle="把你们的待办、菜单、用餐记录和转盘结果保持一致。">
      <View style={[styles.statusBanner, statusStyle]}>
        <Text style={styles.statusTitle}>{syncTitle}</Text>
        <Text style={styles.statusBody}>{syncDetail}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>当前房间码</Text>
          <Text style={styles.metaValue}>{roomCode || '还没保存'}</Text>
        </View>
        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>最近同步</Text>
          <Text style={styles.metaValue}>{lastSyncedText}</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          value={roomCodeInput}
          onChangeText={(value) => onChangeRoomCodeInput(normalizeRoomCode(value))}
          placeholder="输入同一个房间码，例如 AB12CD34"
          placeholderTextColor="#a39483"
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TextInput
          value={roomSecretInput}
          onChangeText={(value) => onChangeRoomSecretInput(normalizeRoomSecret(value))}
          placeholder="输入同一个配对口令，例如 Q8MN4R2K7X5C"
          placeholderTextColor="#a39483"
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View style={styles.inputRow}>
          <Pressable style={styles.secondaryButton} onPress={onGenerateRoomCode}>
            <Text style={styles.secondaryButtonText}>生成配对信息</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onSaveRoomCode}>
            <Text style={styles.primaryButtonText}>保存配对信息</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.ghostButton, (!canManualSync || isManualSyncing) && styles.buttonDisabled]}
          onPress={onSyncNow}
          disabled={!canManualSync || isManualSyncing}
        >
          <Text style={styles.ghostButtonText}>
            {isManualSyncing ? '正在同步...' : '立即同步当前数据'}
          </Text>
        </Pressable>
        {hasSyncConflict ? (
          <View style={styles.inputRow}>
            <Pressable
              style={[styles.secondaryButton, isManualSyncing && styles.buttonDisabled]}
              onPress={onUseRemote}
              disabled={isManualSyncing}
            >
              <Text style={styles.secondaryButtonText}>保留云端</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, isManualSyncing && styles.buttonDisabled]}
              onPress={onUseLocal}
              disabled={isManualSyncing}
            >
              <Text style={styles.primaryButtonText}>保留本地</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={styles.helperText}>
        两台手机保存同一组房间码与配对口令后，才会共享待办、菜单、用餐记录和转盘结果。
      </Text>
      <Text style={styles.helperText}>
        如果当前版本未启用云同步，本地记录仍然可以正常使用。
      </Text>
    </SectionCard>
  );
}
