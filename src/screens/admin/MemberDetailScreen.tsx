import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Field, Label, Row, Screen } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api, CheckinResult, errorText, Payment, Plan, Profile } from '../../lib/api';
import { clp, dateLong, daysUntil, statusLabel } from '../../lib/format';
import { confirmAction, notify } from '../../lib/notify';
import type { AdminStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';

export default function MemberDetailScreen({ route, navigation }: NativeStackScreenProps<AdminStackParams, 'MemberDetail'>) {
  const { id } = route.params;
  const { profile: me } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [visits, setVisits] = useState<string[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');

  const load = useCallback(async () => {
    try {
      const [res, pl] = await Promise.all([
        api<{ user: Profile; visits: string[]; payments: Payment[] }>(`/api/admin/users/${id}`),
        api<Plan[]>('/api/plans'),
      ]);
      setP(res.user);
      setVisits(res.visits);
      setPayments(res.payments ?? []);
      setPlans(pl);
    } catch (e) {
      notify('No se pudo cargar', errorText(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (key: string, changes: Record<string, unknown>) => {
    setBusy(key);
    try {
      setP(await api<Profile>(`/api/admin/users/${id}`, { method: 'PATCH', body: changes }));
      if (changes.plan_id) load();
    } catch (e) {
      notify('No se pudo guardar', errorText(e));
    }
    setBusy(null);
  };

  const manualCheckin = async () => {
    setBusy('in');
    try {
      const r = await api<CheckinResult>(`/api/admin/users/${id}/checkin`, { method: 'POST' });
      notify(r.ok ? 'Entrada registrada' : 'Acceso denegado', r.ok ? `${r.name} ya puede entrenar.` : r.reason ?? '');
      load();
    } catch (e) {
      notify('Error', errorText(e));
    }
    setBusy(null);
  };

  const resetPassword = async () => {
    if (newPass.length < 6) return notify('Clave muy corta', 'Usa al menos 6 caracteres.');
    setBusy('pass');
    try {
      await api(`/api/admin/users/${id}/password`, { method: 'POST', body: { password: newPass } });
      notify('Clave cambiada', `Entrégale la nueva clave a ${p?.full_name}.`);
      setNewPass('');
    } catch (e) {
      notify('Error', errorText(e));
    }
    setBusy(null);
  };

  if (!p) return null;
  const isSelf = p.id === me?.id;
  const isAdmin = p.role === 'admin';

  return (
    <Screen padBottom={40}>
      <View style={{ gap: 6 }}>
        <Text style={st.name}>{p.full_name || 'Sin nombre'}</Text>
        <Text style={st.small}>{p.email}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isAdmin ? <Chip text="ADMINISTRADOR" /> : null}
          <Chip
            text={statusLabel[p.status].toUpperCase()}
            tone={p.status === 'active' ? 'success' : p.status === 'pending' ? 'accent' : 'danger'}
          />
        </View>
      </View>

      {!isAdmin ? (
        <Card highlight>
          <Label style={{ color: colors.accent }}>PLAN</Label>
          <Text style={st.value}>{p.plan}</Text>
          <Body style={{ color: (daysUntil(p.plan_until) ?? 99) < 0 ? colors.danger : colors.muted }}>
            {p.plan_until
              ? `${(daysUntil(p.plan_until) ?? 0) < 0 ? 'Venció el' : 'Vigente hasta'} ${dateLong(p.plan_until)}`
              : 'Sin fecha de término'}
          </Body>
          <Label>ACTIVAR O RENOVAR (REGISTRA LA VENTA)</Label>
          {plans.length === 0 ? (
            <>
              <Body style={{ color: colors.muted, fontSize: 12 }}>
                Crea tus planes con precio en Hoy → Planes y ajustes. Mientras tanto puedes sumar meses sin registrar venta:
              </Body>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 3, 12].map((m) => (
                  <Button
                    key={m}
                    small
                    variant="outline"
                    title={`+${m} ${m === 1 ? 'mes' : 'meses'}`}
                    loading={busy === `m${m}`}
                    onPress={() => update(`m${m}`, { add_months: m })}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>
            </>
          ) : (
            plans.map((pl) => (
              <Button
                key={pl.id}
                small
                title={`${pl.name} · ${clp(pl.price_clp)} · +${pl.months} ${pl.months === 1 ? 'mes' : 'meses'}`}
                loading={busy === pl.id}
                onPress={() =>
                  confirmAction('Registrar venta', `¿${pl.name} por ${clp(pl.price_clp)} para ${p.full_name}?`, () =>
                    update(pl.id, { plan_id: pl.id }),
                  )
                }
              />
            ))
          )}
          {p.status === 'active' ? (
            <>
              <Button title="Registrar entrada" variant="outline" icon="check" loading={busy === 'in'} onPress={manualCheckin} />
              <Button
                title="Desactivar cuenta"
                variant="danger"
                loading={busy === 'off'}
                onPress={() => confirmAction('Desactivar', `${p.full_name} no podrá entrar ni reservar.`, () => update('off', { status: 'inactive' }))}
              />
            </>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <Row first title="Teléfono" subtitle={p.phone ?? 'No registrado'} />
        <Row title="Cuenta creada" subtitle={dateLong(p.created_at)} />
        {!isAdmin ? (
          <Row
            title="Asignar rutina"
            subtitle="Ejercicios que verá en su pestaña Rutina"
            onPress={() => navigation.navigate('RoutineEditor', { id: p.id, name: p.full_name })}
          />
        ) : null}
      </Card>

      {!isAdmin ? (
        <Card>
          <Label>ÚLTIMAS VISITAS</Label>
          {visits.length === 0 ? (
            <Body style={{ color: colors.muted }}>Todavía no registra entradas.</Body>
          ) : (
            visits.map((v) => (
              <Body key={v}>
                {dateLong(new Date(v))} · {new Date(v).toTimeString().slice(0, 5)}
              </Body>
            ))
          )}
        </Card>
      ) : null}

      {!isAdmin && payments.length > 0 ? (
        <Card>
          <Label>PAGOS REGISTRADOS</Label>
          {payments.map((x) => (
            <Body key={x.created_at}>
              {dateLong(new Date(x.created_at))} · {x.plan_name} · {clp(x.amount_clp)}
            </Body>
          ))}
        </Card>
      ) : null}

      {!isSelf ? (
        <Card>
          <Label>¿OLVIDÓ SU CLAVE?</Label>
          <Field label="Nueva clave (mínimo 6)" value={newPass} onChangeText={setNewPass} autoCapitalize="none" />
          <Button title="Cambiar clave" variant="outline" loading={busy === 'pass'} onPress={resetPassword} />
        </Card>
      ) : null}

      {!isSelf ? (
        <Button
          title={isAdmin ? 'Quitar permisos de administrador' : 'Convertir en administrador'}
          variant="outline"
          loading={busy === 'role'}
          onPress={() =>
            confirmAction(
              isAdmin ? 'Quitar admin' : 'Nuevo administrador',
              isAdmin ? `${p.full_name} volverá a ser socio.` : `${p.full_name} podrá activar socios, escanear y crear clases.`,
              () => update('role', { role: isAdmin ? 'member' : 'admin' }),
            )
          }
        />
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  name: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  value: { fontFamily: fonts.stencil, fontSize: 26, color: colors.text },
});
