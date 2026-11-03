// Configurações: Minhas listas (prioridade, status, adicionar), player, aparência, controle parental e conta.
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Focusable } from '../../src/components/Focusable';
import { GlassSurface } from '../../src/components/GlassSurface';
import { Button, Chips, H1, H2, Muted, Pill, SideItem, T, Toggle } from '../../src/components/ui';
import { useIsPhone } from '../../src/lib/layout';
import { useSettings } from '../../src/store/settings';
import { useCatalog } from '../../src/store/catalog';
import { useAuth } from '../../src/store/auth';
import { xtreamLogin } from '../../src/lib/xtream';
import { hhmm } from '../../src/lib/selectors';
import type { Source } from '../../src/lib/types';
import { colors, healthColor, healthLabel } from '../../src/theme';

type Section = 'lists' | 'player' | 'look' | 'parental' | 'account';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'lists', label: 'Minhas listas' },
  { id: 'player', label: 'Player e qualidade' },
  { id: 'look', label: 'Aparência' },
  { id: 'parental', label: 'Controle parental' },
];

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.dim}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[{ height: 48, borderRadius: 14, paddingHorizontal: 16, color: colors.text, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', fontSize: 15 }, props.style]}
    />
  );
}

function OptionRow({ label, hint, value, onToggle }: { label: string; hint?: string; value: boolean; onToggle: () => void }) {
  return (
    <Focusable scale={false} radius={16} onPress={onToggle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '700' }}>{label}</T>
          {hint ? <Muted>{hint}</Muted> : null}
        </View>
        <Toggle value={value} />
      </View>
    </Focusable>
  );
}

function SourceRow({ s, first, last }: { s: Source; first: boolean; last: boolean }) {
  const st = useCatalog((x) => x.status[s.id]);
  const { updateSource, moveSource, removeSource } = useSettings();
  const health = s.enabled ? st?.health || 'unknown' : 'unknown';
  const detail = [
    s.kind === 'xtream' ? 'Login Xtream' : s.url.replace(/^https?:\/\//, '').slice(0, 48),
    st?.itemCount ? `${st.itemCount.toLocaleString('pt-BR')} itens` : null,
    st?.lastUpdate ? `atualizada às ${hhmm(st.lastUpdate)}` : null,
    st?.error && health === 'offline' ? st.error : null,
  ].filter(Boolean).join(' · ');
  return (
    <GlassSurface style={{ borderRadius: 18, padding: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontWeight: '800' }}>{s.priority}</T>
      </View>
      <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <T numberOfLines={1} style={{ fontWeight: '800' }}>{s.name}</T>
          <Pill label={s.auto ? 'AUTOMÁTICA' : 'MANUAL'} color={s.auto ? colors.accent : colors.yellow} />
        </View>
        <Muted numberOfLines={1}>{detail}</Muted>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: healthColor[health] }} />
        <Muted style={{ color: healthColor[health], fontWeight: '700', width: 90 }}>{s.enabled ? healthLabel[health] : 'Desligada'}</Muted>
      </View>
      {!first ? <Button small icon="arrow-up" onPress={() => moveSource(s.id, -1)} /> : <View style={{ width: 40 }} />}
      {!last ? <Button small icon="arrow-down" onPress={() => moveSource(s.id, 1)} /> : <View style={{ width: 40 }} />}
      {!s.auto ? <Button small icon="trash-outline" variant="danger" onPress={() => removeSource(s.id)} /> : null}
      <Focusable scale={false} radius={16} onPress={() => updateSource(s.id, { enabled: !s.enabled })} accessibilityLabel={s.enabled ? 'Desligar lista' : 'Ligar lista'}>
        <Toggle value={s.enabled} />
      </Focusable>
    </GlassSurface>
  );
}

