import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { makeTabBar } from '../components/GymTabBar';
import { Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import PendingScreen from '../screens/auth/PendingScreen';
import SetupScreen from '../screens/auth/SetupScreen';

import HomeScreen from '../screens/member/HomeScreen';
import ClassesScreen from '../screens/member/ClassesScreen';
import CheckInScreen from '../screens/member/CheckInScreen';
import RoutineScreen from '../screens/member/RoutineScreen';
import ProfileScreen from '../screens/member/ProfileScreen';
import CheckInSuccessScreen from '../screens/member/CheckInSuccessScreen';
import ProgressScreen from '../screens/member/ProgressScreen';
import ExerciseScreen from '../screens/member/ExerciseScreen';

import MembersScreen from '../screens/admin/MembersScreen';
import MemberDetailScreen from '../screens/admin/MemberDetailScreen';
import CreateMemberScreen from '../screens/admin/CreateMemberScreen';
import ScanScreen from '../screens/admin/ScanScreen';
import AdminClassesScreen from '../screens/admin/AdminClassesScreen';
import RoutineEditorScreen from '../screens/admin/RoutineEditorScreen';
import TodayScreen from '../screens/admin/TodayScreen';
import PlansScreen from '../screens/admin/PlansScreen';
import { isConfigured } from '../lib/api';

export type AuthStackParams = { Welcome: undefined; Login: undefined; Register: undefined };
export type MemberTabParams = { Inicio: undefined; Clases: undefined; CheckIn: undefined; Rutina: undefined; Perfil: undefined };
export type MemberStackParams = {
  MemberTabs: NavigatorScreenParams<MemberTabParams> | undefined;
  CheckInSuccess: undefined;
  Progreso: undefined;
  Ejercicio: { exercise: string };
};
export type AdminTabParams = { Hoy: undefined; Socios: undefined; AdminClases: undefined; Escanear: undefined; Perfil: undefined };
export type AdminStackParams = {
  AdminTabs: NavigatorScreenParams<AdminTabParams> | undefined;
  Plans: undefined;
  MemberDetail: { id: string };
  CreateMember: undefined;
  RoutineEditor: { id: string; name: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const MemberTabs = createBottomTabNavigator<MemberTabParams>();
const AdminTabs = createBottomTabNavigator<AdminTabParams>();
const AdminStack = createNativeStackNavigator<AdminStackParams>();
const MemberStack = createNativeStackNavigator<MemberStackParams>();

const memberBar = makeTabBar({
  Inicio: { label: 'Inicio', icon: 'home' },
  Clases: { label: 'Clases', icon: 'calendar' },
  CheckIn: { label: 'Mi QR', icon: 'qr', center: true },
  Rutina: { label: 'Rutina', icon: 'dumbbell' },
  Perfil: { label: 'Perfil', icon: 'user' },
});

const adminBar = makeTabBar({
  Hoy: { label: 'Hoy', icon: 'chart' },
  Socios: { label: 'Socios', icon: 'users' },
  Escanear: { label: 'Escanear', icon: 'scan', center: true },
  AdminClases: { label: 'Clases', icon: 'calendar' },
  Perfil: { label: 'Perfil', icon: 'user' },
});

function MemberTabsScreen() {
  return (
    <MemberTabs.Navigator screenOptions={{ headerShown: false }} tabBar={memberBar}>
      <MemberTabs.Screen name="Inicio" component={HomeScreen} />
      <MemberTabs.Screen name="Clases" component={ClassesScreen} />
      <MemberTabs.Screen name="CheckIn" component={CheckInScreen} />
      <MemberTabs.Screen name="Rutina" component={RoutineScreen} />
      <MemberTabs.Screen name="Perfil" component={ProfileScreen} />
    </MemberTabs.Navigator>
  );
}

function AdminTabsScreen() {
  return (
    <AdminTabs.Navigator screenOptions={{ headerShown: false }} tabBar={adminBar}>
      <AdminTabs.Screen name="Hoy" component={TodayScreen} />
      <AdminTabs.Screen name="Socios" component={MembersScreen} />
      <AdminTabs.Screen name="Escanear" component={ScanScreen} />
      <AdminTabs.Screen name="AdminClases" component={AdminClassesScreen} />
      <AdminTabs.Screen name="Perfil" component={ProfileScreen} />
    </AdminTabs.Navigator>
  );
}

const stackHeader = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerBackTitle: 'Volver',
  contentStyle: { backgroundColor: colors.bg },
};

function AdminApp() {
  return (
    <AdminStack.Navigator screenOptions={stackHeader}>
      <AdminStack.Screen name="AdminTabs" component={AdminTabsScreen} options={{ headerShown: false }} />
      <AdminStack.Screen name="MemberDetail" component={MemberDetailScreen} options={{ title: 'Socio' }} />
      <AdminStack.Screen name="CreateMember" component={CreateMemberScreen} options={{ title: 'Nueva cuenta' }} />
      <AdminStack.Screen name="RoutineEditor" component={RoutineEditorScreen} options={{ title: 'Rutina' }} />
      <AdminStack.Screen name="Plans" component={PlansScreen} options={{ title: 'Planes y ajustes' }} />
    </AdminStack.Navigator>
  );
}

function MemberApp() {
  return (
    <MemberStack.Navigator screenOptions={stackHeader}>
      <MemberStack.Screen name="MemberTabs" component={MemberTabsScreen} options={{ headerShown: false }} />
      <MemberStack.Screen name="Progreso" component={ProgressScreen} options={{ title: 'Progreso' }} />
      <MemberStack.Screen name="Ejercicio" component={ExerciseScreen} options={{ title: '' }} />
      <MemberStack.Screen
        name="CheckInSuccess"
        component={CheckInSuccessScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
      />
    </MemberStack.Navigator>
  );
}

function AuthApp() {
  return (
    <AuthStack.Navigator screenOptions={stackHeader}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: '' }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: '' }} />
    </AuthStack.Navigator>
  );
}

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text, border: colors.border },
};

export default function RootNavigator() {
  const { profile, loading } = useAuth();

  if (!isConfigured) return <SetupScreen />;
  if (loading) return <Loading />;

  return (
    <NavigationContainer theme={theme}>
      {!profile ? (
        <AuthApp />
      ) : profile.role === 'admin' ? (
        <AdminApp />
      ) : profile.status !== 'active' ? (
        <PendingScreen />
      ) : (
        <MemberApp />
      )}
    </NavigationContainer>
  );
}
