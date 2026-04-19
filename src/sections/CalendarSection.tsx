import { Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';

import { SectionCard } from '../components/ui';
import { DayRecord } from '../models';
import { styles } from '../styles';

type Props = {
  selectedDate: string;
  markedDates: MarkedDates;
  currentDay: DayRecord;
  onSelectDate: (date: string) => void;
};

export function CalendarSection({ selectedDate, markedDates, currentDay, onSelectDate }: Props) {
  return (
    <SectionCard title="实时日历" subtitle="点哪一天，就看哪一天的待办、菜单记录和用餐记录。">
      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => onSelectDate(day.dateString)}
        markedDates={markedDates}
        theme={{
          backgroundColor: '#fffaf2',
          calendarBackground: '#fffaf2',
          dayTextColor: '#2f2721',
          monthTextColor: '#1f4438',
          textDayFontSize: 15,
          textDayHeaderFontSize: 13,
          textMonthFontSize: 18,
          textMonthFontWeight: '700',
          arrowColor: '#c95f35',
          todayTextColor: '#c95f35',
          textSectionTitleColor: '#8b7d6b',
        }}
        style={styles.calendar}
      />
      <View style={styles.summaryRow}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeValue}>{currentDay.todos.length}</Text>
          <Text style={styles.summaryBadgeLabel}>待办</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeValue}>{currentDay.orders.length}</Text>
          <Text style={styles.summaryBadgeLabel}>记录</Text>
        </View>
      </View>
    </SectionCard>
  );
}
