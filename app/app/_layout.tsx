import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../src/store/auth';
import { useSettings } from '../src/store/settings';
import { useCatalog } from '../src/store/catalog';
import { installSpatialNav } from '../src/lib/spatialNav';
import { colors } from '../src/theme';

export default function RootLayout() {
  const authStatus = useAuth((s) => s.status);
  const settingsLoaded = useSettings((s) => s.loaded);

  useEffect(() => {
    useSettings.getState().load().then(() => useAuth.getState().init());
    installSpatialNav(() => router.canGoBack() && router.back());
  }, []);

  // Só carrega listas depois que o acesso foi liberado.
  useEffect(() => {
    if (authStatus === 'in' && settingsLoaded) useCatalog.getState().init();
  }, [authStatus, settingsLoaded]);

  if (!settingsLoaded || authStatus === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" hidden />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
    </>
  );
}
