import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Empty, Screen, Title } from '../../components/ui';
import { addDays, dayShort, startOfDay, time } from '../../lib/format';
import { api, errorText, ScheduledClass } from '../../lib/api';
import { colors, fonts } from '../../theme';
import { notify } from '../../lib/notify';

export default function ClassesScreen() {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i)), []);
  const [selected, setSelected] = useState(0);
  const [list, setList] = useState<ScheduledClass[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const from = days[selected];
    try {
      const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(addDays(from, 1).toISOString())}`;
      setList(await api<ScheduledClass[]>(`/api/classes?${q}`));
    } catch {}
  }, [days, selected]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggle = async (c: ScheduledClass) => {
    setBusyId(c.id);
    try {
      await api(`/api/classes/${c.id}/book`, { method: c.is_booked ? 'DELETE' : 'POST' });
    } catch (e) {
      notify('No se pudo reservar', errorText(e));
    }
    setBusyId(null);
    load();
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ gap: 4 }}>
        <Title accent="BROS">CLASES </Title>
        <Body style={{ color: colors.muted, fontSize: 13 }}>Reserva tu cupo y entrena en equipo.</Body>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {days.map((d, i) => {
          const on = i === selected;
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[st.day, on ? { backgroundColor: colors.accent, borderColor: colors.accent } : null]}
            >
              <Text style={[st.dayLabel, { color: on ? colors.onAccent : colors.muted }]}>{i === 0 ? 'HOY' : dayShort(d)}</Text>
              <Text style={[st.dayNum, { color: on ? colors.onAccent : colors.text }]}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>

      {list.length === 0 ? <Empty text="No hay clases este día." /> : null}

      {list.map((c) => {
        const full = c.booked_count >= c.capacity && !c.is_booked;
        const past = new Date(c.starts_at) < new Date();
        return (
          <View key={c.id} style={st.item}>
            <View style={{ width: 58 }}>
              <Text style={st.time}>{time(c.starts_at)}</Text>
              <Text style={st.small}>{c.duration_min} min</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={st.name}>{c.name}</Text>
              <Text style={st.small}>
                {c.room} · {c.booked_count}/{c.capacity} cupos
              </Text>
            </View>
            <Pressable
              disabled={busyId === c.id || past || full}
              onPress={() => toggle(c)}
              accessibilityRole="button"
              style={[
                st.btn,
                c.is_booked ? { backgroundColor: colors.accent, borderColor: colors.accent } : null,
                (past || full) && { opacity: 0.45 },
              ]}
            >
              {c.is_booked ? <Icon name="check" size={16} color={colors.onAccent} strokeWidth={2.6} /> : null}
              <Text style={[st.btnText, { color: c.is_booked ? colors.onAccent : colors.text }]}>
                {c.is_booked ? 'Reservada' : full ? 'Lleno' : past ? 'Pasó' : 'Reservar'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </Screen>
  );
}

const st = StyleSheet.create({
  day: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayLabel: { fontFamily: fonts.medium, fontSize: 10 },
  dayNum: { fontFamily: fonts.number, fontSize: 22 },
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  time: { fontFamily: fonts.number, fontSize: 24, color: colors.accent },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  btn: {
    height: 44,
    minWidth: 100,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 13 },
});
