// Peças de interface reaproveitadas em todas as telas.
import React, { memo } from 'react';
import { FlatList, StyleProp, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from './Focusable';
import { GlassSurface } from './GlassSurface';
import { colorFor, colors, radius } from '../theme';
import { useFocusArt } from '../store/focusArt';

export function T({ style, ...p }: TextProps & { style?: StyleProp<TextStyle> }) {
  return <Text {...p} style={[{ color: colors.text, fontSize: 15 }, style]} />;
}

export function H1({ style, ...p }: TextProps & { style?: StyleProp<TextStyle> }) {
  return <T {...p} style={[{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }, style]} />;
}

export function H2({ style, ...p }: TextProps & { style?: StyleProp<TextStyle> }) {
  return <T {...p} style={[{ fontSize: 18, fontWeight: '700' }, style]} />;
}

export function Muted({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <T numberOfLines={numberOfLines} style={[{ color: colors.muted, fontSize: 13 }, style]}>{children}</T>;
}

export function Pill({ label, color = colors.accent, solid }: { label: string; color?: string; solid?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: color, backgroundColor: solid ? color : color + '26', alignSelf: 'flex-start' }}>
      <T style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: solid ? colors.onAccent : colors.text }}>{label}</T>
    </View>
  );
}

type BtnVariant = 'primary' | 'glass' | 'danger';
export function Button({
  label, icon, onPress, variant = 'glass', autoFocus, style, small,
}: { label?: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void; variant?: BtnVariant; autoFocus?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const h = small ? 40 : 52;
  const content = (
    <View style={{ height: h, paddingHorizontal: label ? (small ? 16 : 24) : 0, width: label ? undefined : h, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={variant === 'primary' ? colors.onAccent : colors.text} /> : null}
      {label ? <T style={{ fontWeight: '800', fontSize: small ? 13 : 15, color: variant === 'primary' ? colors.onAccent : colors.text }}>{label}</T> : null}
    </View>
  );
  return (
    <Focusable onPress={onPress} autoFocus={autoFocus} radius={h / 2} style={style} accessibilityRole="button" accessibilityLabel={label}>
      {variant === 'primary' ? (
        <View style={{ backgroundColor: colors.accent, borderRadius: h / 2 }}>{content}</View>
      ) : variant === 'danger' ? (
        <View style={{ backgroundColor: 'rgba(248,113,113,0.18)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.5)', borderRadius: h / 2 }}>{content}</View>
      ) : (
        <GlassSurface style={{ borderRadius: h / 2 }}>{content}</GlassSurface>
      )}
    </Focusable>
  );
}

/** Capa genérica para itens sem imagem: iniciais sobre cor estável. */
export function ArtFallback({ id, title, style }: { id: string; title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colorFor(id), alignItems: 'center', justifyContent: 'center', padding: 10 }, style]}>
      <T numberOfLines={3} style={{ fontWeight: '800', fontSize: 16, textAlign: 'center' }}>{title}</T>
    </View>
  );
}

export interface CardItem {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  backdrop?: string;
  description?: string;
  progress?: number; // 0..1
}

/** Cartão de filme/série/canal. Ao receber foco, troca a capa grande do fundo. */
export const PosterCard = memo(function PosterCard({
  item, onPress, shape = 'poster', autoFocus,
}: { item: CardItem; onPress: () => void; shape?: 'poster' | 'wide' | 'logo'; autoFocus?: boolean }) {
  const setArt = useFocusArt((s) => s.setArt);
  const w = shape === 'poster' ? 150 : shape === 'wide' ? 240 : 160;
  const h = shape === 'poster' ? 225 : shape === 'wide' ? 135 : 100;
  return (
    <View style={{ width: w, gap: 8 }}>
      <Focusable
        autoFocus={autoFocus}
        onPress={onPress}
        radius={radius.md}
        accessibilityLabel={item.title}
        onFocusChange={(f) => f && setArt({ key: item.id, image: item.backdrop || item.image, title: item.title, subtitle: item.subtitle, description: item.description, color: colorFor(item.id) })}
      >
        <View style={{ width: w, height: h, borderRadius: radius.md - 2, overflow: 'hidden', backgroundColor: '#111827' }}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} contentFit={shape === 'logo' ? 'contain' : 'cover'} recyclingKey={item.id} cachePolicy="memory-disk" transition={150} />
          ) : (
            <ArtFallback id={item.id} title={item.title} style={{ width: '100%', height: '100%' }} />
          )}
          {item.progress != null ? (
            <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }}>
              <View style={{ width: `${Math.round(item.progress * 100)}%`, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />
            </View>
          ) : null}
        </View>
      </Focusable>
      <T numberOfLines={1} style={{ fontWeight: '700', fontSize: 14 }}>{item.title}</T>
      {item.subtitle ? <Muted numberOfLines={1}>{item.subtitle}</Muted> : null}
    </View>
  );
});

