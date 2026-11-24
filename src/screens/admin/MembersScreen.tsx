import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Button, Chip, Empty, Screen, Title } from '../../components/ui';
import { daysUntil, initials, statusLabel } from '../../lib/format';
import { api, Profile, Status } from '../../lib/api';
import type { AdminStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';

type Filter = 'all' | Status | 'admin' | 'expiring';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'expiring', label: 'Por vencer' },
  { key: 'active', label: 'Activos' },
  { key: 'inactive', label: 'Inactivos' },
  { key: 'admin', label: 'Admins' },
  { key: 'all', label: 'Todos' },
];

// Socio activo cuyo plan vence en 7 días o menos (o ya venció)
const isExpiring = (p: Profile) => {
  const d = daysUntil(p.plan_until);
  return p.role === 'member' && p.status === 'active' && d !== null && d <= 7;
};

export default function MembersScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AdminStackParams>>();
  const [people, setPeople] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPeople(await api<Profile[]>('/api/admin/users'));
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: people.length, admin: 0, pending: 0, active: 0, inactive: 0, expiring: 0 };
    people.forEach((p) => {
      if (p.role === 'admin') c.admin++;
      else c[p.status]++;
      if (isExpiring(p)) c.expiring++;
    });
    return c;
  }, [people]);

  const shown = people.filter((p) => {
    if (filter === 'admin' && p.role !== 'admin') return false;
    if (filter === 'expiring' && !isExpiring(p)) return false;
    if (['pending', 'active', 'inactive'].includes(filter) && (p.role === 'admin' || p.status !== filter)) return false;
    const t = q.trim().toLowerCase();
    return !t || p.full_name.toLowerCase().includes(t) || (p.email ?? '').toLowerCase().includes(t);
  });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Title accent="IOS">SOC</Title>
          <Body style={{ color: colors.muted, fontSize: 13 }}>Panel de administración</Body>
        </View>
        <Button title="Nuevo" icon="plus" small onPress={() => nav.navigate('CreateMember')} />
      </View>

      <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre o correo" placeholderTextColor={colors.dim} style={st.search} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[st.filter, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            >
              <Text style={[st.filterText, { color: on ? colors.onAccent : colors.text }]}>
                {f.label} · {counts[f.key] ?? 0}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {shown.length === 0 ? <Empty text="No hay cuentas en esta lista." /> : null}

      {shown.map((p) => (
        <Pressable key={p.id} onPress={() => nav.navigate('MemberDetail', { id: p.id })} accessibilityRole="button" style={st.item}>
          <View style={st.avatar}>
            <Text style={st.avatarText}>{initials(p.full_name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.name}>{p.full_name || 'Sin nombre'}</Text>
            <Text style={st.small} numberOfLines={1}>
              {p.email}
            </Text>
          </View>
          {p.role === 'admin' ? (
            <Chip text="ADMIN" />
          ) : (
            <Chip
              text={statusLabel[p.status].toUpperCase()}
              tone={p.status === 'active' ? 'success' : p.status === 'pending' ? 'accent' : 'danger'}
            />
          )}
          <Icon name="chevron" size={18} color={colors.muted} strokeWidth={2} />
        </Pressable>
      ))}
    </Screen>
  );
}

const st = StyleSheet.create({
  search: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  filter: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  filterText: { fontFamily: fonts.semibold, fontSize: 12 },
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.stencil, fontSize: 16, color: colors.text },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
