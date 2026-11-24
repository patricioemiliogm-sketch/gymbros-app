import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from '../../components/Icon';
import { Big, Body, Button, Card, Chip, Label, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api, ClassInfo, Occupancy, Stats, tz } from '../../lib/api';
import { dateLong, daysUntil, dayShort, firstName, occupancyLevel, time } from '../../lib/format';
import { colors, fonts } from '../../theme';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function HomeScreen() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const { profile, refreshProfile } = useAuth();
  const [week, setWeek] = useState<boolean[]>(Array(7).fill(false));
  const [streak, setStreak] = useState(0);
  const [next, setNext] = useState<ClassInfo | null>(null);
  const [occ, setOcc] = useState<Occupancy | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [stats, o] = await Promise.all([api<Stats>(`/api/me/stats?tz=${tz()}`), api<Occupancy>('/api/occupancy')]);
      setWeek(stats.week);
      setStreak(stats.streak);
      setNext(stats.next_class);
      setOcc(o);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const days = week.filter(Boolean).length;
  const left = daysUntil(profile?.plan_until ?? null);
  const level = occ ? occupancyLevel(occ.now, occ.capacity) : null;

  const quick: { label: string; icon: IconName; to: string }[] = [
    { label: 'Rutina', icon: 'dumbbell', to: 'Rutina' },
    { label: 'Progreso', icon: 'chart', to: 'Progreso' },
    { label: 'Clases', icon: 'calendar', to: 'Clases' },
    { label: 'Mi QR', icon: 'qr', to: 'CheckIn' },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await Promise.all([load(), refreshProfile()]);
        setRefreshing(false);
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={require('../../../assets/logo.png')} style={st.logo} />
        <View style={{ flex: 1 }}>
          <Title accent={firstName(profile?.full_name ?? '').toUpperCase()}>HOLA, </Title>
          <Body style={{ color: colors.muted, fontSize: 13 }}>¿Listo para entrenar hoy?</Body>
        </View>
      </View>

      {left !== null && left <= 7 ? (
        <View style={[st.banner, left < 0 && { borderColor: colors.danger }]}>
          <Icon name="clock" size={22} color={left < 0 ? colors.danger : colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.bannerTitle}>
              {left < 0 ? 'Tu plan venció' : left === 0 ? 'Tu plan vence hoy' : `Tu plan vence en ${left} ${left === 1 ? 'día' : 'días'}`}
            </Text>
            <Text style={st.small}>Renuévalo en recepción para no perder tu acceso.</Text>
          </View>
        </View>
      ) : null}

      <Card highlight>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip text={(profile?.plan ?? 'Plan Bro').toUpperCase()} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
            <Text style={st.small}>Activo{profile?.plan_until ? ` hasta ${dateLong(profile.plan_until)}` : ''}</Text>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={st.h2}>Escanea y entra</Text>
          <Body style={{ color: colors.muted }}>Muestra tu código en recepción.</Body>
        </View>
        <Button title="Abrir mi QR" icon="qr" onPress={() => navigation.navigate('CheckIn')} />
      </Card>

      {occ && level ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="users" size={16} color={colors.accent} />
                <Text style={st.small}>En el gym ahora</Text>
              </View>
              <Big>
                {occ.now} {occ.now === 1 ? 'PERSONA' : 'PERSONAS'}
              </Big>
            </View>
            <Chip text={level.label.toUpperCase()} tone={level.label === 'Lleno' ? 'danger' : 'accent'} />
          </View>
          {level.pct !== null ? (
            <View style={st.track}>
              <View style={[st.fill, { width: `${Math.max(level.pct, 3)}%` }]} />
            </View>
          ) : null}
          <Text style={[st.small, { fontSize: 11 }]}>Estimado según las entradas de los últimos {occ.window_min} minutos.</Text>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="flame" size={16} color={colors.accent} />
              <Text style={st.small}>Esta semana</Text>
            </View>
            <Big>
              {days} {days === 1 ? 'DÍA' : 'DÍAS'}
            </Big>
          </View>
          <Text style={st.small}>{streak > 1 ? `Racha: ${streak} días seguidos` : 'Meta: 5 días'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {week.map((done, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <View style={[st.dot, done ? { backgroundColor: colors.accent } : st.dotEmpty]}>
                {done ? <Icon name="check" size={16} color={colors.onAccent} strokeWidth={2.6} /> : null}
              </View>
              <Text style={st.small}>{WEEK[i]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Pressable onPress={() => navigation.navigate('Clases')} accessibilityRole="button">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {next ? (
            <>
              <View style={st.timeBox}>
                <Text style={st.time}>{time(next.starts_at)}</Text>
                <Text style={[st.small, { fontSize: 10 }]}>{dayShort(new Date(next.starts_at))}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={st.small}>Tu próxima clase</Text>
                <Text style={st.className}>{next.name}</Text>
                <Text style={st.small}>
                  {next.duration_min} min · {next.room}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={st.className}>Sin clases reservadas</Text>
              <Text style={st.small}>Toca aquí para ver el horario y reservar.</Text>
            </View>
          )}
          <Icon name="chevron" size={20} color={colors.muted} strokeWidth={2} />
        </Card>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {quick.map((q) => (
          <Pressable key={q.label} onPress={() => navigation.navigate(q.to)} style={st.quick} accessibilityRole="button">
            <Icon name={q.icon} size={22} color={colors.text} />
            <Text style={st.quickText}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
      <Label style={{ textAlign: 'center', marginTop: 4 }}>GYM BROS</Label>
    </Screen>
  );
}

const st = StyleSheet.create({
  logo: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  h2: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentFaint,
  },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dotEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
  timeBox: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { fontFamily: fonts.number, fontSize: 22, color: colors.accent },
  className: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  quick: {
    flex: 1,
    height: 76,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
});
