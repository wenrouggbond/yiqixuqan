import { Animated, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { describeSlicePath, MenuItem, polarToCartesian, WHEEL_COLORS } from '../models';
import { styles } from '../styles';

const WHEEL_LABEL_MAX_LENGTH = 8;

function getWheelLabel(name: string) {
  return name.length > WHEEL_LABEL_MAX_LENGTH ? `${name.slice(0, WHEEL_LABEL_MAX_LENGTH)}…` : name;
}

export function Wheel({
  items,
  spinValue,
}: {
  items: MenuItem[];
  spinValue: Animated.Value;
}) {
  const size = 240;
  const center = size / 2;
  const radius = 104;
  const segmentAngle = items.length > 0 ? 360 / items.length : 360;

  if (items.length === 0) {
    return (
      <View style={styles.wheelEmpty}>
        <Text style={styles.emptyTitle}>菜单还是空的</Text>
        <Text style={styles.emptyBody}>先加几道菜，转盘才有得转。</Text>
      </View>
    );
  }

  return (
    <View style={styles.wheelWrap}>
      <View style={styles.pointer} />
      <Animated.View
        style={[
          styles.wheelAnimated,
          {
            transform: [
              {
                rotate: spinValue.interpolate({
                  inputRange: [-10000, 10000],
                  outputRange: ['-10000deg', '10000deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Svg width={size} height={size}>
          {items.map((item, index) => {
            const startAngle = index * segmentAngle - segmentAngle / 2;
            const endAngle = startAngle + segmentAngle;
            const labelPoint = polarToCartesian(center, radius * 0.66, index * segmentAngle);

            return (
              <Path
                key={item.id}
                d={describeSlicePath(center, radius, startAngle, endAngle)}
                fill={WHEEL_COLORS[index % WHEEL_COLORS.length]}
                stroke="#fff7eb"
                strokeWidth={2}
              />
            );
          })}

          {items.map((item, index) => {
            const labelPoint = polarToCartesian(center, radius * 0.66, index * segmentAngle);

            return (
              <SvgText
                key={`${item.id}-label`}
                x={labelPoint.x}
                y={labelPoint.y}
                fill="#fffdf8"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {getWheelLabel(item.name)}
              </SvgText>
            );
          })}

          <Circle cx={center} cy={center} r={38} fill="#fff7eb" />
          <Circle cx={center} cy={center} r={31} fill="#1f4438" />
          <SvgText x={center} y={center - 7} fill="#fff7eb" fontSize="11" fontWeight="700" textAnchor="middle">
            今晚
          </SvgText>
          <SvgText x={center} y={center + 11} fill="#fff7eb" fontSize="13" fontWeight="700" textAnchor="middle">
            吃什么
          </SvgText>
        </Svg>
      </Animated.View>
    </View>
  );
}