/** Fileira horizontal virtualizada (só desenha o que está visível). */
export function Row({ title, items, onPress, shape, autoFocusFirst }: { title: string; items: CardItem[]; onPress: (item: CardItem) => void; shape?: 'poster' | 'wide' | 'logo'; autoFocusFirst?: boolean }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <H2>{title}</H2>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => <PosterCard item={item} shape={shape} onPress={() => onPress(item)} autoFocus={autoFocusFirst && index === 0} />}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 6 }}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

export function ChannelLogo({ id, name, logo, size = 40 }: { id: string; name: string; logo?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, overflow: 'hidden', backgroundColor: logo ? '#E5E7EB' : colorFor(id), alignItems: 'center', justifyContent: 'center' }}>
      {logo ? (
        <Image source={{ uri: logo }} style={{ width: '86%', height: '86%' }} contentFit="contain" cachePolicy="memory-disk" />
      ) : (
        <T style={{ fontWeight: '800', fontSize: size * 0.3 }}>{name.replace(/[^A-Za-zÀ-ú0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</T>
      )}
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 8 }}>
      <Ionicons name="tv-outline" size={36} color={colors.muted} />
      <T style={{ fontWeight: '700', fontSize: 17 }}>{title}</T>
      {hint ? <Muted style={{ textAlign: 'center', maxWidth: 420 }}>{hint}</Muted> : null}
    </View>
  );
}

/** Botão de filtro em coluna lateral (região, gênero, menu de configurações). */
export function SideItem({ label, count, active, onPress, autoFocus }: { label: string; count?: number | string; active?: boolean; onPress: () => void; autoFocus?: boolean }) {
  return (
    <Focusable onPress={onPress} scale={false} radius={14} autoFocus={autoFocus}>
      <View style={{ height: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: active ? 'rgba(92,200,255,0.16)' : 'transparent' }}>
        <T numberOfLines={1} style={{ fontWeight: '600', flex: 1, color: active ? colors.text : colors.textSoft }}>{label}</T>
        {count != null ? <Muted>{String(count)}</Muted> : null}
      </View>
    </Focusable>
  );
}

export function Toggle({ value }: { value: boolean }) {
  return (
    <View style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: value ? colors.accent : 'rgba(255,255,255,0.2)', justifyContent: 'center' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.text, marginLeft: value ? 25 : 3 }} />
    </View>
  );
}

/** Filtros em linha horizontal (celular): substituem a coluna lateral de região/gênero. */
export function Chips({ items, active, onPick }: { items: { label: string; count?: number }[]; active: string; onPick: (label: string) => void }) {
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(i) => i.label}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 4 }}
      renderItem={({ item }) => {
        const on = item.label === active;
        return (
          <Focusable scale={false} radius={18} onPress={() => onPick(item.label)}>
            <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? colors.accent : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: on ? colors.accent : 'rgba(255,255,255,0.14)' }}>
              <T style={{ fontSize: 13, fontWeight: '700', color: on ? colors.onAccent : colors.text }}>{item.label}</T>
              {item.count != null ? <T style={{ fontSize: 12, color: on ? colors.onAccent : colors.muted }}>{item.count}</T> : null}
            </View>
          </Focusable>
        );
      }}
    />
  );
}
