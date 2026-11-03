import React, { useMemo } from 'react';
import { router } from 'expo-router';
import { LibItem, LibraryGrid } from '../../src/components/LibraryGrid';
import { useCatalog } from '../../src/store/catalog';
import { useSettings } from '../../src/store/settings';

export default function SeriesScreen() {
  const series = useCatalog((s) => s.catalog.series);
  const { parentalPin, lockedGenres } = useSettings();
  const items: LibItem[] = useMemo(
    () =>
      series
        .filter((s) => !(parentalPin && lockedGenres.includes(s.genre)))
        .map((s) => {
          const n = Object.keys(s.seasons).length;
          return { id: s.id, title: s.title, subtitle: [s.genre, n ? `${n} temporada${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '), image: s.poster, backdrop: s.backdrop, description: s.plot, region: s.region, genre: s.genre };
        }),
    [series, parentalPin, lockedGenres],
  );
  return (
    <LibraryGrid
      title="Séries"
      items={items}
      onOpen={(it) => router.push({ pathname: '/details', params: { type: 'series', id: it.id } })}
      emptyHint="Séries aparecem aqui quando alguma lista traz episódios (ex.: S01E02) ou é um login Xtream com séries."
    />
  );
}
