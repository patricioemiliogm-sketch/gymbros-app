import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Body, Button, Title } from '../../components/ui';
import { api, CheckinResult, errorText } from '../../lib/api';
import { colors, fonts } from '../../theme';

type Result = CheckinResult;

// Recepción: escanea el QR del socio y registra su entrada
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<Result | null>(null);
  const busy = useRef(false);
  const focused = useIsFocused();

  const onScan = async ({ data }: { data: string }) => {
    if (busy.current || result) return;
    busy.current = true;
    try {
      setResult(await api<Result>('/api/admin/checkin', { method: 'POST', body: { code: data } }));
    } catch (e) {
      setResult({ ok: false, reason: errorText(e) });
    }
    busy.current = false;
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={st.center}>
        <Icon name="scan" size={48} color={colors.accent} />
        <Title>ESCANEAR</Title>
        <Body style={{ color: colors.muted, textAlign: 'center' }}>Necesitamos la cámara para leer el QR de los socios.</Body>
        <Button title="PERMITIR CÁMARA" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={result ? undefined : onScan}
        />
      ) : null}

      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 20 }} edges={['top']}>
        <View style={st.header}>
          <Title accent="QR">ESCANEAR </Title>
          <Body style={{ color: colors.muted, fontSize: 13 }}>
            Apunta al código del socio. Si la cámara no lo lee, busca al socio en Socios y usa “Registrar entrada”.
          </Body>
        </View>

        {!result ? (
          <View style={st.frame} />
        ) : (
          <View style={[st.result, { borderColor: result.ok ? colors.success : colors.danger }]}>
            <View style={[st.badge, { backgroundColor: result.ok ? colors.success : colors.danger }]}>
              <Icon name={result.ok ? 'check' : 'close'} size={34} color="#0B0B0B" strokeWidth={3} />
            </View>
            <Text style={st.resultTitle}>{result.ok ? 'BIENVENIDO' : 'ACCESO DENEGADO'}</Text>
            {result.name ? <Text style={st.resultName}>{result.name}</Text> : null}
            <Body style={{ color: colors.muted, textAlign: 'center' }}>
              {result.ok ? `${result.plan ?? 'Plan Bro'} · entrada registrada` : result.reason}
            </Body>
            <Button title="ESCANEAR OTRO" onPress={() => setResult(null)} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
        <View style={{ height: 100 }} />
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { backgroundColor: 'rgba(11,11,11,0.8)', borderRadius: 16, padding: 14, gap: 2 },
  frame: {
    alignSelf: 'center',
    width: 250,
    height: 250,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.accent,
  },
  result: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 2,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontFamily: fonts.stencil, fontSize: 24, color: colors.text },
  resultName: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
});
