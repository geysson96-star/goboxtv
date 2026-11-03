import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, Slot, usePathname } from 'expo-router';
import { useFocusArt } from '../../src/store/focusArt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabs, TAB_BAR_HEIGHT } from '../../src/components/BottomTabs';
import { useIsPhone } from '../../src/lib/layout';
import { Backdrop } from '../../src/components/Backdrop';
import { RAIL_SPACE, SideRail } from '../../src/components/SideRail';
import { GlassSurface } from '../../src/components/GlassSurface';
import { Button, T } from '../../src/components/ui';
import { useAuth } from '../../src/store/auth';
import { useCatalog } from '../../src/store/catalog';
import { Reminder, useSettings } from '../../src/store/settings';
import { HEALTH_INTERVAL_MS } from '../../src/lib/config';
import { colors } from '../../src/theme';

export default function MainLayout() {
  const status = useAuth((s) => s.status);
  const [due, setDue] = useState<Reminder | null>(null);
  const path = usePathname();
  const phone = useIsPhone();
  const insets = useSafeAreaInsets();

  // Ao trocar de tela, limpa a capa do item anterior.
  useEffect(() => {
    useFocusArt.getState().setArt(null);
  }, [path]);

  // Verificação periódica das fontes.
  useEffect(() => {
    const t = setInterval(() => useCatalog.getState().checkHealth(), HEALTH_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Lembretes da programação: avisa quando o programa começa.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const r = useSettings.getState().reminders.find((x) => x.start <= now + 60e3 && x.start > now - 5 * 60e3);
      if (r && r.key !== due?.key) setDue(r);
    }, 20000);
    return () => clearInterval(t);
  }, [due]);

  if (status !== 'in') return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <View style={phone ? { flex: 1, paddingTop: insets.top, paddingBottom: TAB_BAR_HEIGHT + Math.max(10, insets.bottom) + 8 } : { flex: 1, paddingLeft: RAIL_SPACE }}>
        <Slot />
      </View>
      {phone ? <BottomTabs /> : <SideRail />}
      {due ? (
        <View style={phone ? { position: 'absolute', left: 12, right: 12, bottom: TAB_BAR_HEIGHT + 24 } : { position: 'absolute', right: 24, bottom: 24 }}>
          <GlassSurface strength="strong" style={{ borderRadius: 22, padding: 16, gap: 10, width: phone ? undefined : 340 }}>
            <T style={{ fontWeight: '800' }}>Começando agora</T>
            <T>{due.title} · {due.channelName}</T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                small
                variant="primary"
                label="Assistir"
                autoFocus
                onPress={() => {
                  useSettings.getState().toggleReminder(due);
                  setDue(null);
                  router.push({ pathname: '/player', params: { type: 'channel', id: due.channelId } });
                }}
              />
              <Button
                small
                label="Dispensar"
                onPress={() => {
                  useSettings.getState().toggleReminder(due);
                  setDue(null);
                }}
              />
            </View>
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}
