import { Pressable, Text, TextInput, View } from 'react-native';

import { SectionCard } from '../components/ui';
import { MenuItem, OrderItem, Person, getShortTime } from '../models';
import { styles } from '../styles';

type Props = {
  currentUser: Person;
  menu: MenuItem[];
  orders: OrderItem[];
  orderCounts: Record<string, number>;
  newMenuName: string;
  newMenuCategory: string;
  newMenuDescription: string;
  newMenuTags: string;
  newMenuHeat: string;
  onChangeNewMenuName: (value: string) => void;
  onChangeNewMenuCategory: (value: string) => void;
  onChangeNewMenuDescription: (value: string) => void;
  onChangeNewMenuTags: (value: string) => void;
  onChangeNewMenuHeat: (value: string) => void;
  onAddMenuItem: () => void;
  onAddOrder: (menuItemId: string) => void;
};

export function MenuSection({
  currentUser,
  menu,
  orders,
  orderCounts,
  newMenuName,
  newMenuCategory,
  newMenuDescription,
  newMenuTags,
  newMenuHeat,
  onChangeNewMenuName,
  onChangeNewMenuCategory,
  onChangeNewMenuDescription,
  onChangeNewMenuTags,
  onChangeNewMenuHeat,
  onAddMenuItem,
  onAddOrder,
}: Props) {
  return (
    <SectionCard title="菜单与选择记录" subtitle="先整理常吃菜单，决定后再记下这次选择。">
      <View style={styles.inputGroup}>
        <TextInput
          value={newMenuName}
          onChangeText={onChangeNewMenuName}
          placeholder="新增一道菜名"
          placeholderTextColor="#a39483"
          style={styles.input}
          maxLength={20}
        />
        <TextInput
          value={newMenuCategory}
          onChangeText={onChangeNewMenuCategory}
          placeholder="分类，例如：面食 / 轻食"
          placeholderTextColor="#a39483"
          style={styles.input}
        />
        <TextInput
          value={newMenuDescription}
          onChangeText={onChangeNewMenuDescription}
          placeholder="描述，例如：酸辣开胃，适合配米饭"
          placeholderTextColor="#a39483"
          style={[styles.input, styles.textarea]}
          multiline
        />
        <TextInput
          value={newMenuTags}
          onChangeText={onChangeNewMenuTags}
          placeholder="标签，用逗号分隔，例如：下饭, 快手"
          placeholderTextColor="#a39483"
          style={styles.input}
        />
        <TextInput
          value={newMenuHeat}
          onChangeText={onChangeNewMenuHeat}
          placeholder="出品形式，例如：热菜 / 冷盘 / 锅物"
          placeholderTextColor="#a39483"
          style={styles.input}
        />
        <Pressable style={styles.secondaryButtonWide} onPress={onAddMenuItem}>
          <Text style={styles.secondaryButtonText}>加入菜单</Text>
        </Pressable>
      </View>
      <View style={styles.stack}>
        {menu.map((item) => (
          <View key={item.id} style={styles.menuCard}>
            <View style={styles.menuCardTop}>
              <View style={styles.menuTitleWrap}>
                <Text style={styles.menuTitle}>{item.name}</Text>
                <Text style={styles.menuCategory}>
                  {item.category} · {item.heat}
                </Text>
              </View>
              {orderCounts[item.id] ? (
                <View style={styles.orderCountBadge}>
                  <Text style={styles.orderCountText}>今日 {orderCounts[item.id]} 份</Text>
                </View>
              ) : null}
            </View>
            {item.description ? <Text style={styles.menuDescription}>{item.description}</Text> : null}
            {item.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {item.tags.map((tag) => (
                  <View key={`${item.id}-${tag}`} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={() => onAddOrder(item.id)}>
              <Text style={styles.secondaryButtonText}>以“{currentUser}”身份记下这道</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.stack}>
        <Text style={styles.inlineTitle}>今日用餐记录</Text>
        {orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>今天还没有记录选择</Text>
            <Text style={styles.emptyBody}>可以从上面的菜单记下选择，也可以让转盘先帮你们决定。</Text>
          </View>
        ) : (
          orders.map((order) => {
            const orderedItem = menu.find((menuItem) => menuItem.id === order.menuItemId);
            return (
              <View key={order.id} style={styles.orderCard}>
                <View>
                  <Text style={styles.orderTitle}>{orderedItem?.name ?? '未知菜品'}</Text>
                  <Text style={styles.orderMeta}>
                    {order.orderedBy} 记录 · {getShortTime(order.createdAt)}
                  </Text>
                </View>
                <Text style={styles.orderCategory}>{orderedItem?.category ?? '自定义'}</Text>
              </View>
            );
          })
        )}
      </View>
    </SectionCard>
  );
}
