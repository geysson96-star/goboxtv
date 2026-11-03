// Menu lateral de vidro. Fica compacto e abre com os nomes quando recebe o foco.
import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from './Focusable';
import { GlassSurface } from './GlassSurface';
import { T } from './ui';
import { colors } from '../theme';
import { useAuth } from '../store/auth';

type Item = { href: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const ITEMS: Item[] = [
  { href: '/home', label: 'Início', icon: 'home-outline' },
  { href: '/search', label: 'Buscar', icon: 'search-outline' },
  { href: '/live', label: 'Ao Vivo', icon: 'tv-outline' },
  { href: '/schedule', label: 'Programação', icon: 'calendar-outline' },
  { href: '/guide', label: 'Guia de TV', icon: 'grid-outline' },
  { href: '/movies', label: 'Filmes', icon: 'film-outline' },
  { href: '/series', label: 'Séries', icon: 'albums-outline' },
  { href: '/new', label: 'Lançamentos', icon: 'star-outline' },
];

export function SideRail() {
  const path = usePathname();
  const [open, setOpen] = useState(0);
  const isMaster = useAuth((s) => s.session?.user.role === 'master' || !!s.masterKey);
  const expanded = open > 0;

  const bottom: Item[] = [
    ...(isMaster ? [{ href: '/admin', label: 'Usuários', icon: 'people-outline' as const }] : []),
    { href: '/settings', label: 'Configurações', icon: 'settings-outline' },
  ];

  const render = (it: Item) => {
    const active = path === it.href || (it.href !== '/home' && path.startsWith(it.href));
    return (
      <Focusable
        key={it.href}
        scale={false}
        radius={16}
        onPress={() => {
          router.navigate(it.href as any);
          // No PC, o clique deixa o foco no menu; solta para o menu recolher.
          if (Platform.OS === 'web') {
            (document.activeElement as HTMLElement | null)?.blur?.();
            setOpen(0);
          }
        }}
        onFocusChange={(f) => setOpen((n) => Math.max(0, n + (f ? 1 : -1)))}
        accessibilityLabel={it.label}
      >
        <View style={{ height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, backgroundColor: active ? colors.accent : 'transparent' }}>
          <Ionicons name={it.icon} size={21} color={active ? colors.onAccent : colors.textSoft} />
          {expanded ? <T numberOfLines={1} style={{ fontWeight: active ? '800' : '600', color: active ? colors.onAccent : colors.textSoft }}>{it.label}</T> : null}
        </View>
      </Focusable>
    );
  };

  return (
    <GlassSurface
      strength="normal"
      style={{ position: 'absolute', left: 16, top: 16, bottom: 16, width: expanded ? 220 : 76, borderRadius: 28, paddingVertical: 18, paddingHorizontal: 10, zIndex: 10, gap: 6 }}
    >
      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={16} color={colors.onAccent} />
        </View>
        {expanded ? <T style={{ fontSize: 18, fontWeight: '800' }}>GoBoxTV</T> : null}
      </View>
      {ITEMS.map(render)}
      <View style={{ flex: 1 }} />
      {bottom.map(render)}
    </GlassSurface>
  );
}

/** Espaço à esquerda reservado para o menu compacto. */
export const RAIL_SPACE = 108;
