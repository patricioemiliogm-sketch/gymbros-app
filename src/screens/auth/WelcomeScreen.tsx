import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button } from '../../components/ui';
import type { AuthStackParams } from '../../navigation/RootNavigator';
import { colors, fonts } from '../../theme';

export default function WelcomeScreen({ navigation }: NativeStackScreenProps<AuthStackParams, 'Welcome'>) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: 28, marginTop: 40 }}>
        <View
          style={{
            borderRadius: 32,
            shadowColor: colors.accent,
            shadowOpacity: 0.35,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Image
            source={require('../../../assets/logo.png')}
            style={{ width: 280, height: 280, borderRadius: 32 }}
            accessibilityLabel="Logo GYM BROS"
          />
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: fonts.stencil, fontSize: 34, color: colors.text, textAlign: 'center', lineHeight: 40 }}>
            ENTRENA CON{'\n'}
            <Text style={{ color: colors.accent }}>TUS BROS</Text>
          </Text>
          <Body style={{ color: colors.muted, textAlign: 'center', maxWidth: 290 }}>
            Reserva clases, sigue tu rutina y entra al gym con tu QR.
          </Body>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="INGRESAR" onPress={() => navigation.navigate('Login')} />
        <Button title="Crear cuenta" variant="outline" onPress={() => navigation.navigate('Register')} />
      </View>
    </SafeAreaView>
  );
}
