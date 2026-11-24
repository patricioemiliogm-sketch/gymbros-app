import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api, Stats, tz } from '../../lib/api';
import { firstName } from '../../lib/format';
import { colors, fonts } from '../../theme';

// Celebración cuando recepción escanea el QR del socio (idea tomada de GymKartel)
export default function CheckInSuccessScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const scale = useRef(new Animated.Value(0.3)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    api<Stats>(`/api/me/stats?tz=${tz()}`)
      .then(setStats)
      .catch(() => {});
  }, [scale, fade]);

  const week = stats?.week.filter(Boolean).length ?? 0;

  return (
    <SafeAreaView style={st.wrap}>
      <View style={{ alignItems: 'center', gap: 22 }}>
        <Animated.View style={[st.seal, { transform: [{ scale }] }]}>
          <Icon name="check" size={72} color={colors.onAccent} strokeWidth={3} />
        </Animated.View>
        <Animated.View style={{ alignItems: 'center', gap: 8, opacity: fade }}>
          <Text style={st.title}>¡BIENVENIDO,</Text>
          <Text style={[st.title, { color: colors.accent }]}>{firstName(profile?.full_name ?? '').toUpperCase()}!</Text>
          <Text style={st.sub}>Entrada registrada. A darle con todo.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[st.stats, { opacity: fade }]}>
        <View style={st.stat}>
          <Icon name="flame" size={22} color={colors.accent} />
          <Text style={st.num}>{stats?.streak ?? '–'}</Text>
          <Text style={st.label}>{stats?.streak === 1 ? 'día de racha' : 'días de racha'}</Text>
        </View>
        <View style={st.stat}>
          <Icon name="calendar" size={22} color={colors.accent} />
          <Text style={st.num}>{stats ? `${week}/5` : '–'}</Text>
          <Text style={st.label}>esta semana</Text>
        </View>
        <View style={st.stat}>
          <Icon name="chart" size={22} color={colors.accent} />
          <Text style={st.num}>{stats?.month ?? '–'}</Text>
          <Text style={st.label}>visitas del mes</Text>
        </View>
      </Animated.View>

      <View style={{ gap: 14, alignItems: 'center' }}>
        <Image source={require('../../../assets/logo.png')} style={{ width: 64, height: 64, borderRadius: 16, opacity: 0.8 }} />
        <Button title="A ENTRENAR" onPress={() => navigation.goBack()} style={{ alignSelf: 'stretch' }} />
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'space-between' },
  seal: {
    marginTop: 40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  title: { fontFamily: fonts.stencil, fontSize: 34, color: colors.text, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  num: { fontFamily: fonts.number, fontSize: 30, color: colors.text },
  label: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: 'center' },
});
