import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Button, Field, Label, Screen } from '../../components/ui';
import { api, errorText, Exercise, Routine } from '../../lib/api';
import type { AdminStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';
import { notify } from '../../lib/notify';

// El admin arma la rutina que el socio verá en su pestaña "Rutina"
export default function RoutineEditorScreen({ route, navigation }: NativeStackScreenProps<AdminStackParams, 'RoutineEditor'>) {
  const { id, name } = route.params;
  const [title, setTitle] = useState('Rutina de hoy');
  const [items, setItems] = useState<Exercise[]>([{ name: '', detail: '', sets: '3×12' }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: `Rutina de ${name.split(' ')[0] || 'socio'}` });
    api<Routine | null>(`/api/admin/users/${id}/routine`)
      .then((data) => {
        if (data) {
          setTitle(data.title);
          if (Array.isArray(data.exercises) && data.exercises.length) setItems(data.exercises);
        }
      })
      .catch(() => {});
  }, [id, name, navigation]);

  const change = (i: number, k: keyof Exercise, v: string) => setItems(items.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const save = async () => {
    const exercises = items.filter((e) => e.name.trim()).map((e) => ({ ...e, name: e.name.trim() }));
    setBusy(true);
    try {
      await api(`/api/admin/users/${id}/routine`, { method: 'PUT', body: { title: title.trim() || 'Rutina de hoy', exercises } });
    } catch (e) {
      setBusy(false);
      return notify('No se pudo guardar', errorText(e));
    }
    setBusy(false);
    navigation.goBack();
  };

  return (
    <Screen padBottom={40}>
      <Field label="Nombre de la rutina" value={title} onChangeText={setTitle} placeholder="Pecho + Tríceps" />
      <Label>EJERCICIOS</Label>
      {items.map((e, i) => (
        <View key={i} style={st.item}>
          <View style={{ flex: 1, gap: 8 }}>
            <TextInput value={e.name} onChangeText={(v) => change(i, 'name', v)} placeholder="Ejercicio" placeholderTextColor={colors.dim} style={st.input} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={e.detail}
                onChangeText={(v) => change(i, 'detail', v)}
                placeholder="Detalle (opcional)"
                placeholderTextColor={colors.dim}
                style={[st.input, { flex: 2 }]}
              />
              <TextInput value={e.sets} onChangeText={(v) => change(i, 'sets', v)} placeholder="4×10" placeholderTextColor={colors.dim} style={[st.input, { flex: 1 }]} />
            </View>
          </View>
          <Pressable
            onPress={() => setItems(items.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel="Quitar ejercicio"
            style={st.remove}
          >
            <Icon name="close" size={18} color={colors.muted} strokeWidth={2} />
          </Pressable>
        </View>
      ))}
      <Button title="Agregar ejercicio" icon="plus" variant="outline" onPress={() => setItems([...items, { name: '', detail: '', sets: '3×12' }])} />
      <Body style={{ color: colors.dim, fontSize: 12 }}>Las series se escriben libre: 4×10, 3×40s, 5 min, etc.</Body>
      <Button title="GUARDAR RUTINA" onPress={save} loading={busy} />
      <Text style={{ height: 1 }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.text,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    backgroundColor: colors.bg,
  },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
