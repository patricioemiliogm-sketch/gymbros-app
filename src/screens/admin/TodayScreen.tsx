import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Body, Card, Chip, Label, Row, Screen, Title } from '../../components/ui';
import { api, Today, tz } from '../../lib/api';
import { clp, daysUntil, occupancyLevel, time } from '../../lib/format';
import type { AdminStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';

// Panel del administrador: cómo va el gym hoy
export default function TodayScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AdminStackParams>>();
  const [d, setD] = useState<Today | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await api<Today>(`/api/admin/today?tz=${tz()}`));
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 30000);
      return () => clearInterval(t);
    }, [load]),
  );

  const level = d ? occupancyLevel(d.in_gym_now, d.capacity) : null;
  const tiles = d
    ? [
        { n: String(d.checkins_today), l: 'Entradas hoy' },
        { n: String(d.active_members), l: 'Socios activos' },
        { n: String(d.new_this_month), l: 'Nuevos este mes' },
      ]
    : [];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ gap: 2 }}>
        <Title accent="HOY">GYM BROS </Title>
        <Body style={{ color: colors.muted, fontSize: 13 }}>Se actualiza solo cada 30 segundos.</Body>
      </View>

      {d && level ? (
        <>
          <Card highlight>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Label style={{ color: colors.accent }}>EN EL GYM AHORA</Label>
                <Text style={st.huge}>
                  {d.in_gym_now}
                  {d.capacity ? <Text style={st.cap}> / {d.capacity}</Text> : null}
                </Text>
              </View>
              <Chip text={level.label.toUpperCase()} tone={level.label === 'Lleno' ? 'danger' : 'accent'} />
            </View>
            {level.pct !== null ? (
              <View style={st.track}>
                <View style={[st.fill, { width: `${Math.max(level.pct, 3)}%` }]} />
              </View>
            ) : (
              <Body style={{ color: colors.muted, fontSize: 12 }}>Define el aforo máximo en Planes y ajustes para ver el porcentaje.</Body>
            )}
          </Card>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {tiles.map((t) => (
              <View key={t.l} style={st.tile}>
                <Text style={st.tileNum}>{t.n}</Text>
                <Text style={st.small}>{t.l}</Text>
              </View>
            ))}
          </View>

          <Card>
            <Label>VENTAS DEL MES</Label>
            <Text style={st.money}>{clp(d.sales_month_clp)}</Text>
            <Body style={{ color: colors.muted, fontSize: 12 }}>
              {d.sales_month_count} {d.sales_month_count === 1 ? 'plan vendido' : 'planes vendidos'} registrados en la app
            </Body>
          </Card>

          {d.pending > 0 ? (
            <Pressable onPress={() => nav.navigate('AdminTabs', { screen: 'Socios' })} accessibilityRole="button" style={st.alert}>
              <Icon name="users" size={22} color={colors.accent} />
              <Text style={[st.alertText, { flex: 1 }]}>
                {d.pending} {d.pending === 1 ? 'cuenta espera' : 'cuentas esperan'} activación (pestaña Socios)
              </Text>
            </Pressable>
          ) : null}

          <Label>POR VENCER (7 DÍAS)</Label>
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {d.expiring.length === 0 ? (
              <Row first title="Nadie vence esta semana" subtitle="Todo en orden" />
            ) : (
              d.expiring.map((u, i) => {
                const left = daysUntil(u.plan_until) ?? 0;
                return (
                  <Row
                    key={u.id}
                    first={i === 0}
                    title={u.full_name || u.email || 'Socio'}
                    subtitle={`${u.plan} · ${left < 0 ? `venció hace ${-left} ${left === -1 ? 'día' : 'días'}` : left === 0 ? 'vence hoy' : `vence en ${left} ${left === 1 ? 'día' : 'días'}`}${u.phone ? ` · ${u.phone}` : ''}`}
                    onPress={() => nav.navigate('MemberDetail', { id: u.id })}
                  />
                );
              })
            )}
          </Card>

          <Label>ÚLTIMAS ENTRADAS</Label>
          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {d.recent.length === 0 ? (
              <Row first title="Todavía no hay entradas" />
            ) : (
              d.recent.map((r, i) => (
                <Row
                  key={r.created_at + r.user_id}
                  first={i === 0}
                  title={r.full_name || 'Socio'}
                  subtitle={time(r.created_at)}
                  onPress={() => nav.navigate('MemberDetail', { id: r.user_id })}
                />
              ))
            )}
          </Card>

          <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            <Row first title="Planes y ajustes" subtitle="Precios, duración y aforo máximo" onPress={() => nav.navigate('Plans')} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  huge: { fontFamily: fonts.number, fontSize: 56, color: colors.text, lineHeight: 60 },
  cap: { fontSize: 28, color: colors.muted },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.accent },
  tile: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 2 },
  tileNum: { fontFamily: fonts.number, fontSize: 30, color: colors.accent },
  small: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  money: { fontFamily: fonts.number, fontSize: 40, color: colors.text },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentFaint,
  },
  alertText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
