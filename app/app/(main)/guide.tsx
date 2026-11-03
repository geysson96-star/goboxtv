// Guia de TV: grade com canais nas linhas e horários nas colunas.
import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Focusable } from '../../src/components/Focusable';
import { GlassSurface } from '../../src/components/GlassSurface';
import { Button, ChannelLogo, Empty, H1, Muted, Pill, T } from '../../src/components/ui';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';
import { useFocusArt } from '../../src/store/focusArt';
import { hhmm, programmesFor } from '../../src/lib/selectors';
import type { Channel, Programme } from '../../src/lib/types';
import { colors } from '../../src/theme';
import { useIsPhone } from '../../src/lib/layout';



export default function Guide() {
  const { catalog, epg } = useCatalog();
  const { reminders, toggleReminder } = useSettings();
  const setArt = useFocusArt((s) => s.setArt);
  const phone = useIsPhone();
  const SPAN = (phone ? 2 : 3) * 3600e3;
  const NAME_W = phone ? 110 : 200;
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
    return d.getTime() - 30 * 60e3;
  });
  const [sel, setSel] = useState<{ ch: Channel; p: Programme } | null>(null);
  const [width, setWidth] = useState(800);
  const end = start + SPAN;
  const now = Date.now();

  const channels = useMemo(() => catalog.channels.filter((c) => c.tvgId && epg[c.tvgId]?.length), [catalog, epg]);
  const ticks = Array.from({ length: 6 }, (_, i) => start + i * 30 * 60e3);
  const pxPerMs = (width - NAME_W) / SPAN;

  const press = (ch: Channel, p: Programme) => {
    if (p.start <= now && p.stop > now) router.push({ pathname: '/player', params: { type: 'channel', id: ch.id } });
    else if (p.start > now) toggleReminder({ key: `${ch.id}:${p.start}`, channelId: ch.id, channelName: ch.name, title: p.title, start: p.start });
  };

  const renderRow = ({ item: ch }: { item: Channel }) => {
    const progs = programmesFor(epg, ch).filter((p) => p.stop > start && p.start < end);
    return (
      <View style={{ height: 56, flexDirection: 'row', marginBottom: 6 }}>
        <View style={{ width: NAME_W - 6, marginRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {phone ? null : <Muted style={{ fontWeight: '700' }}>{ch.number}</Muted>}
          <ChannelLogo id={ch.id} name={ch.name} logo={ch.logo} size={30} />
          <T numberOfLines={phone ? 2 : 1} style={{ flex: 1, fontWeight: '700', fontSize: 14 }}>{ch.name}</T>
        </View>
        <View style={{ flex: 1 }}>
          {progs.map((p) => {
            const s = Math.max(p.start, start);
            const e = Math.min(p.stop, end);
            const live = p.start <= now && p.stop > now;
            const past = p.stop <= now;
            const rem = reminders.some((r) => r.key === `${ch.id}:${p.start}`);
            return (
              <Focusable
                key={p.start}
                scale={false}
                radius={12}
                onPress={() => press(ch, p)}
                onFocusChange={(f) => {
                  if (!f) return;
                  setSel({ ch, p });
                  setArt({ key: ch.id + p.start, image: p.icon, title: p.title, subtitle: `${ch.name} · ${hhmm(p.start)}–${hhmm(p.stop)}`, description: p.desc });
                }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: (s - start) * pxPerMs, width: Math.max(4, (e - s) * pxPerMs - 4) }}
              >
                <View style={{ flex: 1, borderRadius: 10, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: live ? 'rgba(92,200,255,0.18)' : past ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)' }}>
                  <T numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: past ? colors.dim : colors.text }}>{rem ? '● ' : ''}{p.title}</T>
                  <Muted numberOfLines={1} style={{ fontSize: 11 }}>{hhmm(p.start)} – {hhmm(p.stop)}</Muted>
                </View>
              </Focusable>
            );
          })}
        </View>
      </View>
    );
  };

  const nowX = (now - start) * pxPerMs;

  return (
    <View style={{ flex: 1, padding: 20, gap: 14 }}>
      <View style={{ height: 170, justifyContent: 'flex-end', gap: 8, maxWidth: 620 }}>
        {sel ? (
          <>
            <Pill label={sel.p.start <= now && sel.p.stop > now ? 'AGORA' : sel.p.start > now ? 'A SEGUIR' : 'EXIBIDO'} color={sel.p.start > now ? colors.yellow : colors.accent} />
            <H1 numberOfLines={1}>{sel.p.title}</H1>
            <Muted numberOfLines={2} style={{ fontSize: 14 }}>{sel.ch.name} · {hhmm(sel.p.start)}–{hhmm(sel.p.stop)}{sel.p.desc ? ` — ${sel.p.desc}` : ''}</Muted>
          </>
        ) : (
          <H1>Guia de TV</H1>
        )}
      </View>

      <GlassSurface strength="soft" style={{ flex: 1, borderRadius: 24, padding: 12 }}>
        <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={{ height: 34, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: NAME_W, flexDirection: 'row', gap: 6 }}>
              <Button small icon="chevron-back" onPress={() => setStart(start - SPAN / 2)} />
              <Button small icon="chevron-forward" onPress={() => setStart(start + SPAN / 2)} />
            </View>
            {ticks.map((t) => (
              <Muted key={t} style={{ position: 'absolute', left: NAME_W + (t - start) * pxPerMs, fontWeight: '700' }}>{hhmm(t)}</Muted>
            ))}
          </View>
          {channels.length ? (
            <View style={{ flex: 1 }}>
              <FlatList data={channels} keyExtractor={(c) => c.id} renderItem={renderRow} initialNumToRender={10} windowSize={5} removeClippedSubviews getItemLayout={(_, i) => ({ length: 62, offset: 62 * i, index: i })} />
              {nowX > 0 && nowX < width - NAME_W ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: NAME_W + nowX, width: 2, backgroundColor: colors.red }} />
              ) : null}
            </View>
          ) : (
            <Empty title="Guia ainda não disponível" hint="Assim que as listas trouxerem um guia XMLTV, a grade aparece aqui." />
          )}
        </View>
      </GlassSurface>
    </View>
  );
}
