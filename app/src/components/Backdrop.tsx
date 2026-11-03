// Capa grande atrás do conteúdo, com escurecimento à esquerda e embaixo para o texto ficar legível.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusArt } from '../store/focusArt';
import { colors } from '../theme';
import { useIsPhone } from '../lib/layout';

export function Backdrop() {
  const art = useFocusArt((s) => s.art);
  const phone = useIsPhone();
  // No celular, a capa ocupa o topo da tela inteira; na TV/PC, o lado direito.
  const area = phone ? { left: 0, right: 0, top: 0, height: '55%' as const } : { left: '30%' as const };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {art?.image ? (
        <Image
          source={{ uri: art.image }}
          style={[StyleSheet.absoluteFill, area]}
          contentFit="cover"
          transition={350}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, area, { backgroundColor: art?.color || '#10213F', opacity: 0.9 }]} />
      )}
      {phone ? null : (
      <LinearGradient
        colors={[colors.bg, 'rgba(7,10,18,0.85)', 'rgba(7,10,18,0)']}
        locations={[0.25, 0.45, 0.75]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      )}
      <LinearGradient
        colors={['rgba(7,10,18,0)', 'rgba(7,10,18,0.8)', colors.bg]}
        locations={phone ? [0.15, 0.4, 0.55] : [0.3, 0.55, 0.75]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
