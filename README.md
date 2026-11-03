# GoBoxTV

Player de IPTV com visual de vidro, feito para **Android / Android TV / TV Box (APK)** e **computador (Windows, macOS, Linux)**, com acesso só por convite.

```
vidro-tv/
├── app/       → o aplicativo (Expo / React Native). Gera o APK e a versão web.
├── cloudflare/ → servidor de login na Cloudflare (grátis) — o caminho recomendado
├── server/    → o mesmo servidor em Node, para rodar em VPS ou no seu PC
└── desktop/   → embala a versão web como programa de computador (Electron)
```

## Downloads

Última versão (APK para celular/Android TV/TV Box e instalador para Windows):
**https://github.com/geysson96-star/goboxtv/releases/latest**

## O que o app faz

- **Menus:** Início, Buscar, Ao Vivo, Programação, Guia de TV, Filmes, Séries, Lançamentos, Configurações e Usuários (só master).
- **Submenus:** canais, filmes e séries separados por **região** (Brasil, Portugal, América Latina…) e **gênero** (Notícias, Infantil, Ação…). As categorias bagunçadas das listas são padronizadas automaticamente.
- **Capa estilo Netflix:** a arte do item em foco aparece grande no fundo, com título e sinopse.
- **Programação:** escolha o canal e o dia (hoje + 6 dias) e veja horários, o que está no ar e o que vem depois. Dá para criar **lembretes**, e o app avisa quando o programa começa.
- **Guia de TV:** grade de canais × horários com a linha do "agora".
- **Listas automáticas + manuais:** já vem com catálogos públicos e legais (iptv-org) e aceita URL M3U/M3U8 ou login Xtream Codes.
- **Failover:** o mesmo canal vindo de listas diferentes vira um item só, com várias fontes. Se uma cai ou trava, o app tenta de novo e depois passa para a próxima sozinho. Se uma lista inteira cai, o app usa a última cópia boa guardada.
- **Saúde das listas:** status online / lenta / fora do ar, verificação a cada 30 min, prioridade ajustável.
- **Rápido em TV Box fraca:** cache local (abre na hora), listas virtualizadas, imagens com cache e opção "Reduzir efeitos".
- **Controle remoto:** tudo funciona com setas + OK. No PC, as setas do teclado também navegam.
- **Extras:** continuar assistindo, favoritos (segure OK no canal), busca tolerante a erros, controle parental com PIN, capas e sinopses do TMDB (opcional).
- **Acesso por convite:** o master cria um usuário por pessoa e gera um código. Usuários ilimitados, limite de aparelhos por código, validade, bloquear/liberar, trocar código, entrar na TV escaneando um QR no celular.

### Efeito de vidro
O componente `GlassSurface` usa o **Liquid Glass nativo (`expo-glass-effect`)** no iOS/tvOS 26+. No Android ele usa um vidro simulado (leve), e no PC um desfoque real (`backdrop-filter`). O `expo-glass-effect` só existe no iOS; em Android/PC ele apenas mostraria uma caixa comum, por isso essa adaptação.

---

## 1) Subir o servidor de login — GRÁTIS (faça primeiro)

O servidor roda na **Cloudflare, no plano gratuito**: fica no ar 24 h, já vem com HTTPS e não precisa de cartão. O limite grátis sobra para um grupo de amigos.

1. Instale o **Node 20 ou mais novo**: https://nodejs.org (botão "LTS").
2. Crie uma conta grátis em https://dash.cloudflare.com/sign-up e confirme o e-mail.
3. Rode o publicador:
   - **Windows:** dê dois cliques em `PUBLICAR-SERVIDOR-GRATIS.bat`
   - **macOS / Linux:** `bash publicar-servidor-gratis.sh`
4. Quando o navegador abrir, clique em **Allow** para liberar o acesso à sua conta.

O script cria o banco de dados, publica o servidor, gera a sua chave master (`cloudflare/MASTER_KEY.txt`, que nunca sai do seu computador) e **já preenche o `app/.env`** com o endereço. No fim ele mostra:

