import { Pressable, Text, View } from 'react-native';
import { Animated } from 'react-native';

import { Wheel } from '../components/Wheel';
import { MenuItem } from '../models';
import { styles } from '../styles';
import { SectionCard } from '../components/ui';

type Props = {
  menu: MenuItem[];
  spinValue: Animated.Value;
  isSpinning: boolean;
  latestWheelPick: MenuItem | undefined;
  onSpinWheel: () => void;
  onConfirmPick: (menuItemId: string) => void;
};

export function WheelSection({
  menu,
  spinValue,
  isSpinning,
  latestWheelPick,
  onSpinWheel,
  onConfirmPick,
}: Props) {
  return (
    <SectionCard title="选择困难救星" subtitle="点一下，让转盘替你们把犹豫踢出去。">
      <Wheel items={menu} spinValue={spinValue} />
      <Pressable
        style={[styles.primaryButtonWide, isSpinning && styles.buttonDisabled]}
        onPress={onSpinWheel}
        disabled={isSpinning}
      >
        <Text style={styles.primaryButtonText}>
          {isSpinning ? '转盘正在思考...' : '帮我们一起选'}
        </Text>
      </Pressable>
      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>转盘结果</Text>
        <Text style={styles.resultValue}>{latestWheelPick?.name ?? '先转一次试试'}</Text>
        <Text style={styles.resultHint}>
          {latestWheelPick?.description ?? '菜单准备好之后，点击按钮开始转。'}
        </Text>
        {latestWheelPick ? (
          <Pressable style={styles.secondaryButtonWide} onPress={() => onConfirmPick(latestWheelPick.id)}>
            <Text style={styles.secondaryButtonText}>就吃这个，记下这次选择</Text>
          </Pressable>
        ) : null}
      </View>
    </SectionCard>
  );
}
