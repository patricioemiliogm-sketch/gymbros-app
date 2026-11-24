import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Body, Button, Card, Chip, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';

// La cuenta existe pero un admin aún no la activa (o fue desactivada)
export default function PendingScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const inactive = profile?.status === 'inactive';

  return (
    <Screen padBottom={40}>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Image source={require('../../../assets/logo.png')} style={{ width: 160, height: 160, borderRadius: 24 }} />
      </View>
      <Title accent={inactive ? '' : '...'}>{inactive ? 'CUENTA INACTIVA' : 'CASI LISTO'}</Title>
      <Card highlight>
        <Chip text={inactive ? 'INACTIVA' : 'PENDIENTE'} tone={inactive ? 'danger' : 'accent'} />
        <Body>
          {inactive
            ? 'Tu plan no está activo. Acércate a recepción para renovarlo.'
            : `Hola ${profile?.full_name || 'bro'}, tu cuenta fue creada. Un administrador debe activarla cuando pagues tu plan en recepción.`}
        </Body>
        <Body style={{ color: colors.muted }}>Cuando esté activa, toca “Ya me activaron”.</Body>
      </Card>
      <Button
        title="YA ME ACTIVARON"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await refreshProfile();
          setBusy(false);
        }}
      />
      <Button title="Cerrar sesión" variant="outline" onPress={signOut} />
    </Screen>
  );
}