- Painel master: `https://vidro-tv.SEU-NOME.workers.dev/admin`
- Ativar TV pelo celular: `https://vidro-tv.SEU-NOME.workers.dev/ativar`

Se a Cloudflare pedir para escolher um subdomínio `workers.dev`, crie um em dash.cloudflare.com › Workers & Pages e rode o script de novo. Para atualizar o servidor no futuro, rode o mesmo script.

**Fontes automáticas para todos:** edite `cloudflare/sources.json` e rode o script de novo. O app de todo mundo atualiza essas listas sem precisar de versão nova.

<details>
<summary>Outras opções (pagas ou no seu próprio computador)</summary>

- **Railway (US$ 5/mês):** dentro da pasta `server`, rode `powershell -ExecutionPolicy Bypass -File .\deploy-railway.ps1` (Windows) ou `bash deploy-railway.sh` (macOS/Linux).
- **No seu computador / VPS:** `cd server` e `MASTER_KEY="uma-senha-forte" node index.mjs` (Windows: `$env:MASTER_KEY="uma-senha-forte"; node index.mjs`). Os dados ficam em `server/data/`; faça backup. Para amigos de fora da sua rede, precisa de HTTPS na frente. Há um `Dockerfile` pronto (monte um volume em `/data`).
</details>

## 2) Rodar o app para testar

Requisito: **Node 20+**.

```bash
cd app
cp .env.example .env          # só se o publicador grátis ainda não criou o .env
npm install
npx expo install --fix        # alinha versões com o Expo SDK 58
npx expo start --web          # abre no navegador
```

Sem `EXPO_PUBLIC_API_URL`, o app entra direto sem pedir código (modo de teste).

## 3) Gerar o APK (Android, Android TV, TV Box)

O jeito mais fácil é pela nuvem da Expo. O plano gratuito inclui algumas compilações de Android por mês, o suficiente para este projeto:

```bash
npm install -g eas-cli
eas login
cd app
npm run build:apk
```

No fim aparece um link para baixar o `.apk`. Para instalar na TV Box, use um pendrive ou o app "Downloader" com o link. O app aparece na tela inicial do Android TV.

Alternativa local (precisa do Android Studio): `npx expo run:android --variant release`.

## 4) Gerar a versão de computador

```bash
cd app && npm run build:web          # gera app/dist
cd ../desktop && npm install
npm start                            # testa
npm run dist:win                     # instalador .exe (use dist:mac ou dist:linux nos outros sistemas)
```

A versão de computador libera o acesso às listas que o navegador comum bloquearia (CORS). Atalho F11 = tela cheia.

## 5) Convidar alguém

1. Abra o painel (`/admin` no navegador ou **Usuários** no app) e entre com a `MASTER_KEY`.
2. Em **Novo usuário**, digite o nome, escolha quantos aparelhos o código vale e a validade.
3. Clique em **Gerar código** e depois em **Enviar**. Sai uma mensagem pronta para o WhatsApp.
4. A pessoa abre o app e digita o código. Na TV, ela também pode escanear o QR com o celular.

Depois, você pode **Bloquear** (corta na hora), **Liberar aparelhos** (se a pessoa trocou de TV), gerar um **código novo** (o antigo e as sessões antigas param de valer) ou **Apagar**.

## Testes

```bash
cd app && npm test        # leitura de M3U, XMLTV, catálogo, normalização e busca
cd server && npm test     # login, limite de aparelhos, bloqueio, troca de código, pareamento
```

## Avisos importantes

- O app é um **player**: ele toca listas que você ou o administrador cadastram. As fontes que vêm prontas são catálogos públicos de canais abertos e gratuitos. **Use apenas conteúdo que você tem direito de assistir e de compartilhar.**
- Guias XMLTV compactados (`.gz`) funcionam no PC. No Android, use a versão `.xml`.
- Fora da sua rede, o servidor precisa de HTTPS. No app, o login fica guardado no aparelho e continua valendo por até 72 h sem internet.
- Fonte: o app usa a fonte do sistema. Para usar Manrope (como no protótipo), adicione `expo-font` e carregue a fonte em `app/app/_layout.tsx`.
