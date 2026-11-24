import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Empty, Field, Label, Screen } from '../../components/ui';
import { api, errorText, Occupancy, Plan } from '../../lib/api';
import { clp } from '../../lib/format';
import { notify } from '../../lib/notify';
import { colors, fonts } from '../../theme';

type Form = { id?: string; name: string; price: string; months: string };
const empty: Form = { name: '', price: '', months: '1' };

// El admin define sus planes con precio en pesos y el aforo máximo del gym
export default function PlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([api<Plan[]>('/api/admin/plans'), api<Occupancy>('/api/occupancy')]);
      setPlans(p);
      setCapacity(o.capacity ? String(o.capacity) : '');
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    const price = Number(form.price.replace(/\D/g, ''));
    const months = Number(form.months);
    if (!form.name.trim()) return notify('Falta el nombre', 'Ej: Mensual, Trimestral, Estudiante.');
    if (!form.price || !Number.isFinite(price)) return notify('Falta el precio', 'Escribe el precio en pesos, sin puntos.');
    if (!Number.isInteger(months) || months < 1 || months > 36) return notify('Duración no válida', 'Entre 1 y 36 meses.');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), price_clp: price, months };
      if (form.id) await api(`/api/admin/plans/${form.id}`, { method: 'PATCH', body });
      else await api('/api/admin/plans', { method: 'POST', body });
      setForm(null);
      load();
    } catch (e) {
      notify('No se pudo guardar', errorText(e));
    }
    setBusy(false);
  };

  const toggle = async (p: Plan) => {
    await api(`/api/admin/plans/${p.id}`, { method: 'PATCH', body: { active: !p.active } }).catch(() => {});
    load();
  };

  const saveCapacity = async () => {
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { capacity: capacity ? Number(capacity) : null } });
      notify('Aforo guardado', capacity ? `Máximo ${capacity} personas.` : 'Sin aforo máximo.');
    } catch (e) {
      notify('No se pudo guardar', errorText(e));
    }
  };

  return (
    <Screen padBottom={40}>
      <Label style={{ color: colors.accent }}>PLANES Y PRECIOS</Label>
      <Body style={{ color: colors.muted, fontSize: 13 }}>
        Al activar o renovar a un socio eliges uno de estos planes. Se suma su duración y queda registrada la venta.
      </Body>

      {plans.length === 0 && !form ? <Empty text="Todavía no hay planes. Crea el primero." /> : null}

      {plans.map((p) => (
        <View key={p.id} style={[st.item, !p.active && { opacity: 0.5 }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={st.name}>{p.name}</Text>
            <Text style={st.small}>
              {p.months} {p.months === 1 ? 'mes' : 'meses'}
              {p.active ? '' : ' · oculto'}
            </Text>
          </View>
          <Text style={st.price}>{clp(p.price_clp)}</Text>
          <View style={{ gap: 6 }}>
            <Pressable
              style={st.small_btn}
              accessibilityRole="button"
              onPress={() => setForm({ id: p.id, name: p.name, price: String(p.price_clp), months: String(p.months) })}
            >
              <Text style={st.smallBtnText}>Editar</Text>
            </Pressable>
            <Pressable style={st.small_btn} accessibilityRole="button" onPress={() => toggle(p)}>
              <Text style={st.smallBtnText}>{p.active ? 'Ocultar' : 'Mostrar'}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {form ? (
        <Card highlight>
          <Chip text={form.id ? 'EDITAR PLAN' : 'NUEVO PLAN'} />
          <Field label="Nombre" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Mensual" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 3 }}>
              <Field
                label="Precio en pesos"
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v })}
                keyboardType="number-pad"
                placeholder="Ej: 25000"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Field label="Meses" value={form.months} onChangeText={(v) => setForm({ ...form, months: v })} keyboardType="number-pad" />
            </View>
          </View>
          <Button title="GUARDAR PLAN" onPress={save} loading={busy} />
          <Button title="Cancelar" variant="ghost" onPress={() => setForm(null)} />
        </Card>
      ) : (
        <Button title="Nuevo plan" icon="plus" variant="outline" onPress={() => setForm({ ...empty })} />
      )}

      <Label style={{ color: colors.accent, marginTop: 12 }}>AFORO MÁXIMO</Label>
      <Card>
        <Body style={{ color: colors.muted, fontSize: 13 }}>
          Cuántas personas caben a la vez. Se usa para mostrar "Tranquilo / Moderado / Lleno". Déjalo vacío para no mostrarlo.
        </Body>
        <Field label="Personas" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="Ej: 60" />
        <Button title="Guardar aforo" variant="outline" onPress={saveCapacity} />
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
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
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  price: { fontFamily: fonts.number, fontSize: 22, color: colors.accent },
  small_btn: { minHeight: 36, minWidth: 72, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
});
