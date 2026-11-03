// Título e descrição do item em foco, no topo da tela (sobre a capa grande).
import React from 'react';
import { View } from 'react-native';
import { useFocusArt } from '../store/focusArt';
import { H1, Muted, Pill, T } from './ui';
import { useIsPhone } from '../lib/layout';

export function HeroInfo({ fallbackTitle, fallbackText, badge, height = 230 }: { fallbackTitle: string; fallbackText?: string; badge?: string; height?: number }) {
  const art = useFocusArt((s) => s.art);
  const phone = useIsPhone();
  return (
    <View style={{ height: phone ? Math.min(height, 170) : height, justifyContent: 'flex-end', gap: 10, maxWidth: 640, paddingBottom: 8 }}>
      {badge ? <Pill label={badge} /> : null}
      <H1 numberOfLines={2} style={{ fontSize: phone ? 28 : 44 }}>{art?.title || fallbackTitle}</H1>
      {art?.subtitle ? <T style={{ color: '#D5DCE8', fontWeight: '600' }}>{art.subtitle}</T> : null}
      <Muted numberOfLines={3} style={{ fontSize: 15, color: '#C3CCDA' }}>{art?.description || fallbackText || ''}</Muted>
    </View>
  );
}
