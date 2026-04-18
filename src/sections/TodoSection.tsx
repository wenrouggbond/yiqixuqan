import { Pressable, Text, TextInput, View } from 'react-native';

import { ChoicePills, SectionCard } from '../components/ui';
import { TODO_ASSIGNEES, TodoAssignee, TodoItem } from '../models';
import { styles } from '../styles';

type Props = {
  todoAssignee: TodoAssignee;
  newTodoText: string;
  todos: TodoItem[];
  onChangeTodoAssignee: (value: TodoAssignee) => void;
  onChangeNewTodoText: (value: string) => void;
  onAddTodo: () => void;
  onToggleTodo: (todoId: string) => void;
};

export function TodoSection({
  todoAssignee,
  newTodoText,
  todos,
  onChangeTodoAssignee,
  onChangeNewTodoText,
  onAddTodo,
  onToggleTodo,
}: Props) {
  return (
    <SectionCard title="每日待办" subtitle="今天谁来做什么，一眼就能看到。">
      <ChoicePills options={TODO_ASSIGNEES} value={todoAssignee} onChange={onChangeTodoAssignee} />
      <View style={styles.inputRow}>
        <TextInput
          value={newTodoText}
          onChangeText={onChangeNewTodoText}
          placeholder="例如：下班前确认晚饭时间"
          placeholderTextColor="#a39483"
          style={styles.input}
          onSubmitEditing={onAddTodo}
        />
        <Pressable style={styles.primaryButton} onPress={onAddTodo}>
          <Text style={styles.primaryButtonText}>新增</Text>
        </Pressable>
      </View>
      <View style={styles.stack}>
        {todos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>这一天还没有待办</Text>
            <Text style={styles.emptyBody}>可以先记上买菜、做饭、订位或顺路带点水果。</Text>
          </View>
        ) : (
          todos
            .slice()
            .sort((left, right) => Number(left.done) - Number(right.done))
            .map((todo) => (
              <Pressable
                key={todo.id}
                onPress={() => onToggleTodo(todo.id)}
                style={[styles.todoCard, todo.done && styles.todoCardDone]}
              >
                <View style={[styles.todoCheck, todo.done && styles.todoCheckDone]}>
                  <Text style={styles.todoCheckText}>{todo.done ? '已' : '待'}</Text>
                </View>
                <View style={styles.todoTextWrap}>
                  <Text style={[styles.todoText, todo.done && styles.todoTextDone]}>{todo.text}</Text>
                  <Text style={styles.todoMeta}>负责人：{todo.assignee}</Text>
                </View>
              </Pressable>
            ))
        )}
      </View>
    </SectionCard>
  );
}
