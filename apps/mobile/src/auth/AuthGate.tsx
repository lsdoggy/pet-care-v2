import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, ApiError } from '../api/client';
import type { AuthResponse, UserDto } from '../api/types';
import { tokenStore } from './tokenStore';
import { AuthScreen, type AuthMode } from '../screens/AuthScreen';
import { AppStack, type Route, type TabName } from '../navigation/AppStack';
import { PetsHomeScreen } from '../screens/PetsHomeScreen';
import { PetFormScreen } from '../screens/PetFormScreen';
import { PetDetailScreen } from '../screens/PetDetailScreen';
import { PetHistoryScreen } from '../screens/PetHistoryScreen';
import { AppointmentFormScreen } from '../screens/AppointmentFormScreen';
import { RecordFormScreen } from '../screens/RecordFormScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { ShoppingScreen } from '../screens/ShoppingScreen';
import { StockScreen } from '../screens/StockScreen';

type Phase = 'boot' | 'anon' | 'authed';

export function AuthGate() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [mode, setMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<UserDto | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Home');

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setPhase('anon');
        return;
      }
      try {
        setUser(await api.me(token));
        setPhase('authed');
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await tokenStore.clear();
        }
        setPhase('anon');
      }
    })();
  }, []);

  const handleAuth = useCallback(
    async (email: string, password: string) => {
      const res: AuthResponse =
        mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      await tokenStore.set(res.accessToken);
      setUser(res.user);
      setPhase('authed');
    },
    [mode],
  );

  const handleLogout = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
    setMode('login');
    setActiveTab('Home');
    setPhase('anon');
  }, []);

  if (phase === 'boot') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.bootText}>Checking session…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (phase === 'authed' && user) {
    return (
      <>
        {/* Keyed by route identity so each screen re-mounts on navigation —
            Home reloads its pet list when we pop back from form/detail. */}
        <AppStack activeTab={activeTab} onTabChange={setActiveTab}>
          {(top: Route) => {
            switch (top.name) {
              case 'PetForm':
                return <PetFormScreen key={`form-${top.petId ?? 'new'}`} petId={top.petId} />;
              case 'PetDetail':
                return <PetDetailScreen key={`detail-${top.petId}`} petId={top.petId} />;
              case 'PetHistory':
                return <PetHistoryScreen key={`history-${top.petId}`} petId={top.petId} petName={top.petName} />;
              case 'AppointmentForm':
                return <AppointmentFormScreen key={`appt-${top.petId}`} petId={top.petId} petName={top.petName} />;
              case 'RecordForm':
                return <RecordFormScreen key={`record-${top.petId}`} petId={top.petId} petName={top.petName} />;
              case 'Tasks':
                return <TasksScreen key="tasks" />;
              case 'Shopping':
                return <ShoppingScreen key="shopping" />;
              case 'Stock':
                return <StockScreen key="stock" />;
              case 'Home':
              default:
                return <PetsHomeScreen key="home" user={user} onLogout={handleLogout} />;
            }
          }}
        </AppStack>
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <>
      <AuthScreen mode={mode} onSubmit={handleAuth} onSwitchMode={() => setMode(mode === 'login' ? 'register' : 'login')} />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f6f7fb', alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootText: { color: '#6b7280', fontSize: 14 },
});
