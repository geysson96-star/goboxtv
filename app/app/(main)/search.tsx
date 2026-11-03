// Busca em canais, filmes e séries, tolerante a erros de digitação.
import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../../src/components/GlassSurface';
import { Empty, Row } from '../../src/components/ui';
import { useCatalog } from '../../src/store/catalog';
import { fuzzyMatch } from '../../src/lib/normalize';
import { colors } from '../../src/theme';

export default function Search() {
  const catalog = useCatalog((s) => s.catalog);
  const [q, setQ] = useState('');
  const query = q.trim();

  const res = useMemo(() => {
    if (query.length < 2) return null;
    return {
      channels: catalog.channels.filter((c) => fuzzyMatch(query, c.name)).slice(0, 40).map((c) => ({ id: c.id, title: c.name, subtitle: `${c.region} · ${c.genre}`, image: c.logo })),
      movies: catalog.movies.filter((m) => fuzzyMatch(query, m.title)).slice(0, 40).map((m) => ({ id: m.id, title: m.title, subtitle: m.year, image: m.poster, backdrop: m.backdrop, description: m.plot })),
      series: catalog.series.filter((s) => fuzzyMatch(query, s.title)).slice(0, 40).map((s) => ({ id: s.id, title: s.title, subtitle: s.genre, image: s.poster, backdrop: s.backdrop, description: s.plot })),
    };
  }, [query, catalog]);

  const none = res && !res.channels.length && !res.movies.length && !res.series.length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }} keyboardShouldPersistTaps="handled">
      <GlassSurface style={{ borderRadius: 30, height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12, maxWidth: 640 }}>
        <Ionicons name="search" size={22} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar canais, filmes e séries"
          placeholderTextColor={colors.dim}
          autoFocus
          style={{ flex: 1, color: colors.text, fontSize: 18, height: 56, outlineStyle: 'none' } as any}
        />
      </GlassSurface>
      {!res ? <Empty title="O que você quer assistir?" hint="Digite pelo menos 2 letras. Pode errar a digitação: “vingadoes” encontra “Vingadores”." /> : null}
      {none ? <Empty title="Nada encontrado" hint="Tente outro nome ou confira se a lista que tem esse conteúdo está ligada." /> : null}
      {res ? (
        <View style={{ gap: 24 }}>
          <Row title="Canais" items={res.channels} shape="logo" onPress={(it) => router.push({ pathname: '/player', params: { type: 'channel', id: it.id } })} />
          <Row title="Filmes" items={res.movies} onPress={(it) => router.push({ pathname: '/details', params: { type: 'movie', id: it.id } })} />
          <Row title="Séries" items={res.series} onPress={(it) => router.push({ pathname: '/details', params: { type: 'series', id: it.id } })} />
        </View>
      ) : null}
    </ScrollView>
  );
}
