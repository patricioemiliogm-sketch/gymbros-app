import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Empty, Label, Screen, Title } from '../../components/ui';
import { api, errorText, LiftSummary, Routine } from '../../lib/api';
import { dateLong, kg } from '../../lib/format';
import { notify } from '../../lib/notify';
import { colors, fonts } from '../../theme';

const COMMON = ['Press banca', 'Sentadilla', 'Peso muerto', 'Press militar', 'Remo con barra', 'Dominadas'];

// Registro de pesos: anotas cada serie y la app guarda tus récords
export default function ProgressScreen() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const [list, setList] = useState<LiftSummary[]>([]);
  const [suggest, setSuggest] = useState<string[]>(COMMON);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summary, routine] = await Promise.all([api<LiftSummary[]>('/api/me/lifts'), api<Routine | null>('/api/me/routine')]);
      setList(summary);
      const names = [...summary.map((x) => x.exercise), ...(routine?.exercises.map((e) => e.name) ?? []), ...COMMON];
      setSuggest(Array.from(new Map(names.map((n) => [n.toLowerCase(), n])).values()).slice(0, 10));
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    const w = Number(weight.replace(',', '.'));
    const r = Number(reps);
    if (!exercise.trim()) return notify('Falta el ejercicio', 'Escríbelo o elige uno de la lista.');
    if (!Number.isFinite(w) || w < 0 || !weight) return notify('Falta el peso', 'Escribe los kilos (usa 0 si es peso corporal).');
    if (!Number.isInteger(r) || r < 1) return notify('Faltan las repeticiones', 'Escribe cuántas repeticiones hiciste.');
    setBusy(true);
    try {
      const res = await api<{ is_pr: boolean; first: boolean }>('/api/me/lifts', {
        method: 'POST',
        body: { exercise: exercise.trim(), weight_kg: w, reps: r },
      });
      if (res.is_pr) notify('¡NUEVO RÉCORD! 🔥', `${exercise.trim()}: ${kg(w)} × ${r}. Sigue así, bro.`);
      setWeight('');
      setReps('');
      load();
    } catch (e) {
      notify('No se pudo guardar', errorText(e));
    }
    setBusy(false);
  };

  return (
    <Screen padBottom={40}>
      <View style={{ gap: 4 }}>
        <Title accent="PROGRESO">MI </Title>
        <Body style={{ color: colors.muted, fontSize: 13 }}>Anota cada serie y mira cómo suben tus pesos.</Body>
      </View>

      <Card highlight>
        <Label style={{ color: colors.accent }}>ANOTAR SERIE</Label>
        <TextInput
          value={exercise}
          onChangeText={setExercise}
          placeholder="Ejercicio"
          placeholderTextColor={colors.dim}
          style={st.input}
          accessibilityLabel="Ejercicio"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {suggest.map((n) => (
            <Pressable
              key={n}
              onPress={() => setExercise(n)}
              accessibilityRole="button"
              style={[st.chip, exercise.toLowerCase() === n.toLowerCase() && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            >
              <Text style={[st.chipText, exercise.toLowerCase() === n.toLowerCase() && { color: colors.onAccent }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={st.fieldLabel}>Peso (kg)</Text>
            <TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="60" placeholderTextColor={colors.dim} style={st.input} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={st.fieldLabel}>Repeticiones</Text>
            <TextInput value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.dim} style={st.input} />
          </View>
        </View>
        <Button title="GUARDAR SERIE" icon="plus" onPress={save} loading={busy} />
      </Card>

      <Label>MIS RÉCORDS</Label>
      {list.length === 0 ? <Empty text="Todavía no anotas pesos. Guarda tu primera serie arriba." /> : null}
      {list.map((x) => (
        <Pressable
          key={x.exercise}
          onPress={() => navigation.navigate('Ejercicio', { exercise: x.exercise })}
          accessibilityRole="button"
          style={st.item}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={st.name}>{x.exercise}</Text>
            <Text style={st.small}>
              Última: {kg(x.last_kg)} × {x.last_reps} · {dateLong(new Date(x.last_at))}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.best}>{kg(x.best_kg)}</Text>
            <Text style={st.small}>récord</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.muted} strokeWidth={2} />
        </Pressable>
      ))}
    </Screen>
  );
}

const st = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  best: { fontFamily: fonts.number, fontSize: 24, color: colors.accent },
});
