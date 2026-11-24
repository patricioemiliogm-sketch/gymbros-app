import React from 'react';
import { Body, Card, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';

// Se muestra solo si falta el archivo .env con los datos de Supabase
export default function SetupScreen() {
  return (
    <Screen padBottom={40}>
      <Title accent="FALTA CONFIGURAR">GYM BROS · </Title>
      <Card highlight>
        <Body>La app no sabe dónde está el servidor.</Body>
        <Body style={{ color: colors.muted }}>
          Para la app de celular, crea el archivo .env con EXPO_PUBLIC_API_URL=https://tu-dominio.cl y vuelve a iniciar
          con: npx expo start -c
        </Body>
      </Card>
    </Screen>
  );
}
