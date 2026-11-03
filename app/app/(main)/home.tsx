import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { HeroInfo } from '../../src/components/HeroInfo';
import { Button, CardItem, Empty, Muted, Row } from '../../src/components/ui';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';
import { hhmm, nowNext } from '../../src/lib/selectors';
import { colors } from '../../src/theme';
import { useIsPhone } from '../../src/lib/layout';

export default function Home() {
  const { catalog, epg, loading } = useCatalog();
  const progress = useSettings((s) => s.progress);
  const favorites = useSettings((s) => s.favorites);
  const phone = useIsPhone();

  const continuar: CardItem[] = useMemo(
    () =>
      Object.values(progress)
        .filter((p) => p.duration > 0 && p.position / p.duration < 0.95)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 15)
        .map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle ? `${p.subtitle} · faltam ${Math.max(1, Math.round((p.duration - p.position) / 60))} min` : `faltam ${Math.max(1, Math.round((p.duration - p.position) / 60))} min`,
          image: p.image,
          progress: p.position / p.duration,
        })),
    [progress],
  );

  const channelCard = (c: (typeof catalog.channels)[number]): CardItem => {
    const { now, next } = nowNext(epg, c);
    return {
      id: c.id,
      title: c.name,
      subtitle: now ? `Agora: ${now.title}` : `${c.region} · ${c.genre}`,
      description: now ? `${now.desc || ''}${next ? `\nA seguir ${hhmm(next.start)}: ${next.title}` : ''}` : undefined,
      image: c.logo,
      backdrop: now?.icon,
    };
  };

  const favs = useMemo(() => catalog.channels.filter((c) => favorites.includes(c.id)).map(channelCard), [catalog, favorites, epg]);
  const live = useMemo(() => catalog.channels.slice(0, 30).map(channelCard), [catalog, epg]);
  const movies = useMemo(
    () => catalog.movies.slice(0, 30).map((m) => ({ id: m.id, title: m.title, subtitle: [m.year, m.genre].filter(Boolean).join(' · '), image: m.poster, backdrop: m.backdrop, description: m.plot })),
    [catalog],
  );
  const series = useMemo(
    () => catalog.series.slice(0, 30).map((s) => ({ id: s.id, title: s.title, subtitle: s.genre, image: s.poster, backdrop: s.backdrop, description: s.plot })),
    [catalog],
  );

  const openChannel = (it: CardItem) => router.push({ pathname: '/player', params: { type: 'channel', id: it.id } });
  const openProgress = (it: CardItem) => {
    const p = progress[it.id];
    if (p?.seriesId) router.push({ pathname: '/player', params: { type: 'episode', id: it.id, seriesId: p.seriesId } });
    else router.push({ pathname: '/player', params: { type: 'movie', id: it.id } });
  };

  const empty = !catalog.channels.length && !catalog.movies.length;

  return (
    <ScrollView contentContainerStyle={{ padding: phone ? 16 : 28, paddingTop: phone ? 12 : 24, gap: phone ? 20 : 26 }}>
      <HeroInfo fallbackTitle="Bem-vindo" fallbackText="Escolha um canal, filme ou série. A capa e a descrição aparecem aqui conforme o item em foco." />
      {loading && empty ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
          <Muted>Carregando suas listas…</Muted>
        </View>
      ) : null}
      {!loading && empty ? (
        <View style={{ alignItems: 'flex-start', gap: 12 }}>
          <Empty title="Nenhuma lista carregada" hint="Confira sua internet ou adicione uma lista em Configurações › Minhas listas." />
          <Button variant="primary" label="Abrir Minhas listas" onPress={() => router.navigate('/settings')} autoFocus />
        </View>
      ) : null}
      <Row title="Continuar assistindo" items={continuar} shape="wide" onPress={openProgress} autoFocusFirst />
      <Row title="Meus canais favoritos" items={favs} shape="logo" onPress={openChannel} autoFocusFirst={!continuar.length} />
      <Row title="Canais ao vivo" items={live} shape="logo" onPress={openChannel} autoFocusFirst={!continuar.length && !favs.length} />
      <Row title="Filmes" items={movies} onPress={(it) => router.push({ pathname: '/details', params: { type: 'movie', id: it.id } })} />
      <Row title="Séries" items={series} onPress={(it) => router.push({ pathname: '/details', params: { type: 'series', id: it.id } })} />
    </ScrollView>
  );
}
