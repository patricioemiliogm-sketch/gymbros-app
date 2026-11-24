import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Big, Card, Label, Screen } from '../../components/ui';
import { api, Lift } from '../../lib/api';
import { dateLong, kg } from '../../lib/format';
import { confirmAction } from '../../lib/notify';
import type { MemberStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';

// Historial de un ejercicio con gráfico de barras (peso por sesión)
export default function ExerciseScreen({ route, navigation }: NativeStackScreenProps<MemberStackParams, 'Ejercicio'>) {
  const { exercise } = route.params;
  const [items, setItems] = useState<Lift[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await api<Lift[]>(`/api/me/lifts?exercise=${encodeURIComponent(exercise)}`));
    } catch {}
  }, [exercise]);

  useEffect(() => {
    navigation.setOptions({ title: exercise });
    load();
  }, [exercise, load, navigation]);

  const best = items.reduce((m, x) => Math.max(m, x.weight_kg), 0);
  // Mejor peso de cada día, los últimos 12 días entrenados (más antiguo a la izquierda)
  const byDay = new Map<string, number>();
  [...items].reverse().forEach((x) => {
    const d = x.created_at.slice(0, 10);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, x.weight_kg));
  });
  const bars = Array.from(byDay.entries()).slice(-12);
  const first = bars[0]?.[1] ?? 0;
  const last = bars[bars.length - 1]?.[1] ?? 0;
  const diff = last - first;

  return (
    <Screen padBottom={40}>
      <Card highlight>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Label style={{ color: colors.accent }}>RÉCORD</Label>
            <Big>{kg(best)}</Big>
          </View>
          {bars.length > 1 ? (
            <Text style={[st.small, { color: diff >= 0 ? colors.success : colors.danger }]}>
              {diff >= 0 ? '+' : ''}
              {kg(diff)} desde que empezaste
            </Text>
          ) : null}
        </View>
        {bars.length > 0 ? (
          <View style={st.chart} accessible accessibilityLabel={`Gráfico de progreso, récord ${kg(best)}`}>
            {bars.map(([d, w]) => (
              <View key={d} style={st.barCol}>
                <Text style={st.barValue}>{Math.round(w)}</Text>
                <View style={[st.bar, { height: `${Math.max(6, (w / (best || 1)) * 100)}%` }, w === best && { backgroundColor: colors.accent }]} />
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Label>TODAS LAS SERIES</Label>
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        {items.map((x, i) => (
          <View key={x.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.rowTitle}>
                {kg(x.weight_kg)} × {x.reps}
                {x.weight_kg === best ? <Text style={{ color: colors.accent }}> · récord</Text> : null}
              </Text>
              <Text style={st.small}>
                {dateLong(new Date(x.created_at))} · {new Date(x.created_at).toTimeString().slice(0, 5)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Borrar serie"
              style={st.del}
              onPress={() =>
                confirmAction('Borrar serie', `¿Borrar ${kg(x.weight_kg)} × ${x.reps}?`, async () => {
                  await api(`/api/me/lifts/${x.id}`, { method: 'DELETE' }).catch(() => {});
                  load();
                }, 'Borrar')
              }
            >
              <Icon name="close" size={16} color={colors.muted} strokeWidth={2} />
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  barValue: { fontFamily: fonts.number, fontSize: 12, color: colors.muted },
  bar: { width: '100%', borderRadius: 6, backgroundColor: colors.borderStrong, maxHeight: '85%' },
  row: { minHeight: 56, paddingLeft: 18, paddingRight: 6, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  del: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
