import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Icon, IconName } from './Icon';

// Barra inferior con el botón central elevado (estilo GymKartel)
export function makeTabBar(config: Record<string, { label: string; icon: IconName; center?: boolean }>) {
  return function GymTabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    return (
      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {state.routes.map((route, index) => {
          const cfg = config[route.name];
          const focused = state.index === index;
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
          };
          if (cfg.center) {
            return (
              <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityLabel={cfg.label} style={st.centerWrap}>
                <View style={[st.center, focused && { borderWidth: 2, borderColor: colors.text }]}>
                  <Icon name={cfg.icon} size={28} color={colors.onAccent} strokeWidth={2} />
                </View>
              </Pressable>
            );
          }
          const c = focused ? colors.accent : colors.dim;
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: focused }} style={st.tab}>
              <Icon name={cfg.icon} size={24} color={c} />
              <Text style={[st.label, { color: c, fontFamily: focused ? fonts.semibold : fonts.medium }]}>{cfg.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.accentSoft,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tab: { width: 64, minHeight: 44, alignItems: 'center', gap: 4 },
  label: { fontSize: 11 },
  centerWrap: { width: 64, alignItems: 'center' },
  center: {
    width: 64,
    height: 64,
    marginTop: -34,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
