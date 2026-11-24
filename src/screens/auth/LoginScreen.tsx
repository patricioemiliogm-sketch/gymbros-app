import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Body, Button, Field, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParams } from '../../navigation/RootNavigator';
import { colors } from '../../theme';

export default function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Login'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email || !password) return setError('Escribe tu correo y tu clave');
    setBusy(true);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padBottom={40}>
        <Title accent="BRO">HOLA DE NUEVO, </Title>
        <Body style={{ color: colors.muted }}>Ingresa con el correo de tu cuenta GYM BROS.</Body>
        <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="tu@correo.cl" />
        <Field label="Clave" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="••••••" />
        {error ? <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text> : null}
        <Button title="INGRESAR" onPress={submit} loading={busy} />
        <Button title="¿No tienes cuenta? Créala aquí" variant="ghost" onPress={() => navigation.replace('Register')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
