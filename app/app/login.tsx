// Entrada por convite: só quem recebeu um código do administrador consegue usar o app.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { GlassSurface } from '../src/components/GlassSurface';
import { Button, H1, Muted, T } from '../src/components/ui';
import { useAuth } from '../src/store/auth';
import { apiUrl, hasBakedApiUrl, normalizeServerUrl, setApiUrl } from '../src/lib/config';
import { getDevice } from '../src/lib/api';
import { setJSON } from '../src/lib/storage';
import { useIsPhone } from '../src/lib/layout';
import { colors } from '../src/theme';

const inputStyle = {
  borderRadius: 18, paddingHorizontal: 20, color: colors.text, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 2,
} as const;

/** Confere se o endereço é mesmo um servidor do GoBoxTV. */
async function checkServer(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url + '/', { signal: ctrl.signal }).then((x) => x.json());
    return r?.name === 'GoBoxTV server';
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function Login() {
  const { status, login, message } = useAuth();
  const phone = useIsPhone();
  const [server, setServer] = useState(apiUrl());
  const [serverDraft, setServerDraft] = useState(apiUrl().replace(/^https:\/\//, ''));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(message || null);
  const [pair, setPair] = useState<{ id: string; short: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pareamento pelo celular: a TV mostra um código curto, a pessoa confirma no celular.
  useEffect(() => {
    if (!server || phone) return;
    let alive = true;
    (async () => {
      try {
        const dev = await getDevice();
        const res = await fetch(`${server}/api/pair/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: dev.id, deviceName: dev.name }),
        }).then((r) => r.json());
        if (!alive || !res?.id) return;
        setPair({ id: res.id, short: res.short });
        pollRef.current = setInterval(async () => {
          const st = await fetch(`${server}/api/pair/${res.id}`).then((r) => r.json()).catch(() => null);
          if (st?.token && st?.user) {
            if (pollRef.current) clearInterval(pollRef.current);
            const s = { token: st.token, user: st.user, verifiedAt: Date.now() };
            await setJSON('session', s);
            useAuth.setState({ status: 'in', session: s });
            router.replace('/home');
          }
        }, 3000);
      } catch {}
    })();
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [server, phone]);

  if (status === 'in') return <Redirect href="/home" />;

  const saveServer = async () => {
    const url = normalizeServerUrl(serverDraft);
    if (!url) return setError('Digite o endereço do servidor que veio no convite.');
    setBusy(true);
    setError(null);
    const ok = await checkServer(url);
    setBusy(false);
    if (!ok) return setError('Não encontrei um servidor do GoBoxTV nesse endereço. Confira o que veio no convite.');
    setApiUrl(url);
    await setJSON('serverUrl', url);
    setServer(url);
  };

  const submit = async () => {
    if (code.trim().length < 6) return setError('Digite o código completo.');
    setBusy(true);
    setError(null);
    try {
      await login(code);
      router.replace('/home');
    } catch (e: any) {
      setError(e?.offline ? 'Sem conexão com o servidor. Verifique a internet.' : e?.message || 'Código inválido.');
    } finally {
      setBusy(false);
    }
  };

  const pairUrl = `${server}/ativar`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: phone ? 16 : 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ position: 'absolute', left: -120, top: -160, width: 620, height: 560, borderRadius: 400, backgroundColor: '#1D47C9', opacity: 0.35 }} />
      <View style={{ position: 'absolute', right: -120, bottom: -160, width: 560, height: 480, borderRadius: 400, backgroundColor: '#0E9AA8', opacity: 0.28 }} />

      <GlassSurface strength="strong" style={{ width: '100%', maxWidth: 1000, borderRadius: phone ? 28 : 36, flexDirection: 'row', flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: phone ? '100%' : 420, padding: phone ? 24 : 44, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent }} />
            <T style={{ fontSize: 24, fontWeight: '800' }}>GoBoxTV</T>
          </View>

          {!server ? (
            <>
              <H1 style={{ fontSize: phone ? 26 : 30 }}>Primeiro acesso</H1>
              <Muted style={{ fontSize: 15 }}>Digite o endereço do servidor que veio na mensagem de convite.</Muted>
              <TextInput
                value={serverDraft}
                onChangeText={setServerDraft}
                placeholder="vidro-tv.nome.workers.dev"
                placeholderTextColor={colors.dim}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
                onSubmitEditing={saveServer}
                style={[inputStyle, { height: 60, fontSize: 18, borderColor: error ? colors.red : 'rgba(92,200,255,0.55)' }]}
              />
              {error ? <T style={{ color: '#FCA5A5', fontWeight: '700' }}>{error}</T> : null}
              {busy ? <ActivityIndicator color={colors.accent} /> : <Button variant="primary" label="Continuar" onPress={saveServer} />}
            </>
          ) : (
            <>
              <H1 style={{ fontSize: phone ? 26 : 30 }}>Acesso por convite</H1>
              <Muted style={{ fontSize: 15 }}>Digite o código que você recebeu do administrador. Cada código é pessoal.</Muted>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="VIDRO-0000"
                placeholderTextColor={colors.dim}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                onSubmitEditing={submit}
                style={[inputStyle, { height: 66, fontSize: phone ? 22 : 26, fontWeight: '700', letterSpacing: 3, borderColor: error ? colors.red : 'rgba(92,200,255,0.55)' }]}
              />
              {error ? <T style={{ color: '#FCA5A5', fontWeight: '700' }}>{error}</T> : null}
              {busy ? <ActivityIndicator color={colors.accent} /> : <Button variant="primary" label="Entrar" onPress={submit} />}
              {!hasBakedApiUrl() ? (
                <Button
                  small
                  label="Trocar servidor"
                  onPress={() => {
                    setServer('');
                    setError(null);
                  }}
                />
              ) : null}
            </>
          )}
        </View>

        {pair && server ? (
          <View style={{ flexBasis: 340, flexGrow: 1, padding: 44, alignItems: 'center', gap: 14, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }}>
            <T style={{ fontSize: 20, fontWeight: '800' }}>Entrar pelo celular</T>
            <Muted style={{ textAlign: 'center' }}>Aponte a câmera, digite seu código no celular e esta tela entra sozinha.</Muted>
            <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 20 }}>
              <QRCode value={`${pairUrl}?p=${pair.short}`} size={180} />
            </View>
            <Muted>ou acesse {pairUrl.replace(/^https?:\/\//, '')} e digite</Muted>
            <T style={{ fontSize: 28, fontWeight: '800', letterSpacing: 6, color: colors.accentSoft }}>{pair.short}</T>
          </View>
        ) : null}
      </GlassSurface>
    </ScrollView>
  );
}
