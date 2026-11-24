import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../theme';
import { Icon, IconName } from './Icon';

// ---------- Pantalla con scroll ----------
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  padBottom = 120,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  padBottom?: number;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: padBottom, gap: 16 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Textos ----------
export function Title({ children, accent, style }: { children: React.ReactNode; accent?: string; style?: TextStyle }) {
  return (
    <Text style={[s.title, style]}>
      {children}
      {accent ? <Text style={{ color: colors.accent }}>{accent}</Text> : null}
    </Text>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}

export function Big({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.big, style]}>{children}</Text>;
}

// ---------- Tarjeta ----------
export function Card({ children, style, highlight }: { children: React.ReactNode; style?: ViewStyle; highlight?: boolean }) {
  return <View style={[s.card, highlight && { borderColor: colors.accentSoft }, style]}>{children}</View>;
}

// ---------- Botón ----------
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
}) {
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && { height: 44, paddingHorizontal: 14 },
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.borderStrong },
        variant === 'danger' && { borderWidth: 1.5, borderColor: colors.danger },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} strokeWidth={2} /> : null}
          <Text style={[s.btnText, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------- Campo de texto ----------
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.dim} style={s.input} {...props} />
    </View>
  );
}

// ---------- Etiqueta (chip) ----------
export function Chip({ text, tone = 'accent' }: { text: string; tone?: 'accent' | 'muted' | 'danger' | 'success' }) {
  const c =
    tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.muted;
  return (
    <View style={[s.chip, { borderColor: c }]}>
      <Text style={[s.chipText, { color: c }]}>{text}</Text>
    </View>
  );
}

// ---------- Fila de menú ----------
export function Row({
  title,
  subtitle,
  right,
  onPress,
  first,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.row, !first && s.rowBorder, pressed && { backgroundColor: '#1C1C1C' }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.small}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={18} color={colors.muted} strokeWidth={2} /> : null)}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Body style={{ color: colors.muted, textAlign: 'center' }}>{text}</Body>
    </Card>
  );
}

export const s = StyleSheet.create({
  title: { fontFamily: fonts.stencil, fontSize: 26, color: colors.text, letterSpacing: 0.5 },
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.5, color: colors.muted },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  big: { fontFamily: fonts.number, fontSize: 36, color: colors.text, lineHeight: 40 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
    gap: 12,
  },
  btn: {
    height: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 0.3 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },
  row: { minHeight: 56, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});