function AddSource() {
  const addSource = useSettings((s) => s.addSource);
  const refresh = useCatalog((s) => s.refresh);
  const [mode, setMode] = useState<'none' | 'm3u' | 'xtream'>('none');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [epg, setEpg] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (!/^https?:\/\//i.test(url.trim())) return setErr('Informe um endereço começando com http:// ou https://');
    if (mode === 'xtream') {
      setBusy(true);
      try {
        await xtreamLogin({ id: 'tmp', name, kind: 'xtream', url: url.trim(), username: user, password: pass, auto: false, enabled: true, priority: 0 });
      } catch (e: any) {
        setBusy(false);
        return setErr(e?.message || 'Não foi possível entrar.');
      }
      setBusy(false);
    }
    addSource({ name: name.trim() || (mode === 'xtream' ? 'Login Xtream' : 'Minha lista'), kind: mode === 'xtream' ? 'xtream' : 'm3u', url: url.trim(), epgUrl: epg.trim() || undefined, username: user || undefined, password: pass || undefined });
    setMode('none');
    setName(''); setUrl(''); setEpg(''); setUser(''); setPass('');
    refresh();
  };

  if (mode === 'none') {
    return (
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Button icon="add" label="URL M3U / M3U8" onPress={() => setMode('m3u')} />
        <Button icon="key-outline" label="Login Xtream Codes" onPress={() => setMode('xtream')} />
      </View>
    );
  }
  return (
    <GlassSurface strength="strong" style={{ borderRadius: 20, padding: 16, gap: 10 }}>
      <H2>{mode === 'xtream' ? 'Adicionar login Xtream' : 'Adicionar lista M3U'}</H2>
      <Input value={name} onChangeText={setName} placeholder="Nome (ex.: Minha lista)" />
      <Input value={url} onChangeText={setUrl} placeholder={mode === 'xtream' ? 'Servidor (ex.: http://servidor.com:8080)' : 'Endereço da lista (http://...m3u)'} keyboardType="url" />
      {mode === 'xtream' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Input style={{ flex: 1 }} value={user} onChangeText={setUser} placeholder="Usuário" />
          <Input style={{ flex: 1 }} value={pass} onChangeText={setPass} placeholder="Senha" secureTextEntry />
        </View>
      ) : null}
      <Input value={epg} onChangeText={setEpg} placeholder="Guia de programação XMLTV (opcional)" keyboardType="url" />
      {err ? <T style={{ color: '#FCA5A5', fontWeight: '700' }}>{err}</T> : null}
      <Muted>Você é responsável pelas listas que adiciona. Use apenas conteúdo que você tem direito de assistir.</Muted>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {busy ? <ActivityIndicator color={colors.accent} /> : <Button variant="primary" label="Salvar" onPress={save} />}
        <Button label="Cancelar" onPress={() => setMode('none')} />
      </View>
    </GlassSurface>
  );
}

