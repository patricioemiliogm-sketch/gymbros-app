import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Field, Label, Screen } from '../../components/ui';
import { api, errorText, Plan } from '../../lib/api';
import { clp } from '../../lib/format';
import type { AdminStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';
import { notify } from '../../lib/notify';

// El admin crea una cuenta ya activa y le entrega al socio su correo y clave
export default function CreateMemberScreen({ navigation }: NativeStackScreenProps<AdminStackParams, 'CreateMember'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [months, setMonths] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    api<Plan[]>('/api/plans')
      .then((p) => {
        setPlans(p);
        if (p[0]) setPlanId(p[0].id);
      })
      .catch(() => {});
  }, []);
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.includes('@')) return notify('Faltan datos', 'Escribe el nombre y un correo válido.');
    if (password.length < 6) return notify('Clave muy corta', 'Usa al menos 6 caracteres.');
    setBusy(true);
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: {
          full_name: name.trim(),
          email: email.trim(),
          password,
          role,
          plan_id: role === 'member' && plans.length ? planId : undefined,
          months: role === 'member' && !plans.length ? months : 0,
        },
      });
    } catch (e) {
      setBusy(false);
      return notify('No se pudo crear', errorText(e));
    }
    setBusy(false);
    notify('Cuenta creada', `Entrégale a ${name.trim()} su correo (${email.trim()}) y su clave para que ingrese.`, () =>
      navigation.goBack(),
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padBottom={40}>
        <Body style={{ color: colors.muted }}>La cuenta queda activa de inmediato. Luego el socio puede cambiar sus datos.</Body>

        <Label>TIPO DE CUENTA</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['member', 'admin'] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              accessibilityRole="button"
              accessibilityState={{ selected: role === r }}
              style={[st.opt, role === r && st.optOn]}
            >
              <Text style={[st.optText, role === r && { color: colors.onAccent }]}>{r === 'member' ? 'Socio' : 'Administrador'}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Nombre y apellido" value={name} onChangeText={setName} />
        <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Clave inicial (mínimo 6)" value={password} onChangeText={setPassword} autoCapitalize="none" />

        {role === 'member' && plans.length > 0 ? (
          <>
            <Label>PLAN (SE REGISTRA LA VENTA)</Label>
            {plans.map((pl) => (
              <Pressable
                key={pl.id}
                onPress={() => setPlanId(pl.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: planId === pl.id }}
                style={[st.opt, { flex: 0, paddingHorizontal: 14 }, planId === pl.id && st.optOn]}
              >
                <Text style={[st.optText, planId === pl.id && { color: colors.onAccent }]}>
                  {pl.name} · {clp(pl.price_clp)} · {pl.months} {pl.months === 1 ? 'mes' : 'meses'}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {role === 'member' && plans.length === 0 ? (
          <>
            <Label>MESES DE PLAN</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 3, 6, 12].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMonths(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: months === m }}
                  style={[st.opt, months === m && st.optOn]}
                >
                  <Text style={[st.optText, months === m && { color: colors.onAccent }]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Button title="CREAR CUENTA" onPress={submit} loading={busy} style={{ marginTop: 8 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  opt: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  optOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
