// Ao Vivo: filtros por região e gênero, lista de canais com "agora/a seguir" e prévia.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '../../src/components/Focusable';
import { GlassSurface } from '../../src/components/GlassSurface';
import { VideoPlayer } from '../../src/components/VideoPlayer';
import { Button, ChannelLogo, Chips, Empty, H1, H2, Muted, SideItem, T } from '../../src/components/ui';
import { useIsPhone } from '../../src/lib/layout';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';
import { useFocusArt } from '../../src/store/focusArt';
import { groupBy } from '../../src/lib/catalog';
import { hhmm, nowNext, programmesFor } from '../../src/lib/selectors';
import type { Channel } from '../../src/lib/types';
import { colors, healthColor } from '../../src/theme';

const ALL = 'Todos';

export default function Live() {
  const { catalog, epg, status } = useCatalog();
  const { favorites, toggleFavorite, reduceEffects, lockedGenres, parentalPin } = useSettings();
  const setArt = useFocusArt((s) => s.setArt);
  const [region, setRegion] = useState<string>(ALL);
  const [genre, setGenre] = useState<string>(ALL);
  const [focused, setFocused] = useState<Channel | null>(null);
  const [preview, setPreview] = useState<Channel | null>(null);
  const phone = useIsPhone();

  const visible = useMemo(() => catalog.channels.filter((c) => !(parentalPin && lockedGenres.includes(c.genre))), [catalog, parentalPin, lockedGenres]);
  const regions = useMemo(() => groupBy(visible, (c) => c.region), [visible]);
  const inRegion = useMemo(() => (region === ALL ? visible : visible.filter((c) => c.region === region)), [visible, region]);
  const genres = useMemo(() => groupBy(inRegion, (c) => c.genre).sort((a, b) => b.items.length - a.items.length), [inRegion]);
  const list = useMemo(() => {
    const base = genre === ALL ? inRegion : genre === 'Favoritos' ? inRegion.filter((c) => favorites.includes(c.id)) : inRegion.filter((c) => c.genre === genre);
    return base;
  }, [inRegion, genre, favorites]);

  // Prévia: começa a tocar quando o foco para num canal por ~1 s.
  useEffect(() => {
    if (!focused || reduceEffects || phone) return;
    const t = setTimeout(() => setPreview(focused), 1100);
    return () => clearTimeout(t);
  }, [focused, reduceEffects]);

  const sel = focused || list[0];
  const progs = programmesFor(epg, sel).filter((p) => p.stop > Date.now()).slice(0, 5);

  const renderChannel = ({ item, index }: { item: Channel; index: number }) => {
    const { now } = nowNext(epg, item);
    const worst = item.streams.every((s) => status[s.sourceId]?.health === 'offline') ? 'offline' : item.streams.some((s) => status[s.sourceId]?.health === 'online') ? 'online' : 'unknown';
    return (
      <Focusable
        scale={false}
        radius={18}
        autoFocus={index === 0}
        onPress={() => router.push({ pathname: '/player', params: { type: 'channel', id: item.id } })}
        onLongPress={() => toggleFavorite(item.id)}
        onFocusChange={(f) => {
          if (!f) return;
          setFocused(item);
          setArt({ key: item.id, image: now?.icon, title: item.name, subtitle: now ? `Agora: ${now.title}` : undefined, description: now?.desc });
        }}
        style={{ marginBottom: 6 }}
      >
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <T style={{ width: 36, color: colors.muted, fontWeight: '700' }}>{item.number}</T>
          <ChannelLogo id={item.id} name={item.name} logo={item.logo} />
          <View style={{ flex: 1, gap: 2 }}>
            <T numberOfLines={1} style={{ fontWeight: '700' }}>{item.name}</T>
            <Muted numberOfLines={1}>{now ? `Agora: ${now.title}` : `${item.genre} · ${item.streams.length} fonte${item.streams.length > 1 ? 's' : ''}`}</Muted>
          </View>
          {favorites.includes(item.id) ? <Ionicons name="heart" size={16} color={colors.accent} /> : null}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: healthColor[worst] }} />
        </View>
      </Focusable>
    );
  };

  if (phone) {
    return (
      <View style={{ flex: 1, padding: 14, gap: 8 }}>
        <H1 style={{ fontSize: 26 }}>Ao Vivo</H1>
        <Chips items={[{ label: ALL, count: visible.length }, ...regions.map((r) => ({ label: r.name, count: r.items.length }))]} active={region} onPick={(r) => { setRegion(r); setGenre(ALL); }} />
        <Chips items={[{ label: ALL }, { label: 'Favoritos' }, ...genres.map((g) => ({ label: g.name, count: g.items.length }))]} active={genre} onPick={setGenre} />
        {list.length ? (
          <FlatList data={list} keyExtractor={(c) => c.id} renderItem={renderChannel} initialNumToRender={12} windowSize={7} removeClippedSubviews getItemLayout={(_, i) => ({ length: 70, offset: 70 * i, index: i })} />
        ) : (
          <Empty title="Nenhum canal aqui" hint="Escolha outra região ou gênero." />
        )}
        <Muted>Toque para assistir · segure para favoritar.</Muted>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', padding: 16, gap: 16 }}>
      <GlassSurface strength="soft" style={{ width: 230, borderRadius: 24, padding: 12 }}>
        <ScrollView contentContainerStyle={{ gap: 2 }}>
          <Muted style={{ fontWeight: '700', letterSpacing: 1, padding: 8 }}>REGIÃO</Muted>
          <SideItem label={ALL} count={visible.length} active={region === ALL} onPress={() => { setRegion(ALL); setGenre(ALL); }} />
          {regions.map((r) => (
            <SideItem key={r.name} label={r.name} count={r.items.length} active={region === r.name} onPress={() => { setRegion(r.name); setGenre(ALL); }} />
          ))}
          <Muted style={{ fontWeight: '700', letterSpacing: 1, padding: 8, paddingTop: 18 }}>GÊNERO</Muted>
          <SideItem label={ALL} active={genre === ALL} onPress={() => setGenre(ALL)} />
          <SideItem label="Favoritos" count={inRegion.filter((c) => favorites.includes(c.id)).length} active={genre === 'Favoritos'} onPress={() => setGenre('Favoritos')} />
          {genres.map((g) => (
            <SideItem key={g.name} label={g.name} count={g.items.length} active={genre === g.name} onPress={() => setGenre(g.name)} />
          ))}
        </ScrollView>
      </GlassSurface>

      <View style={{ flex: 1, minWidth: 300 }}>
        <H1 style={{ fontSize: 26, marginBottom: 10 }}>{region === ALL ? 'Todos os canais' : region}{genre !== ALL ? ` · ${genre}` : ''}</H1>
        {list.length ? (
          <FlatList data={list} keyExtractor={(c) => c.id} renderItem={renderChannel} initialNumToRender={12} windowSize={7} removeClippedSubviews getItemLayout={(_, i) => ({ length: 70, offset: 70 * i, index: i })} />
        ) : (
          <Empty title="Nenhum canal aqui" hint="Escolha outra região ou gênero." />
        )}
        <Muted style={{ paddingTop: 6 }}>Segure OK num canal para favoritar.</Muted>
      </View>

      <View style={{ width: 400, gap: 14 }}>
        <View style={{ height: 225, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B1220', borderWidth: 1, borderColor: colors.glassBorder }}>
          {preview && !reduceEffects ? <VideoPlayer key={preview.id} streams={preview.streams} live /> : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Muted>{reduceEffects ? 'Prévia desligada (Reduzir efeitos)' : 'Pare num canal para ver a prévia'}</Muted>
            </View>
          )}
        </View>
        {sel ? (
          <GlassSurface style={{ borderRadius: 22, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <H2 style={{ fontSize: 16 }}>{sel.name}</H2>
              <Button small label="Programação" onPress={() => router.push({ pathname: '/schedule', params: { channel: sel.id } })} />
            </View>
            {progs.length ? (
              progs.map((p, i) => (
                <View key={p.start} style={{ flexDirection: 'row', gap: 12 }}>
                  <T style={{ width: 48, fontWeight: '700', color: i === 0 && p.start <= Date.now() ? colors.accent : colors.muted }}>{hhmm(p.start)}</T>
                  <T numberOfLines={1} style={{ flex: 1 }}>{p.title}</T>
                </View>
              ))
            ) : (
              <Muted>Sem guia de programação para este canal.</Muted>
            )}
          </GlassSurface>
        ) : null}
      </View>
    </View>
  );
}
