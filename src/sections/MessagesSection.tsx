import { Pressable, Text, TextInput, View } from 'react-native';

import { SectionCard } from '../components/ui';
import { MessageItem, Person, getShortTime } from '../models';
import { styles } from '../styles';

type Props = {
  currentUser: Person;
  newMessageText: string;
  messages: MessageItem[];
  onChangeNewMessageText: (value: string) => void;
  onAddMessage: () => void;
};

export function MessagesSection({
  currentUser,
  newMessageText,
  messages,
  onChangeNewMessageText,
  onAddMessage,
}: Props) {
  return (
    <SectionCard title="双人留言板" subtitle="谁今天想吃什么，直接留在这里。">
      <TextInput
        value={newMessageText}
        onChangeText={onChangeNewMessageText}
        placeholder="例如：今晚想吃点热乎的，或者想喝汤。"
        placeholderTextColor="#a39483"
        style={[styles.input, styles.textarea]}
        multiline
      />
      <Pressable style={styles.primaryButtonWide} onPress={onAddMessage}>
        <Text style={styles.primaryButtonText}>以“{currentUser}”的身份留言</Text>
      </Pressable>
      <View style={styles.stack}>
        {messages.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>今天还没人留言</Text>
            <Text style={styles.emptyBody}>比如“想吃点清淡的”或者“今天想吃面”，都可以直接写。</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageCard,
                message.author === '她' ? styles.messageCardRight : styles.messageCardLeft,
              ]}
            >
              <View style={styles.messageMetaRow}>
                <Text style={styles.messageAuthor}>{message.author}</Text>
                <Text style={styles.messageTime}>{getShortTime(message.createdAt)}</Text>
              </View>
              <Text style={styles.messageContent}>{message.content}</Text>
            </View>
          ))
        )}
      </View>
    </SectionCard>
  );
}
