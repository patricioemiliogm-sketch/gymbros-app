import { useIsFocused, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Body, Button, Card, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api, errorText } from '../../lib/api';
import { dateLong } from '../../lib/format';
import { colors, fonts } from '../../theme';

// El servidor entrega un QR firmado que cambia cada 30 s: una captura de pantalla no sirve
export default function CheckInScreen() {
  const { profile } = useAuth();
  const focused = useIsFocused();
  const [code, setCode] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const expiresAt = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  // Cuando recepción escanea el código, se muestra la celebración
  useEffect(() => {
    if (!focused) return;
    let baseline: string | null | undefined;
    let alive = true;
    const check = async () => {
      try {
        const last = await api<{ id: string } | null>('/api/me/last-checkin');
        const id = last?.id ?? null;
        if (baseline === undefined) baseline = id;
        else if (id && id !== baseline && alive) {
          baseline = id;
          navigation.navigate('CheckInSuccess');
        }
      } catch {}
    };
    check();
    const t = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [focused, navigation]);

  const fetchCode = useCallback(async () => {
    try {
      const r = await api<{ code: string; expires_in: number }>('/api/me/qr');
      setCode(r.code);
      setError(null);
      expiresAt.current = Date.now() + r.expires_in * 1000;
      setLeft(r.expires_in);
    } catch (e) {
      setError(errorText(e));
      expiresAt.current = Date.now() + 10000; // reintenta en 10 s
    }
  }, []);

  useEffect(() => {
    if (!focused) return;
    fetchCode();
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((expiresAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) fetchCode();
    }, 1000);
    return () => clearInterval(t);
  }, [focused, fetchCode]);

  return (
    <Screen>
      <Title accent="IN">CHECK-</Title>
      <Card style={{ alignItems: 'center', gap: 18, paddingVertical: 24 }} highlight>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../../../assets/logo.png')} style={{ width: 36, height: 36, borderRadius: 10 }} />
          <View>
            <Text style={st.name}>{profile?.full_name || 'Socio'}</Text>
            <Text style={st.plan}>
              {profile?.plan} · {profile?.plan_until ? `hasta ${dateLong(profile.plan_until)}` : 'Activo'}
            </Text>
          </View>
        </View>

        <View style={st.qrBox} accessible accessibilityLabel="Código QR de acceso">
          {code ? (
            <QRCode value={code} size={210} color={colors.bg} backgroundColor="#FFFFFF" />
          ) : (
            <View style={{ width: 210, height: 210, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.bg} />
            </View>
          )}
        </View>

        {error ? (
          <>
            <Body style={{ color: colors.danger, textAlign: 'center' }}>{error}</Body>
            <Button title="Reintentar" variant="outline" onPress={fetchCode} />
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={st.title}>Muestra este código en recepción</Text>
            <Body style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
              Se renueva en <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>{left} s</Text>. Sube el brillo para
              escanear más rápido.
            </Body>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  plan: { fontFamily: fonts.regular, fontSize: 12, color: colors.accent },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
});
