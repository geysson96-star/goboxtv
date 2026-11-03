// Player em tela cheia: canal ao vivo (com mini-guia e troca de canal) ou filme/episódio (com progresso).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { PlayerHandle, VideoPlayer } from '../src/components/VideoPlayer';
import { GlassSurface } from '../src/components/GlassSurface';
import { Button, ChannelLogo, Empty, Muted, Pill, T } from '../src/components/ui';
import { useCatalog } from '../src/store/catalog';
import { useSettings } from '../src/store/settings';
import { findChannel, findEpisode, findMovie, findSeries, hhmm, nowNext } from '../src/lib/selectors';
import type { Episode, StreamSource } from '../src/lib/types';
import { colors } from '../src/theme';
import { useIsPhone } from '../src/lib/layout';

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function Player() {
  useKeepAwake();
  const params = useLocalSearchParams<{ type: 'channel' | 'movie' | 'episode'; id: string; seriesId?: string }>();
  const { catalog, epg } = useCatalog();
  const { progress, saveProgress } = useSettings();
  const ref = useRef<PlayerHandle>(null);
  const [id, setId] = useState(params.id);
  const [overlay, setOverlay] = useState(true);
  const [time, setTime] = useState({ pos: 0, dur: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSave = useRef(0);
  const phone = useIsPhone();

  const type = params.type;
  const channel = type === 'channel' ? findChannel(catalog, id) : undefined;
  const movie = type === 'movie' ? findMovie(catalog, id) : undefined;
  const series = type === 'episode' && params.seriesId ? findSeries(catalog, params.seriesId) : undefined;
  const episode = series ? findEpisode(series, id) : undefined;

  const allEpisodes: Episode[] = useMemo(() => {
    if (!series) return [];
    return Object.keys(series.seasons).map(Number).sort((a, b) => a - b).flatMap((s) => series.seasons[s]);
  }, [series]);
  const nextEpisode = episode ? allEpisodes[allEpisodes.findIndex((e) => e.id === episode.id) + 1] : undefined;

  const streams: StreamSource[] = channel?.streams || movie?.streams || episode?.streams || [];
  const title = channel?.name || movie?.title || (series && episode ? series.title : '');
  const subtitle = episode ? `T${episode.season} · E${episode.episode} — ${episode.title}` : movie?.year;
  const { now, next } = nowNext(epg, channel);

  const poke = useCallback(() => {
    setOverlay(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOverlay(false), 5000);
  }, []);

  useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [id]);

  const zap = (dir: 1 | -1) => {
    if (!channel) return;
    const i = catalog.channels.findIndex((c) => c.id === channel.id);
    const n = catalog.channels[(i + dir + catalog.channels.length) % catalog.channels.length];
    if (n) setId(n.id);
  };

  const onTime = useCallback(
    (pos: number, dur: number) => {
      setTime({ pos, dur });
      if (type === 'channel' || !dur) return;
      if (Date.now() - lastSave.current < 10000) return;
      lastSave.current = Date.now();
      saveProgress({
        id,
        position: pos,
        duration: dur,
        updatedAt: Date.now(),
        title: movie?.title || series?.title || '',
        subtitle: episode ? `T${episode.season} · E${episode.episode}` : undefined,
        image: movie?.backdrop || movie?.poster || series?.backdrop || series?.poster,
        seriesId: series?.id,
      });
    },
    [id, type, movie, series, episode],
  );

  const onEnd = useCallback(() => {
    if (nextEpisode) setId(nextEpisode.id);
  }, [nextEpisode]);

  if (!streams.length) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Empty title="Conteúdo indisponível" hint="Este item não está mais nas listas ligadas." />
        <Button label="Voltar" onPress={() => router.back()} autoFocus />
      </View>
    );
  }

  const startAt = type !== 'channel' ? progress[id]?.position : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <VideoPlayer ref={ref} key={id} streams={streams} live={type === 'channel'} startAt={startAt} onTime={onTime} onEnd={onEnd} />
      <Pressable style={StyleSheet.absoluteFill} onPress={poke} focusable={!overlay} {...({ hasTVPreferredFocus: !overlay } as any)} onFocus={poke} />

      {overlay ? (
        <View style={{ position: 'absolute', left: phone ? 10 : 24, right: phone ? 10 : 24, bottom: phone ? 14 : 24, gap: 12 }} pointerEvents="box-none">
          <GlassSurface strength="strong" style={{ borderRadius: 26, padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {channel ? <ChannelLogo id={channel.id} name={channel.name} logo={channel.logo} size={48} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {channel ? <Pill label="AO VIVO" color={colors.red} /> : null}
                  <T numberOfLines={1} style={{ fontSize: 20, fontWeight: '800' }}>{channel ? `${channel.number} · ${title}` : title}</T>
                </View>
                {channel ? (
                  <Muted numberOfLines={1} style={{ fontSize: 14 }}>
                    {now ? `Agora: ${now.title} (${hhmm(now.start)}–${hhmm(now.stop)})` : 'Sem guia para este canal'}
                    {next ? `   ·   A seguir ${hhmm(next.start)}: ${next.title}` : ''}
                  </Muted>
                ) : subtitle ? (
                  <Muted style={{ fontSize: 14 }}>{subtitle}</Muted>
                ) : null}
              </View>
            </View>

            {!channel && time.dur > 0 ? (
              <View style={{ gap: 6 }}>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <View style={{ width: `${Math.min(100, (time.pos / time.dur) * 100)}%`, height: 5, borderRadius: 3, backgroundColor: colors.accent }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Muted>{fmt(time.pos)}</Muted>
                  <Muted>-{fmt(time.dur - time.pos)}</Muted>
                </View>
              </View>
            ) : null}
            {channel && now ? (
              <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <View style={{ width: `${Math.min(100, ((Date.now() - now.start) / (now.stop - now.start)) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button icon="arrow-back" label="Voltar" onPress={() => router.back()} />
              {channel ? <Button icon="chevron-up" label="Canal anterior" onPress={() => { zap(-1); poke(); }} /> : <Button icon="play-back" label="10 s" onPress={() => { ref.current?.seekBy(-10); poke(); }} />}
              <Button variant="primary" icon="pause" label="Pausar / Tocar" autoFocus onPress={() => { ref.current?.togglePlay(); poke(); }} />
              {channel ? <Button icon="chevron-down" label="Próximo canal" onPress={() => { zap(1); poke(); }} /> : <Button icon="play-forward" label="30 s" onPress={() => { ref.current?.seekBy(30); poke(); }} />}
              {channel ? <Button icon="calendar-outline" label="Programação" onPress={() => router.push({ pathname: '/schedule', params: { channel: channel.id } })} /> : null}
              {nextEpisode ? <Button icon="play-skip-forward" label="Próximo episódio" onPress={() => setId(nextEpisode.id)} /> : null}
              {channel && streams.length > 1 ? <Muted style={{ alignSelf: 'center' }}>{streams.length} fontes disponíveis</Muted> : null}
            </View>
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}
