import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Empty, Field, Label, Screen, Title } from '../../components/ui';
import { dateLong, dayShort, time, toISODate } from '../../lib/format';
import { api, errorText, ScheduledClass } from '../../lib/api';
import { colors, fonts } from '../../theme';
import { notify, confirmAction } from '../../lib/notify';

const blank = () => ({ name: '', date: toISODate(new Date()), hour: '19:00', duration: '45', room: 'Sala 1', capacity: '20' });

export default function AdminClassesScreen() {
  const [list, setList] = useState<ScheduledClass[]>([]);
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 14);
    try {
      const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      setList(await api<ScheduledClass[]>(`/api/classes?${q}`));
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.name.trim()) return notify('Falta el nombre', 'Ej: Funcional, Spinning, Boxeo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^\d{1,2}:\d{2}$/.test(form.hour)) {
      return notify('Fecha u hora inválida', 'Usa el formato AAAA-MM-DD y HH:MM (ej: 2026-12-01 y 19:00).');
    }
    const [y, m, d] = form.date.split('-').map(Number);
    const [h, min] = form.hour.split(':').map(Number);
    const starts = new Date(y, m - 1, d, h, min);
    setBusy(true);
    try {
      await api('/api/admin/classes', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          starts_at: starts.toISOString(),
          duration_min: Number(form.duration) || 45,
          room: form.room.trim() || 'Sala 1',
          capacity: Number(form.capacity) || 20,
        },
      });
    } catch (e) {
      setBusy(false);
      return notify('No se pudo crear', errorText(e));
    }
    setBusy(false);
    setForm({ ...blank(), date: form.date });
    setOpen(false);
    load();
  };

  const remove = (c: ScheduledClass) =>
    confirmAction(
      'Eliminar clase',
      `¿Eliminar ${c.name} del ${dateLong(new Date(c.starts_at))}? Se cancelan sus reservas.`,
      async () => {
        await api(`/api/admin/classes/${c.id}`, { method: 'DELETE' }).catch(() => {});
        load();
      },
      'Eliminar',
    );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Title accent="CLASES">ADMIN </Title>
          <Body style={{ color: colors.muted, fontSize: 13 }}>Próximos 14 días</Body>
        </View>
        {!open ? <Button title="Nueva" icon="plus" small onPress={() => setOpen(true)} /> : null}
      </View>

      {open ? (
        <Card highlight>
          <Label style={{ color: colors.accent }}>NUEVA CLASE</Label>
          <Field label="Nombre" value={form.name} onChangeText={set('name')} placeholder="Funcional" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 3 }}>
              <Field label="Fecha (AAAA-MM-DD)" value={form.date} onChangeText={set('date')} />
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Hora" value={form.hour} onChangeText={set('hour')} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Minutos" value={form.duration} onChangeText={set('duration')} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cupos" value={form.capacity} onChangeText={set('capacity')} keyboardType="number-pad" />
            </View>
          </View>
          <Field label="Sala" value={form.room} onChangeText={set('room')} />
          <Button title="GUARDAR CLASE" onPress={save} loading={busy} />
          <Button title="Cancelar" variant="ghost" onPress={() => setOpen(false)} />
        </Card>
      ) : null}

      {list.length === 0 ? <Empty text="No hay clases programadas. Crea la primera con “Nueva”." /> : null}

      {list.map((c) => (
        <Pressable key={c.id} onPress={() => remove(c)} style={st.item} accessibilityRole="button" accessibilityHint="Eliminar clase">
          <View style={{ width: 62 }}>
            <Text style={st.time}>{time(c.starts_at)}</Text>
            <Text style={st.small}>
              {dayShort(new Date(c.starts_at))} {new Date(c.starts_at).getDate()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={st.name}>{c.name}</Text>
            <Text style={st.small}>
              {c.room} · {c.duration_min} min
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.count}>
              {c.booked_count}/{c.capacity}
            </Text>
            <Text style={st.small}>reservas</Text>
          </View>
        </Pressable>
      ))}
      {list.length > 0 ? (
        <Body style={{ color: colors.dim, fontSize: 12, textAlign: 'center' }}>Toca una clase para eliminarla.</Body>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  time: { fontFamily: fonts.number, fontSize: 24, color: colors.accent },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  count: { fontFamily: fonts.number, fontSize: 22, color: colors.text },
});
