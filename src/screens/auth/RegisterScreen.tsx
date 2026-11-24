import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Body, Button, Field, Screen, Title } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParams } from '../../navigation/RootNavigator';
import { colors } from '../../theme';

export default function RegisterScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Register'>) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim()) return setError('Completa tu nombre y tu correo');
    if (password.length < 6) return setError('La clave debe tener al menos 6 caracteres');
    setBusy(true);
    const err = await signUp(name, email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padBottom={40}>
        <Title accent="BROS">ÚNETE A LOS </Title>
        <Body style={{ color: colors.muted }}>
          Crea tu cuenta. Un administrador la activará cuando pagues tu plan en recepción.
        </Body>
        <Field label="Nombre y apellido" value={name} onChangeText={setName} autoComplete="name" placeholder="Tu nombre" />
        <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="tu@correo.cl" />
        <Field label="Clave (mínimo 6 caracteres)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="••••••" />
        {error ? <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text> : null}
        <Button title="CREAR CUENTA" onPress={submit} loading={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
