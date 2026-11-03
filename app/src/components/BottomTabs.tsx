// Barra de abas de vidro na parte de baixo (versão celular).
import React from 'react';
import { Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { T } from './ui';
import { colors } from '../theme';

type Tab = { href: string; label: string; icon: keyof typeof Ionicons.glyphMap; match?: string[] };

const TABS: Tab[] = [
  { href: '/home', label: 'Início', icon: 'home' },
  { href: '/live', label: 'Ao Vivo', icon: 'tv' },
  { href: '/schedule', label: 'Programação', icon: 'calendar' },
  { href: '/movies', label: 'Filmes', icon: 'film', match: ['/movies', '/new', '/details'] },
  { href: '/more', label: 'Mais', icon: 'menu', match: ['/more', '/series', '/search', '/guide', '/settings', '/admin'] },
];

export const TAB_BAR_HEIGHT = 64;

export function BottomTabs() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(10, insets.bottom), zIndex: 10 }}>
      <GlassSurface strength="strong" style={{ height: TAB_BAR_HEIGHT, borderRadius: 32, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
        {TABS.map((t) => {
          const active = (t.match || [t.href]).some((m) => path === m || path.startsWith(m + '/'));
          return (
            <Pressable key={t.href} onPress={() => router.navigate(t.href as any)} accessibilityRole="button" accessibilityLabel={t.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_BAR_HEIGHT - 10, borderRadius: 26, backgroundColor: active ? 'rgba(92,200,255,0.18)' : 'transparent', gap: 2 }}>
              <Ionicons name={(active ? t.icon : `${t.icon}-outline`) as any} size={22} color={active ? colors.accent : colors.textSoft} />
              <T numberOfLines={1} style={{ fontSize: 10, fontWeight: active ? '800' : '600', color: active ? colors.accent : colors.textSoft }}>{t.label}</T>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}
