// Lançamentos: filmes mais recentes (pelo ano) e adicionados por último.
import React, { useMemo } from 'react';
import { router } from 'expo-router';
import { LibItem, LibraryGrid } from '../../src/components/LibraryGrid';
import { useCatalog } from '../../src/store/catalog';

export default function NewReleases() {
  const movies = useCatalog((s) => s.catalog.movies);
  const items: LibItem[] = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return movies
      .filter((m) => !m.year || Number(m.year) >= thisYear - 1)
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || (b.addedAt || 0) - (a.addedAt || 0))
      .slice(0, 300)
      .map((m) => ({ id: m.id, title: m.title, subtitle: [m.year, m.genre].filter(Boolean).join(' · '), image: m.poster, backdrop: m.backdrop, description: m.plot, region: m.region, genre: m.genre }));
  }, [movies]);
  return (
    <LibraryGrid
      title="Lançamentos"
      items={items}
      onOpen={(it) => router.push({ pathname: '/details', params: { type: 'movie', id: it.id } })}
      emptyHint="Os lançamentos vêm dos filmes das suas listas, ordenados pelo ano."
    />
  );
}
