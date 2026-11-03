// "Mais" (celular): atalhos para as telas que não cabem na barra de abas.
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../../src/components/GlassSurface';
import { H1, Muted, T } from '../../src/components/ui';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme';

type Item = { href: string; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap };

export default function More() {
  const isMaster = useAuth((s) => s.session?.user.role === 'master' || !!s.masterKey);
  const items: Item[] = [
    { href: '/search', label: 'Buscar', hint: 'Canais, filmes e séries', icon: 'search-outline' },
    { href: '/series', label: 'Séries', hint: 'Por região e gênero', icon: 'albums-outline' },
    { href: '/new', label: 'Lançamentos', hint: 'Filmes mais recentes', icon: 'star-outline' },
    { href: '/guide', label: 'Guia de TV', hint: 'Grade de horários', icon: 'grid-outline' },
    { href: '/settings', label: 'Configurações', hint: 'Minhas listas, aparência, conta', icon: 'settings-outline' },
    { href: '/admin', label: isMaster ? 'Usuários' : 'Área do administrador', hint: 'Criar e gerenciar convites', icon: 'people-outline' },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <H1 style={{ fontSize: 28, marginBottom: 6 }}>Mais</H1>
      {items.map((it) => (
        <Pressable key={it.href} onPress={() => router.push(it.href as any)} accessibilityRole="button">
          <GlassSurface style={{ borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(92,200,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={it.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: '800', fontSize: 16 }}>{it.label}</T>
              <Muted>{it.hint}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </GlassSurface>
        </Pressable>
      ))}
    </ScrollView>
  );
}
