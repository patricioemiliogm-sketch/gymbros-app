import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Field, Label, Row, Screen } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { dateLong, initials } from '../../lib/format';
import { api, errorText, Stats, tz } from '../../lib/api';
import { colors, fonts } from '../../theme';
import { notify } from '../../lib/notify';

// Sirve para socios y administradores
export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [stats, setStats] = useState({ month: 0, streak: 0, booked: 0 });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const isAdmin = profile?.role === 'admin';

  useFocusEffect(
    useCallback(() => {
      if (!profile || isAdmin) return;
      api<Stats>(`/api/me/stats?tz=${tz()}`)
        .then((x) => setStats({ month: x.month, streak: x.streak, booked: x.booked }))
        .catch(() => {});
    }, [profile, isAdmin]),
  );

  const save = async () => {
    if (!profile) return;
    try {
      await api('/api/me', { method: 'PATCH', body: { full_name: name.trim(), phone: phone.trim() || null } });
    } catch (e) {
      return notify('No se pudo guardar', errorText(e));
    }
    await refreshProfile();
    setEditing(false);
  };

  if (!profile) return null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>{initials(profile.full_name)}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={st.name}>{profile.full_name || 'Sin nombre'}</Text>
          <Text style={st.small}>{profile.email}</Text>
          {isAdmin ? <Chip text="ADMINISTRADOR" /> : null}
        </View>
      </View>

      {!isAdmin ? (
        <>
          <Card highlight style={{ overflow: 'hidden' }}>
            <Image source={require('../../../assets/logo.png')} style={st.watermark} />
            <Label style={{ color: colors.accent }}>TU PLAN</Label>
            <Text style={st.plan}>{profile.plan.toUpperCase()}</Text>
            <View style={{ gap: 2 }}>
              <Text style={st.small}>Vigente hasta</Text>
              <Text style={st.value}>{profile.plan_until ? dateLong(profile.plan_until) : 'Sin fecha de término'}</Text>
            </View>
            <Body style={{ color: colors.muted, fontSize: 12 }}>Para renovar o cambiar tu plan, acércate a recepción.</Body>
          </Card>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { n: stats.month, l: 'Visitas este mes' },
              { n: stats.streak, l: 'Días de racha' },
              { n: stats.booked, l: 'Clases reservadas' },
            ].map((x) => (
              <View key={x.l} style={st.stat}>
                <Text style={st.statNum}>{x.n}</Text>
                <Text style={[st.small, { fontSize: 11 }]}>{x.l}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {editing ? (
        <Card>
          <Field label="Nombre y apellido" value={name} onChangeText={setName} />
          <Field label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+56 9 ..." />
          <Button title="GUARDAR" onPress={save} />
          <Button title="Cancelar" variant="ghost" onPress={() => setEditing(false)} />
        </Card>
      ) : (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          <Row first title="Mis datos" subtitle={profile.phone ?? 'Agrega tu teléfono'} onPress={() => setEditing(true)} />
          <Row title="Correo" subtitle={profile.email ?? ''} />
          <Row title="Miembro desde" subtitle={dateLong(profile.created_at)} />
        </Card>
      )}

      <Button title="Cerrar sesión" variant="outline" icon="logout" onPress={signOut} />
    </Screen>
  );
}

const st = StyleSheet.create({
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.stencil, fontSize: 24, color: colors.text },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  plan: { fontFamily: fonts.stencil, fontSize: 32, color: colors.text, letterSpacing: 1 },
  value: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  watermark: { position: 'absolute', right: -40, top: -30, width: 190, height: 190, opacity: 0.15 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  statNum: { fontFamily: fonts.number, fontSize: 28, color: colors.accent },
});
