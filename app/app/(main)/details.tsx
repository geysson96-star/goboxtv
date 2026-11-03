// Detalhes de filme ou série: capa grande, sinopse, temporadas e episódios.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Focusable } from '../../src/components/Focusable';
import { Button, Empty, H1, Muted, T } from '../../src/components/ui';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';
import { useFocusArt } from '../../src/store/focusArt';
import { findMovie, findSeries } from '../../src/lib/selectors';
import { loadXtreamSeriesInfo } from '../../src/lib/xtream';
import { enrich, Meta } from '../../src/lib/tmdb';
import type { Episode } from '../../src/lib/types';
import { colorFor, colors } from '../../src/theme';
import { useIsPhone } from '../../src/lib/layout';

export default function Details() {
  const { type, id } = useLocalSearchParams<{ type: 'movie' | 'series'; id: string }>();
  const catalog = useCatalog((s) => s.catalog);
  const { sources, progress } = useSettings();
  const setArt = useFocusArt((s) => s.setArt);
  const movie = type === 'movie' ? findMovie(catalog, id) : undefined;
  const series = type === 'series' ? findSeries(catalog, id) : undefined;
  const [seasons, setSeasons] = useState(series?.seasons || {});
  const [loadingEps, setLoadingEps] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const seasonNums = useMemo(() => Object.keys(seasons).map(Number).sort((a, b) => a - b), [seasons]);
  const [season, setSeason] = useState<number | null>(null);
  const item = movie || series;
  const phone = useIsPhone();

  useEffect(() => {
    if (!item) return;
    enrich(item.title, movie ? 'movie' : 'tv', movie?.year).then(setMeta);
    if (series?.lazy && !Object.keys(series.seasons).length) {
      const src = sources.find((s) => s.id === series.lazy!.sourceId);
      if (src) {
        setLoadingEps(true);
        loadXtreamSeriesInfo(src, series.lazy.seriesId).then(setSeasons).catch(() => {}).finally(() => setLoadingEps(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const poster = item?.poster || meta?.poster;
  const backdrop = item?.backdrop || meta?.backdrop || poster;
  const plot = item?.plot || meta?.plot;
  const rating = item?.rating || meta?.rating;

  useEffect(() => {
    if (item) setArt({ key: 'd' + item.id, image: backdrop, title: item.title, color: colorFor(item.id) });
  }, [item?.id, backdrop]);

  if (!item) return <Empty title="Não encontrado" hint="Este item não está mais nas suas listas." />;

  const cur = season ?? seasonNums[0];
  const episodes: Episode[] = (cur != null && seasons[cur]) || [];
  const lastEp = Object.values(progress).filter((p) => p.seriesId === series?.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];

  const playMovie = () => router.push({ pathname: '/player', params: { type: 'movie', id: movie!.id } });
  const playEp = (ep: Episode) => {
    // guarda os episódios carregados sob demanda para o player achar
    useCatalog.setState((s) => ({ catalog: { ...s.catalog, series: s.catalog.series.map((x) => (x.id === series!.id ? { ...x, seasons } : x)) } }));
    router.push({ pathname: '/player', params: { type: 'episode', id: ep.id, seriesId: series!.id } });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: phone ? 16 : 28, gap: 18 }}>
      <View style={{ height: phone ? 260 : 300, justifyContent: 'flex-end', gap: 10, maxWidth: 640 }}>
        <Muted>{movie ? 'Filme' : 'Série'} › {item.region} › {item.genre}</Muted>
        <H1 numberOfLines={2} style={{ fontSize: phone ? 30 : 46 }}>{item.title}</H1>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(movie?.year || meta?.year) ? <T style={{ fontWeight: '600' }}>{movie?.year || meta?.year}</T> : null}
          {series ? <T style={{ fontWeight: '600' }}>{seasonNums.length} temporada{seasonNums.length === 1 ? '' : 's'}</T> : null}
          {rating ? <T style={{ fontWeight: '700', color: colors.yellow }}>★ {rating}</T> : null}
        </View>
        {plot ? <Muted numberOfLines={4} style={{ fontSize: 15, color: '#C3CCDA' }}>{plot}</Muted> : null}
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 6 }}>
          {movie ? <Button variant="primary" icon="play" label={progress[movie.id] ? 'Continuar' : 'Assistir'} onPress={playMovie} autoFocus /> : null}
          {series && lastEp ? (
            <Button variant="primary" icon="play" label={`Continuar ${lastEp.subtitle || ''}`} autoFocus onPress={() => router.push({ pathname: '/player', params: { type: 'episode', id: lastEp.id, seriesId: series.id } })} />
          ) : null}
        </View>
      </View>

      {series ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {seasonNums.map((n) => (
              <Button key={n} small variant={n === cur ? 'primary' : 'glass'} label={`Temporada ${n}`} onPress={() => setSeason(n)} autoFocus={!lastEp && n === seasonNums[0]} />
            ))}
          </View>
          {loadingEps ? <ActivityIndicator color={colors.accent} /> : null}
          <FlatList
            horizontal
            data={episodes}
            keyExtractor={(e) => e.id}
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            contentContainerStyle={{ padding: 6 }}
            renderItem={({ item: ep }) => {
              const p = progress[ep.id];
              return (
                <View style={{ width: 250, gap: 8 }}>
                  <Focusable onPress={() => playEp(ep)}>
                    <View style={{ height: 140, borderRadius: 14, backgroundColor: colorFor(ep.id), overflow: 'hidden', padding: 12, justifyContent: 'flex-end' }}>
                      <T style={{ fontSize: 28, fontWeight: '800', opacity: 0.85 }}>{ep.episode}</T>
                      {p ? (
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                          <View style={{ width: `${Math.min(100, Math.round((p.position / (p.duration || 1)) * 100))}%`, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />
                        </View>
                      ) : null}
                    </View>
                  </Focusable>
                  <T numberOfLines={1} style={{ fontWeight: '700' }}>{ep.episode}. {ep.title}</T>
                </View>
              );
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
