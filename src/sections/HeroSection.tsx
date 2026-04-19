import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { ChoicePills } from '../components/ui';
import { PEOPLE, Person, getDisplayDate, getTimeLabel } from '../models';
import { styles } from '../styles';

type Props = {
  liveTime: Date;
  selectedDate: string;
  syncTone: 'idle' | 'live' | 'error';
  cloudConfigured: boolean;
  currentUser: Person;
  onChangeUser: (person: Person) => void;
};

export function HeroSection({
  liveTime,
  selectedDate,
  syncTone,
  cloudConfigured,
  currentUser,
  onChangeUser,
}: Props) {
  return (
    <LinearGradient colors={['#1f4438', '#2e5a4c', '#446a57']} style={styles.hero}>
      <View style={styles.heroTopRow}>
        <View>
          <Text style={styles.eyebrow}>双人共享晚饭助手</Text>
          <Text style={styles.heroTitle}>一起选</Text>
          <Text style={styles.heroSubtitle}>
            一起记录想法、安排分工，轻松决定今天吃什么。
          </Text>
        </View>
        <View style={styles.heroStatus}>
          <Text style={styles.heroStatusLabel}>当前身份</Text>
          <ChoicePills options={PEOPLE} value={currentUser} onChange={onChangeUser} />
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>实时钟表</Text>
          <Text style={styles.metricValue}>{getTimeLabel(liveTime)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>当前日期</Text>
          <Text style={styles.metricValue}>{getDisplayDate(selectedDate)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>同步状态</Text>
          <Text style={styles.metricValue}>
            {syncTone === 'live' ? '已联网' : syncTone === 'error' ? '异常' : '本地'}
          </Text>
        </View>
      </View>

      <View style={styles.heroFootnote}>
        <Text style={styles.heroFootnoteText}>
          {cloudConfigured
            ? '两台设备保存同一组房间码与配对口令后，就能共享待办、菜单、用餐记录和转盘结果。'
            : '当前版本仅在本机保存内容，你仍然可以正常记录每日安排和选择。'}
        </Text>
      </View>
    </LinearGradient>
  );
}
