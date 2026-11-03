// Superfície de "vidro" usada em barras, menus e botões.
// - iOS / tvOS 26+: Liquid Glass nativo (expo-glass-effect).
// - Android / TV Box: vidro simulado (leve, não pesa em aparelho fraco).
// - PC / navegador: desfoque real com backdrop-filter.
// - "Reduzir efeitos" ligado: superfície sólida.
import React from 'react';
import { Platform, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { colors } from '../theme';
import { useSettings } from '../store/settings';

interface Props extends ViewProps {
  style?: StyleProp<ViewStyle>;
  strength?: 'soft' | 'normal' | 'strong';
  tint?: string;
}

let nativeGlass: boolean | null = null;
function canUseNativeGlass() {
  if (nativeGlass === null) {
    try {
      nativeGlass = (Platform.OS === 'ios') && isGlassEffectAPIAvailable();
    } catch {
      nativeGlass = false;
    }
  }
  return nativeGlass;
}

const FILL = { soft: 'rgba(255,255,255,0.05)', normal: colors.glass, strong: colors.glassStrong };
const BLUR = { soft: 20, normal: 28, strong: 36 };

export function GlassSurface({ style, strength = 'normal', tint, children, ...rest }: Props) {
  const reduce = useSettings((s) => s.reduceEffects);

  if (reduce) {
    return (
      <View style={[{ backgroundColor: '#121827', borderWidth: 1, borderColor: colors.glassBorder }, style]} {...rest}>
        {children}
      </View>
    );
  }

  if (canUseNativeGlass()) {
    return (
      // Nunca use opacity < 1 no GlassView ou nos pais: o efeito some.
      <GlassView style={style} glassEffectStyle="regular" tintColor={tint} {...rest}>
        {children}
      </GlassView>
    );
  }

  const web: any = Platform.OS === 'web'
    ? { backdropFilter: `blur(${BLUR[strength]}px) saturate(160%)`, WebkitBackdropFilter: `blur(${BLUR[strength]}px) saturate(160%)` }
    : null;

  return (
    <View
      style={[
        {
          backgroundColor: tint || FILL[strength],
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderTopColor: 'rgba(255,255,255,0.24)', // brilho da borda superior
          overflow: 'hidden',
        },
        web,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
