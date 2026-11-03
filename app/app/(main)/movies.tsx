import React, { useMemo } from 'react';
import { router } from 'expo-router';
import { LibItem, LibraryGrid } from '../../src/components/LibraryGrid';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';

export default function Movies() {
  const movies = useCatalog((s) => s.catalog.movies);
  const { parentalPin, lockedGenres } = useSettings();
  const items: LibItem[] = useMemo(
    () =>
      movies
        .filter((m) => !(parentalPin && lockedGenres.includes(m.genre)))
        .map((m) => ({ id: m.id, title: m.title, subtitle: [m.year, m.genre].filter(Boolean).join(' · '), image: m.poster, backdrop: m.backdrop, description: m.plot, region: m.region, genre: m.genre })),
    [movies, parentalPin, lockedGenres],
  );
  return (
    <LibraryGrid
      title="Filmes"
      items={items}
      onOpen={(it) => router.push({ pathname: '/details', params: { type: 'movie', id: it.id } })}
      emptyHint="Filmes aparecem aqui quando alguma lista cadastrada tem uma categoria de filmes (VOD)."
    />
  );
}
