import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Big, Body, Button, Card, Label, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api, Exercise, Routine } from '../../lib/api';
import { colors, fonts } from '../../theme';
import { notify } from '../../lib/notify';

// Rutina de ejemplo mientras el admin no asigna una
const DEFAULT: { title: string; exercises: Exercise[] } = {
  title: 'Cuerpo completo',
  exercises: [
    { name: 'Sentadilla', detail: 'Barra · descanso 90 s', sets: '4×10' },
    { name: 'Press banca', detail: 'Barra · descanso 90 s', sets: '4×10' },
    { name: 'Remo con mancuerna', detail: 'Descanso 60 s', sets: '3×12' },
    { name: 'Press militar', detail: 'Mancuernas · descanso 60 s', sets: '3×10' },
    { name: 'Plancha', detail: 'Abdomen', sets: '3×40s' },
  ],
};

export default function RoutineScreen() {
  const { profile } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const [routine, setRoutine] = useState(DEFAULT);
  const [assigned, setAssigned] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      api<Routine | null>('/api/me/routine')
        .then((data) => {
          if (data && Array.isArray(data.exercises) && data.exercises.length > 0) {
            setRoutine(data);
            setAssigned(true);
          }
        })
        .catch(() => {});
    }, [profile]),
  );

  const total = routine.exercises.length;
  const count = routine.exercises.filter((_, i) => done[i]).length;
  const pct = total ? (count / total) * 100 : 0;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Label style={{ color: colors.accent }}>{assigned ? 'TU RUTINA' : 'RUTINA DE EJEMPLO'}</Label>
        <Title>{routine.title.toUpperCase()}</Title>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Body style={{ color: colors.muted, fontSize: 12 }}>Progreso</Body>
            <Big>
              {count} / {total}
            </Big>
          </View>
          <Body style={{ color: colors.muted, fontSize: 12 }}>ejercicios</Body>
        </View>
        <View style={st.track}>
          <View style={[st.fill, { width: `${pct}%` }]} />
        </View>
      </Card>

      {routine.exercises.map((e, i) => {
        const on = !!done[i];
        return (
          <Pressable
            key={i}
            onPress={() => setDone({ ...done, [i]: !on })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={st.item}
          >
            <View style={[st.box, on ? { backgroundColor: colors.accent, borderColor: colors.accent } : null]}>
              {on ? <Icon name="check" size={16} color={colors.onAccent} strokeWidth={2.8} /> : null}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[st.name, on && { color: colors.muted, textDecorationLine: 'line-through' }]}>{e.name}</Text>
              {e.detail ? <Text style={st.small}>{e.detail}</Text> : null}
            </View>
            <Text style={st.sets}>{e.sets}</Text>
          </Pressable>
        );
      })}

      {!assigned ? (
        <Body style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
          Pide en recepción que te asignen tu rutina personalizada.
        </Body>
      ) : null}

      <Button title="Anotar mis pesos" icon="chart" variant="outline" onPress={() => navigation.navigate('Progreso')} />
      <Button
        title="TERMINAR ENTRENAMIENTO"
        disabled={count === 0}
        onPress={() => {
          notify('¡Buen trabajo, bro!', `Completaste ${count} de ${total} ejercicios.`);
          setDone({});
        }}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  sets: { fontFamily: fonts.number, fontSize: 20, color: colors.accent },
});
