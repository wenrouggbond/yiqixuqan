import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles';

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

export function ChoicePills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const selected = option === value;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.pillButton, selected && styles.pillButtonActive]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