export default function Settings() {
  const [section, setSection] = useState<Section>('lists');
  const st = useSettings();
  const { refresh, checkHealth, loading } = useCatalog();
  const { session, logout } = useAuth();
  const [pinDraft, setPinDraft] = useState('');
  const phone = useIsPhone();

  const allGenres = ['Notícias', 'Esportes', 'Infantil', 'Música', 'Educativos', 'Religiosos', 'Ação', 'Comédia', 'Drama', 'Terror', 'Romance', 'Ficção', 'Suspense', 'Públicos', 'Filmes', 'Variedades'];

  return (
    <View style={{ flex: 1, flexDirection: phone ? 'column' : 'row', padding: phone ? 14 : 16, gap: phone ? 10 : 16 }}>
      {phone ? (
        <Chips items={SECTIONS.map((s) => ({ label: s.label }))} active={SECTIONS.find((s) => s.id === section)!.label} onPick={(l) => setSection(SECTIONS.find((s) => s.label === l)!.id)} />
      ) : (
      <GlassSurface strength="soft" style={{ width: 240, borderRadius: 24, padding: 12, gap: 4 }}>
        <H1 style={{ fontSize: 22, padding: 8 }}>Configurações</H1>
        {SECTIONS.map((s, i) => (
          <SideItem key={s.id} label={s.label} active={section === s.id} onPress={() => setSection(s.id)} autoFocus={i === 0} />
        ))}
      </GlassSurface>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        {section === 'lists' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ gap: 4 }}>
                <H1 style={{ fontSize: 28 }}>Minhas listas</H1>
                <Muted>A ordem define a prioridade. Se uma fonte cai, o app passa para a próxima.</Muted>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button small icon="pulse-outline" label="Verificar agora" onPress={checkHealth} />
                {loading ? <ActivityIndicator color={colors.accent} /> : <Button small icon="refresh" label="Atualizar listas" onPress={refresh} />}
              </View>
            </View>
            {st.sources.map((s, i) => (
              <SourceRow key={s.id} s={s} first={i === 0} last={i === st.sources.length - 1} />
            ))}
            <AddSource />
            <OptionRow label="Troca automática de fonte" hint="Se um canal travar, passa para outro link do mesmo canal." value={st.autoFailover} onToggle={() => st.set({ autoFailover: !st.autoFailover })} />
            <OptionRow label="Atualizar listas ao abrir o app" value={st.refreshOnOpen} onToggle={() => st.set({ refreshOnOpen: !st.refreshOnOpen })} />
          </>
        ) : null}

        {section === 'player' ? (
          <>
            <H1 style={{ fontSize: 28 }}>Player e qualidade</H1>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {(['auto', 'sd', 'hd', 'fhd'] as const).map((q) => (
                <Button key={q} variant={st.preferredQuality === q ? 'primary' : 'glass'} label={q === 'auto' ? 'Automática' : q.toUpperCase()} onPress={() => st.set({ preferredQuality: q })} />
              ))}
            </View>
            <Muted>“Automática” ajusta a qualidade conforme sua internet (quando a fonte oferece várias).</Muted>
          </>
        ) : null}

        {section === 'look' ? (
          <>
            <H1 style={{ fontSize: 28 }}>Aparência</H1>
            <OptionRow label="Reduzir efeitos" hint="Desliga o vidro desfocado e a prévia dos canais. Recomendado para TV Box com pouca memória." value={st.reduceEffects} onToggle={() => st.set({ reduceEffects: !st.reduceEffects })} />
          </>
        ) : null}

        {section === 'parental' ? (
          <>
            <H1 style={{ fontSize: 28 }}>Controle parental</H1>
            {st.parentalPin ? (
              <>
                <Muted>Categorias bloqueadas ficam escondidas. Para mexer aqui, digite o PIN.</Muted>
                <Input value={pinDraft} onChangeText={setPinDraft} placeholder="PIN" keyboardType="number-pad" secureTextEntry maxLength={4} style={{ width: 160 }} />
                {pinDraft === st.parentalPin ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {allGenres.map((g) => (
                        <Button key={g} small variant={st.lockedGenres.includes(g) ? 'danger' : 'glass'} icon={st.lockedGenres.includes(g) ? 'lock-closed' : 'lock-open-outline'} label={g} onPress={() => st.set({ lockedGenres: st.lockedGenres.includes(g) ? st.lockedGenres.filter((x) => x !== g) : [...st.lockedGenres, g] })} />
                      ))}
                    </View>
                    <Button label="Remover PIN" variant="danger" onPress={() => { st.set({ parentalPin: null, lockedGenres: [] }); setPinDraft(''); }} />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Muted>Crie um PIN de 4 números para bloquear categorias (ex.: Terror).</Muted>
                <Input value={pinDraft} onChangeText={setPinDraft} placeholder="Novo PIN" keyboardType="number-pad" maxLength={4} style={{ width: 160 }} />
                <Button variant="primary" label="Criar PIN" onPress={() => pinDraft.length === 4 && st.set({ parentalPin: pinDraft })} />
              </>
            )}
          </>
        ) : null}

        {section === 'account' ? (
          <>
            <H1 style={{ fontSize: 28 }}>Conta</H1>
            <GlassSurface style={{ borderRadius: 18, padding: 16, gap: 6 }}>
              <T style={{ fontWeight: '800', fontSize: 18 }}>{session?.user.name}</T>
              <Muted>{session?.user.role === 'master' ? 'Administrador (master)' : 'Usuário convidado'}{session?.user.expiresAt ? ` · acesso até ${new Date(session.user.expiresAt).toLocaleDateString('pt-BR')}` : ''}</Muted>
            </GlassSurface>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="danger" icon="log-out-outline" label="Sair deste aparelho" onPress={() => logout()} />
              <Button icon="people-outline" label="Área do administrador" onPress={() => router.navigate('/admin')} />
            </View>
            <Muted>
              <Ionicons name="information-circle-outline" size={14} color={colors.muted} /> GoBoxTV é um player: ele toca listas que você ou o administrador cadastram.
            </Muted>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
