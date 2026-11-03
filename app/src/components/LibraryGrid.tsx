// Grade de filmes ou séries com filtros por região e gênero na lateral.
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, View, useWindowDimensions } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HeroInfo } from './HeroInfo';
import { CardItem, Chips, Empty, Muted, PosterCard, SideItem } from './ui';
import { useIsPhone } from '../lib/layout';
import { groupBy } from '../lib/catalog';
import { RAIL_SPACE } from './SideRail';

export interface LibItem extends CardItem {
  region: string;
  genre: string;
}

const ALL = 'Todos';

export function LibraryGrid({ title, items, onOpen, emptyHint }: { title: string; items: LibItem[]; onOpen: (it: LibItem) => void; emptyHint: string }) {
  const { width } = useWindowDimensions();
  const phone = useIsPhone();
  const [region, setRegion] = useState(ALL);
  const [genre, setGenre] = useState(ALL);
  const regions = useMemo(() => groupBy(items, (i) => i.region), [items]);
  const inRegion = useMemo(() => (region === ALL ? items : items.filter((i) => i.region === region)), [items, region]);
  const genres = useMemo(() => groupBy(inRegion, (i) => i.genre).sort((a, b) => b.items.length - a.items.length), [inRegion]);
  const list = genre === ALL ? inRegion : inRegion.filter((i) => i.genre === genre);

  const gridW = phone ? width - 28 : width - RAIL_SPACE - 230 - 16 * 3;
  const cols = Math.max(2, Math.floor(gridW / 166));

  if (phone) {
    return (
      <View style={{ flex: 1, padding: 14, gap: 8 }}>
        <Chips items={[{ label: ALL, count: items.length }, ...regions.map((r) => ({ label: r.name, count: r.items.length }))]} active={region} onPick={(r) => { setRegion(r); setGenre(ALL); }} />
        <Chips items={[{ label: ALL }, ...genres.map((g) => ({ label: g.name, count: g.items.length }))]} active={genre} onPick={setGenre} />
        {list.length ? (
          <FlatList
            key={'p' + cols}
            data={list}
            numColumns={cols}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={<Muted style={{ fontSize: 22, fontWeight: '800', color: '#F2F5FA' }}>{title}</Muted>}
            columnWrapperStyle={{ gap: 14, justifyContent: 'space-between' }}
            contentContainerStyle={{ gap: 16, paddingVertical: 6 }}
            renderItem={({ item }) => <PosterCard item={item} onPress={() => onOpen(item)} />}
            initialNumToRender={8}
            windowSize={5}
            removeClippedSubviews
          />
        ) : (
          <Empty title={`Nada em ${title.toLowerCase()} ainda`} hint={emptyHint} />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', padding: 16, gap: 16 }}>
      <GlassSurface strength="soft" style={{ width: 230, borderRadius: 24, padding: 12 }}>
        <ScrollView contentContainerStyle={{ gap: 2 }}>
          <Muted style={{ fontWeight: '700', letterSpacing: 1, padding: 8 }}>REGIÃO</Muted>
          <SideItem label={ALL} count={items.length} active={region === ALL} onPress={() => { setRegion(ALL); setGenre(ALL); }} />
          {regions.map((r) => (
            <SideItem key={r.name} label={r.name} count={r.items.length} active={region === r.name} onPress={() => { setRegion(r.name); setGenre(ALL); }} />
          ))}
          <Muted style={{ fontWeight: '700', letterSpacing: 1, padding: 8, paddingTop: 18 }}>GÊNERO</Muted>
          <SideItem label={ALL} active={genre === ALL} onPress={() => setGenre(ALL)} />
          {genres.map((g) => (
            <SideItem key={g.name} label={g.name} count={g.items.length} active={genre === g.name} onPress={() => setGenre(g.name)} />
          ))}
        </ScrollView>
      </GlassSurface>
      <View style={{ flex: 1 }}>
        {list.length ? (
          <FlatList
            key={cols}
            data={list}
            numColumns={cols}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={<HeroInfo fallbackTitle={title} height={200} />}
            columnWrapperStyle={{ gap: 16 }}
            contentContainerStyle={{ gap: 18, padding: 6 }}
            renderItem={({ item, index }) => <PosterCard item={item} autoFocus={index === 0} onPress={() => onOpen(item)} />}
            initialNumToRender={cols * 3}
            windowSize={5}
            removeClippedSubviews
          />
        ) : (
          <Empty title={`Nada em ${title.toLowerCase()} ainda`} hint={emptyHint} />
        )}
      </View>
    </View>
  );
}
