// Item navegável por controle remoto (setas + OK), mouse ou toque.
// Mostra o foco com borda ciano e leve zoom — essencial em TV.
import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  focusStyle?: StyleProp<ViewStyle>;
  /** Recebe o foco ao abrir a tela. */
  autoFocus?: boolean;
  /** Zoom no foco (desligue em linhas de lista). */
  scale?: boolean;
  radius?: number;
  onFocusChange?: (focused: boolean) => void;
  children: React.ReactNode | ((focused: boolean) => React.ReactNode);
}

export function Focusable({ style, focusStyle, autoFocus, scale = true, radius = 16, onFocusChange, children, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...rest}
      {...({ hasTVPreferredFocus: autoFocus, autoFocus } as any)}
      onFocus={(e) => {
        setFocused(true);
        onFocusChange?.(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onFocusChange?.(false);
        rest.onBlur?.(e);
      }}
      onHoverIn={() => {
        setFocused(true);
        onFocusChange?.(true);
      }}
      onHoverOut={() => {
        setFocused(false);
        onFocusChange?.(false);
      }}
      style={({ pressed }) => [
        { borderRadius: radius, borderWidth: 2, borderColor: 'transparent' },
        style,
        focused && {
          borderColor: colors.accent,
          shadowColor: colors.accent,
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
          transform: scale ? [{ scale: 1.05 }] : undefined,
          zIndex: 2,
        },
        focused && focusStyle,
        pressed && { opacity: 0.85 },
        // outline do navegador é substituído pela borda acima
        { outlineStyle: 'none' } as any,
      ]}
    >
      {typeof children === 'function' ? children(focused) : children}
    </Pressable>
  );
}
