// Painel master: cria um usuário por pessoa, gera o código de acesso e bloqueia quando quiser.
// Quantidade de usuários: ilimitada.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GlassSurface } from '../../src/components/GlassSurface';
import { Button, Empty, H1, H2, Muted, Pill, T } from '../../src/components/ui';
import { useIsPhone } from '../../src/lib/layout';
import { admin, AdminUser } from '../../src/lib/api';
import { useAuth } from '../../src/store/auth';
import { apiUrl } from '../../src/lib/config';
import { colorFor, colors } from '../../src/theme';

const STATUS = {
  active: { label: 'Ativo', color: colors.green },
  pending: { label: 'Aguardando', color: colors.yellow },
  blocked: { label: 'Bloqueado', color: colors.red },
} as const;

function when(t?: number | null) {
  if (!t) return '—';
  const diff = Date.now() - t;
  if (diff < 5 * 60e3) return 'Agora';
  if (diff < 24 * 3600e3) return `Hoje, ${new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const days = Math.round(diff / 864e5);
  return days === 1 ? 'Ontem' : `Há ${days} dias`;
}

function shareText(u: AdminUser) {
  return `Olá, ${u.name}! Seu acesso ao GoBoxTV:\n\nServidor: ${apiUrl().replace(/^https:\/\//, '')}\nCódigo: ${u.code}\n\nAbra o app, digite o servidor (só na primeira vez) e depois o código. Vale para ${u.maxDevices} aparelho${u.maxDevices > 1 ? 's' : ''}.`;
}

export default function Admin() {
  const { masterKey, setMasterKey } = useAuth();
  const [keyDraft, setKeyDraft] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [maxDevices, setMaxDevices] = useState(2);
  const [validDays, setValidDays] = useState<number | null>(null);
  const [created, setCreated] = useState<AdminUser | null>(null);
  const phone = useIsPhone();
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!masterKey) return;
    setErr(null);
    try {
      const { users } = await admin.list(masterKey);
      setUsers(users);
    } catch (e: any) {
      setErr(e?.status === 401 ? 'Chave master incorreta.' : e?.message || 'Erro ao carregar.');
      if (e?.status === 401) await setMasterKey(null);
    }
  }, [masterKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (!apiUrl()) return <Empty title="Servidor não configurado" hint="Saia do app e informe o endereço do servidor na tela de entrada." />;

  if (!masterKey) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <GlassSurface strength="strong" style={{ width: 460, borderRadius: 28, padding: 28, gap: 14 }}>
          <H1 style={{ fontSize: 26 }}>Área do administrador</H1>
          <Muted>Digite a chave master definida no servidor (MASTER_KEY).</Muted>
          <TextInput value={keyDraft} onChangeText={setKeyDraft} secureTextEntry placeholder="Chave master" placeholderTextColor={colors.dim} autoFocus style={{ height: 52, borderRadius: 14, paddingHorizontal: 16, color: colors.text, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', fontSize: 16 }} />
          {err ? <T style={{ color: '#FCA5A5', fontWeight: '700' }}>{err}</T> : null}
          <Button variant="primary" label="Entrar" onPress={() => keyDraft && setMasterKey(keyDraft)} />
        </GlassSurface>
      </View>
    );
  }

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    act(async () => {
      if (!name.trim()) throw new Error('Digite o nome da pessoa.');
      const { user } = await admin.create(masterKey, { name: name.trim(), maxDevices, validDays });
      setCreated(user);
      setName('');
    });

  const list = users || [];
  const counts = {
    total: list.length,
    active: list.filter((u) => u.status === 'active').length,
    pending: list.filter((u) => u.status === 'pending').length,
  };

  return (
    <View style={{ flex: 1, flexDirection: phone ? 'column-reverse' : 'row', padding: phone ? 14 : 16, gap: phone ? 10 : 16 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <H1 style={{ fontSize: 28 }}>Usuários</H1>
          <Pill label="MASTER" color={colors.yellow} />
          <View style={{ flex: 1 }} />
          {busy ? <ActivityIndicator color={colors.accent} /> : <Button small icon="refresh" label="Atualizar" onPress={load} />}
          <Button small icon="log-out-outline" label="Sair do master" onPress={() => setMasterKey(null)} />
        </View>
        <Muted>Só quem tem um código criado por você consegue entrar no app.</Muted>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          {[
            ['Usuários', String(counts.total), colors.text],
            ['Ativos', String(counts.active), colors.green],
            ['Aguardando 1º acesso', String(counts.pending), colors.yellow],
            ['Limite de usuários', 'Ilimitado', colors.accentSoft],
          ].map(([l, v, c]) => (
            <GlassSurface key={l} style={{ flexGrow: 1, minWidth: 150, borderRadius: 18, padding: 14, gap: 4 }}>
              <Muted style={{ fontWeight: '700' }}>{l}</Muted>
              <T style={{ fontSize: 26, fontWeight: '800', color: c }}>{v}</T>
            </GlassSurface>
          ))}
        </View>
        {err ? <T style={{ color: '#FCA5A5', fontWeight: '700' }}>{err}</T> : null}
        {!users ? <ActivityIndicator color={colors.accent} /> : null}
        {users && !users.length ? <Empty title="Nenhum usuário ainda" hint="Crie o primeiro no painel ao lado." /> : null}
        {list.map((u) => (
          <GlassSurface key={u.id} strength="soft" style={{ borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colorFor(u.id), alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontWeight: '800' }}>{u.name[0]?.toUpperCase()}</T>
            </View>
            <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
              <T style={{ fontWeight: '700' }}>{u.name}</T>
              <Muted>
                {u.code} · {u.devices.length} de {u.maxDevices} aparelho{u.maxDevices > 1 ? 's' : ''} · {when(u.lastSeen)}
                {u.expiresAt ? ` · vence ${new Date(u.expiresAt).toLocaleDateString('pt-BR')}` : ''}
              </Muted>
            </View>
            <Pill label={STATUS[u.status].label} color={STATUS[u.status].color} />
            <Button small label={u.status === 'blocked' ? 'Liberar' : 'Bloquear'} variant={u.status === 'blocked' ? 'glass' : 'danger'} onPress={() => act(() => admin.setStatus(masterKey, u.id, u.status === 'blocked' ? 'active' : 'blocked'))} />
            <Button small icon="share-social-outline" onPress={() => Share.share({ message: shareText(u) }).catch(() => {})} />
            <Button small icon="key-outline" onPress={() => act(() => admin.regenerate(masterKey, u.id))} />
            <Button small icon="phone-portrait-outline" onPress={() => act(() => admin.resetDevices(masterKey, u.id))} />
            <Button small icon="trash-outline" variant="danger" onPress={() => act(() => admin.remove(masterKey, u.id))} />
          </GlassSurface>
        ))}
        {list.length ? <Muted>Ícones: compartilhar código · gerar código novo (o antigo deixa de valer) · liberar aparelhos · apagar.</Muted> : null}
      </ScrollView>

      {phone && !showForm ? (
        <Button variant="primary" icon="person-add-outline" label="Novo usuário" onPress={() => setShowForm(true)} />
      ) : (
      <GlassSurface strength="strong" style={{ width: phone ? '100%' : 330, borderRadius: 26, padding: 20, gap: 12, alignSelf: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H2 style={{ fontSize: 20, fontWeight: '800' }}>Novo usuário</H2>
          {phone ? <Button small icon="close" onPress={() => setShowForm(false)} /> : null}
        </View>
        <Muted style={{ fontWeight: '700' }}>Nome da pessoa</Muted>
        <TextInput value={name} onChangeText={setName} placeholder="Ex.: Ana Paula" placeholderTextColor={colors.dim} style={{ height: 48, borderRadius: 14, paddingHorizontal: 16, color: colors.text, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', fontSize: 15 }} />
        <Muted style={{ fontWeight: '700' }}>Aparelhos por código</Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 5].map((n) => (
            <Button key={n} small style={{ flex: 1 }} variant={maxDevices === n ? 'primary' : 'glass'} label={String(n)} onPress={() => setMaxDevices(n)} />
          ))}
        </View>
        <Muted style={{ fontWeight: '700' }}>Validade</Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([[null, 'Sempre'], [30, '30 dias'], [365, '1 ano']] as const).map(([v, l]) => (
            <Button key={l} small style={{ flex: 1 }} variant={validDays === v ? 'primary' : 'glass'} label={l} onPress={() => setValidDays(v)} />
          ))}
        </View>
        <Button variant="primary" label="Gerar código de acesso" onPress={create} />
        {created ? (
          <View style={{ padding: 14, borderRadius: 18, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)', gap: 8 }}>
            <Muted style={{ color: '#86EFAC', fontWeight: '700' }}>Código criado para {created.name}</Muted>
            <T style={{ fontSize: 24, fontWeight: '800', letterSpacing: 2 }}>{created.code}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small label="Copiar" onPress={() => Clipboard.setStringAsync(created.code)} />
              <Button small variant="primary" label="Enviar" onPress={() => Share.share({ message: shareText(created) }).catch(() => {})} />
            </View>
          </View>
        ) : null}
      </GlassSurface>
      )}
    </View>
  );
}
