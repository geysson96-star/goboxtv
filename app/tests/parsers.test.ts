import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U } from '../src/lib/m3u';
import { parseXMLTV, parseXmltvDate, nowAndNext } from '../src/lib/xmltv';
import { buildCatalog } from '../src/lib/catalog';
import { cleanTitle, detectGenre, detectRegion, fuzzyMatch, parseEpisode } from '../src/lib/normalize';
import type { Source } from '../src/lib/types';

const M3U_A = `#EXTM3U x-tvg-url="https://exemplo.com/guia.xml"
#EXTINF:-1 tvg-id="CienciaAberta.br" tvg-logo="https://x/logo.png" group-title="Educativos",TV Ciência Aberta HD
#EXTVLCOPT:http-user-agent=VLC/3.0
https://a.com/ciencia.m3u8
#EXTINF:-1 tvg-id="NoticiasBR.br" group-title="BR | NOTÍCIAS",[BR] Notícias Brasil 24 (1080p)
https://a.com/noticias.m3u8
#EXTINF:-1 group-title="FILMES | AÇÃO",O Inventor (2024)
https://a.com/movie/inventor.mp4
#EXTINF:-1 group-title="Séries Comédia",Oficina do Sertão S02E05
https://a.com/series/oficina-s02e05.mp4
#EXTINF:-1 group-title="Séries Comédia",Oficina do Sertão S02E04
https://a.com/series/oficina-s02e04.mp4
`;

const M3U_B = `#EXTM3U
#EXTINF:-1 tvg-id="CienciaAberta.br" group-title="Brasil",TV Ciencia Aberta
https://b.com/ciencia-backup.m3u8
#EXTINF:-1,"Canal, com vírgula" no nome
https://b.com/virgula.m3u8
`;

test('M3U: lê atributos, nome, cabeçalhos e guia', () => {
  const r = parseM3U(M3U_A, 'a');
  assert.equal(r.epgUrl, 'https://exemplo.com/guia.xml');
  assert.equal(r.entries.length, 5);
  const c = r.entries[0];
  assert.equal(c.name, 'TV Ciência Aberta');
  assert.equal(c.tvgId, 'CienciaAberta.br');
  assert.equal(c.kind, 'live');
  assert.deepEqual(c.headers, { 'User-Agent': 'VLC/3.0' });
  assert.equal(r.entries[1].name, 'Notícias Brasil 24');
  assert.equal(r.entries[2].kind, 'movie');
  assert.equal(r.entries[2].name, 'O Inventor');
  assert.equal(r.entries[2].year, '2024');
  assert.equal(r.entries[3].kind, 'episode');
  assert.equal(r.entries[3].seriesName, 'Oficina do Sertão');
  assert.equal(r.entries[3].season, 2);
  assert.equal(r.entries[3].episode, 5);
});

test('M3U: vírgula entre aspas não quebra o nome', () => {
  const r = parseM3U(M3U_B, 'b');
  assert.equal(r.entries[1].name, '"Canal, com vírgula" no nome');
  assert.equal(r.entries[1].url, 'https://b.com/virgula.m3u8');
});

test('Catálogo: junta o mesmo canal de listas diferentes como fontes de failover', () => {
  const sources: Source[] = [
    { id: 'a', name: 'A', kind: 'm3u', url: '', auto: true, enabled: true, priority: 1 },
    { id: 'b', name: 'B', kind: 'm3u', url: '', auto: true, enabled: true, priority: 2 },
  ];
  const entries = [...parseM3U(M3U_B, 'b').entries, ...parseM3U(M3U_A, 'a').entries];
  const cat = buildCatalog(sources, entries);
  const ciencia = cat.channels.find((c) => c.tvgId === 'CienciaAberta.br')!;
  assert.equal(ciencia.streams.length, 2);
  assert.equal(ciencia.streams[0].sourceId, 'a', 'lista de maior prioridade vem primeiro');
  assert.equal(cat.movies.length, 1);
  assert.equal(cat.series.length, 1);
  assert.deepEqual(cat.series[0].seasons[2].map((e) => e.episode), [4, 5]);
  assert.equal(cat.channels[0].region, 'Brasil');
});

test('Normalização de nomes, regiões e gêneros', () => {
  assert.equal(cleanTitle('[BR] Globo News FHD'), 'Globo News');
  assert.equal(cleanTitle('PT: RTP 1 (720p)'), 'RTP 1');
  assert.equal(detectRegion('BR | Esportes'), 'Brasil');
  assert.equal(detectGenre('FILMES | AÇÃO'), 'Ação');
  assert.equal(detectGenre('Acao HD'), 'Ação');
  assert.deepEqual(parseEpisode('Minha Série 3x07'), { series: 'Minha Série', season: 3, episode: 7 });
});

test('Busca tolerante a erros', () => {
  assert.ok(fuzzyMatch('vingadoes', 'Vingadores: Ultimato'));
  assert.ok(fuzzyMatch('noticias', 'Notícias Brasil 24'));
  assert.ok(!fuzzyMatch('futebol', 'Notícias Brasil 24'));
});

test('XMLTV: datas com fuso, entidades, filtro e agora/a seguir', () => {
  assert.equal(parseXmltvDate('20261031200000 -0300'), Date.UTC(2026, 9, 31, 23, 0, 0));
  const base = Date.UTC(2026, 9, 31, 23, 0, 0);
  const xml = `<?xml version="1.0"?><tv>
  <programme start="20261031200000 -0300" stop="20261031210000 -0300" channel="CienciaAberta.br"><title lang="pt">Rios &amp; Cerrado</title><desc>Nascentes</desc><category>Documentário</category></programme>
  <programme start="20261031210000 -0300" stop="20261031220000 -0300" channel="CienciaAberta.br"><title><![CDATA[Laboratório Aberto]]></title></programme>
  <programme start="20261031200000 -0300" stop="20261031210000 -0300" channel="Outro.br"><title>Ignorado</title></programme>
  </tv>`;
  const progs = parseXMLTV(xml, { channelIds: new Set(['CienciaAberta.br']), from: base - 864e5, to: base + 864e5 });
  assert.equal(progs.length, 2);
  assert.equal(progs[0].title, 'Rios & Cerrado');
  assert.equal(progs[1].title, 'Laboratório Aberto');
  const nn = nowAndNext(progs, base + 30 * 60e3);
  assert.equal(nn.now?.title, 'Rios & Cerrado');
  assert.equal(nn.next?.title, 'Laboratório Aberto');
});
