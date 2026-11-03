// Programação: escolha o canal e o dia (hoje e próximos) e veja o que passa e em que horário.
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '../../src/components/Focusable';
import { GlassSurface } from '../../src/components/GlassSurface';
import { Button, ChannelLogo, Chips, Empty, H1, Muted, Pill, T } from '../../src/components/ui';
import { useIsPhone } from '../../src/lib/layout';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';
import { dayLabel, hhmm, programmesFor } from '../../src/lib/selectors';
import type { Channel, Programme } from '../../src/lib/types';
import { colorFor, colors } from '../../src/theme';

export default function Schedule() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const { catalog, epg } = useCatalog();
  const { reminders, toggleReminder } = useSettings();
  const withGuide = useMemo(() => catalog.channels.filter((c) => c.tvgId && epg[c.tvgId]?.length), [catalog, epg]);
  const [channelId, setChannelId] = useState<string | undefined>(params.channel);
  const channel: Channel | undefined = catalog.channels.find((c) => c.id === channelId) || withGuide[0];
  const [day, setDay] = useState(0);
  const [selKey, setSelKey] = useState<number | null>(null);
  const phone = useIsPhone();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => dayLabel(i)), []);
  const all = programmesFor(epg, channel);
  const list = all.filter((p) => p.stop > days[day].start && p.start < days[day].end);
  const now = Date.now();
  const current = list.find((p) => p.start <= now && p.stop > now);
  const sel: Programme | undefined = list.find((p) => p.start === selKey) || current || list.find((p) => p.start > now) || list[0];

  const remKey = (p: Programme) => `${channel?.id}:${p.start}`;
  const hasRem = (p: Programme) => reminders.some((r) => r.key === remKey(p));

  const action = (p: Programme) => {
    if (!channel) return;
    if (p.start <= now && p.stop > now) router.push({ pathname: '/player', params: { type: 'channel', id: channel.id } });
    else if (p.start > now) toggleReminder({ key: remKey(p), channelId: channel.id, channelName: channel.name, title: p.title, start: p.start });
  };

  const programmeRow = (p: Programme) => {
    const past = p.stop <= now;
    const live = p.start <= now && p.stop > now;
    return (
      <Focusable key={p.start} scale={false} radius={14} autoFocus={!!channelId && p === current} onFocusChange={(f) => f && setSelKey(p.start)} onPress={() => (phone ? setSelKey(p.start) : action(p))} style={{ marginBottom: 4 }}>
        <View style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: phone ? 10 : 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: selKey === p.start && phone ? 'rgba(92,200,255,0.14)' : live ? 'rgba(248,113,113,0.08)' : 'transparent' }}>
          <T style={{ width: phone ? 54 : 110, fontWeight: '800', color: past ? colors.dim : colors.text }}>
            {hhmm(p.start)}{phone ? '' : <Muted> – {hhmm(p.stop)}</Muted>}
          </T>
          <T numberOfLines={phone ? 2 : 1} style={{ flex: 1, fontWeight: '700', color: past ? colors.dim : colors.text }}>{p.title}</T>
          {p.category && !phone ? <Muted style={{ width: 120 }} numberOfLines={1}>{p.category}</Muted> : null}
          {live ? <Pill label="NO AR" color={colors.red} /> : past ? <Muted>Exibido</Muted> : (
            <Ionicons name={hasRem(p) ? 'notifications' : 'notifications-outline'} size={18} color={hasRem(p) ? colors.accent : colors.muted} />
          )}
        </View>
      </Focusable>
    );
  };

  const hero = (
    <View style={{ height: phone ? 170 : 210, borderRadius: 24, overflow: 'hidden', backgroundColor: channel ? colorFor(channel.id) : '#0B1022', borderWidth: 1, borderColor: colors.glassBorder }}>
      {sel?.icon ? <Image source={{ uri: sel.icon }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '60%' }} contentFit="cover" transition={250} /> : null}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: phone ? '100%' : '70%', backgroundColor: 'rgba(7,10,18,0.82)' }} />
      <View style={{ padding: phone ? 16 : 22, gap: 8, maxWidth: 560 }}>
        {sel ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill label={sel.start <= now && sel.stop > now ? 'NO AR' : sel.stop <= now ? 'EXIBIDO' : 'A SEGUIR'} color={sel.start <= now && sel.stop > now ? colors.red : colors.accent} />
              <Muted>{days[day].name} · {hhmm(sel.start)}–{hhmm(sel.stop)}{sel.category ? ` · ${sel.category}` : ''}</Muted>
            </View>
            <H1 numberOfLines={1} style={{ fontSize: phone ? 22 : 32 }}>{sel.title}</H1>
            <Muted numberOfLines={2} style={{ fontSize: 14, color: '#C3CCDA' }}>{sel.desc || channel?.name}</Muted>
            {sel.stop > now ? (
              <View style={{ flexDirection: 'row' }}>
                <Button small variant="primary" label={sel.start <= now ? 'Assistir agora' : hasRem(sel) ? 'Lembrete ativo · remover' : `Lembrar às ${hhmm(sel.start)}`} onPress={() => action(sel)} />
              </View>
            ) : null}
          </>
        ) : (
          <T style={{ fontWeight: '700' }}>{channel ? channel.name : 'Escolha um canal'}</T>
        )}
      </View>
    </View>
  );

  if (phone) {
    return (
      <View style={{ flex: 1, padding: 14, gap: 10 }}>
        <H1 style={{ fontSize: 26 }}>Programação</H1>
        {withGuide.length ? (
          <FlatList
            horizontal
            data={withGuide}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <Focusable scale={false} radius={16} onPress={() => { setChannelId(item.id); setSelKey(null); }}>
                <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: channel?.id === item.id ? 'rgba(92,200,255,0.2)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: channel?.id === item.id ? colors.accent : 'rgba(255,255,255,0.12)' }}>
                  <ChannelLogo id={item.id} name={item.name} logo={item.logo} size={28} />
                  <T numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, maxWidth: 140 }}>{item.name}</T>
                </View>
              </Focusable>
            )}
          />
        ) : (
          <Muted>Nenhum canal com guia ainda.</Muted>
        )}
        {hero}
        <Chips items={days.map((d) => ({ label: d.name }))} active={days[day].name} onPick={(n) => { setDay(days.findIndex((d) => d.name === n)); setSelKey(null); }} />
        <GlassSurface strength="soft" style={{ flex: 1, borderRadius: 20, padding: 8 }}>
          {list.length ? <ScrollView>{list.map(programmeRow)}</ScrollView> : <Empty title="Sem programação para este dia" />}
        </GlassSurface>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', padding: 16, gap: 16 }}>
      <GlassSurface strength="soft" style={{ width: 260, borderRadius: 24, padding: 12 }}>
        <H1 style={{ fontSize: 22, padding: 8 }}>Programação</H1>
        {withGuide.length ? (
          <FlatList
            data={withGuide}
            keyExtractor={(c) => c.id}
            initialNumToRender={14}
            renderItem={({ item, index }) => (
              <Focusable scale={false} radius={16} autoFocus={!channelId && index === 0} onPress={() => { setChannelId(item.id); setSelKey(null); }} style={{ marginBottom: 4 }}>
                <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: channel?.id === item.id ? 'rgba(92,200,255,0.16)' : 'transparent' }}>
                  <ChannelLogo id={item.id} name={item.name} logo={item.logo} size={32} />
                  <T numberOfLines={1} style={{ flex: 1, fontWeight: '700', fontSize: 14 }}>{item.name}</T>
                  <Muted>{item.number}</Muted>
                </View>
              </Focusable>
            )}
          />
        ) : (
          <Muted style={{ padding: 8 }}>Nenhum canal com guia ainda. O guia é baixado junto com as listas; se sua lista não traz um, adicione o endereço XMLTV em Minhas listas.</Muted>
        )}
      </GlassSurface>

      <View style={{ flex: 1, gap: 12 }}>
        {hero}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {days.map((d, i) => (
            <Focusable key={i} style={{ flex: 1 }} scale={false} radius={16} onPress={() => { setDay(i); setSelKey(null); }}>
              <GlassSurface strength={i === day ? 'strong' : 'soft'} tint={i === day ? 'rgba(92,200,255,0.2)' : undefined} style={{ height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontWeight: '700', fontSize: 14 }}>{d.name}</T>
                <Muted style={{ fontSize: 11 }}>{d.short}</Muted>
              </GlassSurface>
            </Focusable>
          ))}
        </View>

        <GlassSurface strength="soft" style={{ flex: 1, borderRadius: 22, padding: 10 }}>
          {list.length ? (
            <ScrollView>{list.map(programmeRow)}
            </ScrollView>
          ) : (
            <Empty title="Sem programação para este dia" hint="O guia deste canal pode não cobrir todos os dias." />
          )}
        </GlassSurface>
      </View>
    </View>
  );
}
