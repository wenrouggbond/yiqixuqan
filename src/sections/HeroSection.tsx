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
          <Text style={styles.eyebrow}>双人吃饭上架准备版</Text>
          <Text style={styles.heroTitle}>一起选</Text>
          <Text style={styles.heroSubtitle}>
            现在已经支持本地使用，配好 Supabase 后还可以让两台手机实时同步。
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
            ? '已经接入可配置的云同步骨架，你把同一个房间码填到两台手机里就能共用内容。'
            : '这版仍然可以本地跑，但要真正双人共用，需要先按文档配置 Supabase 环境变量。'}
        </Text>
      </View>
    </LinearGradient>
  );
}
