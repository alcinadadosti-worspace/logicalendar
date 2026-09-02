# Setup — Calendário da Equipe de Logística

Passo a passo para criar o projeto Firebase **novo**, colar as credenciais e publicar no Render.
Tempo estimado: 20 minutos.

> **Não reaproveite** o projeto Firebase nem o site do Render do outro calendário. Este app usa a
> collection `logisticaData` e precisa de um projeto próprio para os dados não se misturarem.

---

## 0. O que você já tem nesta pasta

```
public/
  index.html          ← o app inteiro (HTML + CSS + JS)
  manifest.json       ← PWA
  sw.js               ← service worker (cache offline)
  icon-192.svg, icon-512.svg, logo.png
  fotos/alberto.jpg, ludmylla.jpg, rosilene.jpg
render.yaml           ← blueprint do Render (site estático em ./public)
firestore.rules       ← regras de segurança do Firestore
SETUP-FIREBASE.md     ← este guia
```

Enquanto as credenciais não forem coladas, o app abre em **modo demonstração** (faixa amarela no topo):
sem login por PIN, dados só no navegador, com alguns eventos de exemplo. Serve para ver o visual antes de publicar.

---

## 1. Criar o projeto Firebase

1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**.
2. Nome sugerido: `calendario-logistica`. Google Analytics pode ficar **desligado**.
3. Espere criar e clique em **Continuar**.

## 2. Ativar o login por e-mail/senha

O PIN de 4 dígitos vira uma senha do Firebase Auth (`PIN + "lg"`), por isso o provedor precisa estar ativo.

1. Menu lateral → **Criação** → **Authentication** → **Vamos começar**.
2. Aba **Sign-in method** → **E-mail/senha** → **Ativar** (só a primeira opção; "link por e-mail" fica desligado) → **Salvar**.
3. Ainda em Authentication, aba **Settings** → **Domínios autorizados**: depois que o Render gerar a URL do site
   (passo 6), volte aqui e adicione `SEU-SITE.onrender.com`. `localhost` já vem liberado.

## 3. Criar o banco Firestore

1. Menu lateral → **Criação** → **Firestore Database** → **Criar banco de dados**.
2. Local: `southamerica-east1 (São Paulo)`. Modo: **produção** (as regras vêm no próximo passo).
3. Clique em **Criar**.

## 4. Colar as regras de segurança

1. Na tela do Firestore, aba **Regras**.
2. Apague o conteúdo e cole **tudo** que está no arquivo `firestore.rules` desta pasta.
3. Clique em **Publicar**.

O que as regras fazem:

| Collection      | Leitura       | Escrita       | Por quê |
|-----------------|---------------|---------------|---------|
| `logisticaData` | só logado     | só logado     | são os dados do calendário |
| `pinMap`        | pública       | só logado     | o login lê o mapa `hash(PIN) → email` **antes** de autenticar |
| `authSetupDone` | pública       | só logado     | marca que as contas já foram criadas |
| resto           | bloqueado     | bloqueado     | — |

## 5. Registrar o app web e colar as credenciais

1. Na página inicial do projeto, clique no ícone **`</>`** (Adicionar app → Web).
2. Apelido: `calendario-logistica`. **Não** marque Firebase Hosting. Clique em **Registrar app**.
3. Vai aparecer um bloco `const firebaseConfig = { ... }`. Copie cada valor.
4. Abra `public/index.html` e procure o bloco **`1. CONFIGURAÇÃO DO FIREBASE`** (logo no início do
   `<script>` principal, por volta da linha 640). Substitua cada `COLE_AQUI_...` pelo valor correspondente:

```js
const FIREBASE_CONFIG = {
  apiKey:            'COLE_AQUI_apiKey',            // ← apiKey
  authDomain:        'COLE_AQUI_authDomain',        // ← authDomain  (ex.: calendario-logistica.firebaseapp.com)
  projectId:         'COLE_AQUI_projectId',         // ← projectId   (ex.: calendario-logistica)
  storageBucket:     'COLE_AQUI_storageBucket',     // ← storageBucket
  messagingSenderId: 'COLE_AQUI_messagingSenderId', // ← messagingSenderId (só números)
  appId:             'COLE_AQUI_appId'              // ← appId
};
```

Mantenha as aspas. Assim que nenhum valor começar com `COLE_AQUI`, o modo demonstração desliga sozinho.

> Essas credenciais não são segredo (ficam no HTML de qualquer app Firebase). Quem protege os dados
> são as regras do passo 4 e o login por PIN.

## 6. Publicar no Render (site estático)

O Render publica a partir de um repositório Git. Se a pasta ainda não é um repositório:

```bash
git init
git add .
git commit -m "Calendário Logística"
# crie um repositório vazio no GitHub e depois:
git remote add origin https://github.com/SEU-USUARIO/calendario-logistica.git
git push -u origin main
```

Depois, no Render:

1. <https://dashboard.render.com> → **New +** → **Blueprint** → conecte o repositório.
   O Render lê o `render.yaml` e cria o serviço `calendario-logistica` como **Static Site**
   com pasta de publicação `./public` e o header `Cache-Control: no-cache`.
   - Alternativa manual: **New +** → **Static Site**, *Build Command* em branco, *Publish directory* = `public`,
     e em **Headers** adicione `/*` → `Cache-Control` → `no-cache`.
2. Ao terminar, copie a URL (`https://calendario-logistica.onrender.com` ou parecida).
3. Volte ao Firebase → Authentication → Settings → **Domínios autorizados** → adicione essa URL (sem `https://`).

Cada `git push` republica o site. Como o `index.html` é servido com `no-cache`, a versão nova chega
em todos os celulares no próximo carregamento.

## 7. Primeiro acesso: criar as contas

1. Abra o site publicado. Vai aparecer a tela de PIN com o botão **Configurar contas**
   (ele só existe enquanto o `pinMap` não foi criado).
2. Defina um PIN de 4 dígitos para **Alberto**, **Ludmylla** e **Rosilene** (todos diferentes) e clique em
   **Criar contas e entrar**. O app:
   - cria as três contas no Firebase Auth (`alberto@logistica.cal`, `ludmylla@logistica.cal`, `rosilene@logistica.cal`);
   - entra como Alberto (gestor);
   - grava `pinMap/map` com `{ sha256(pin): email }` usando `merge: true`;
   - grava `authSetupDone/done`.
3. Passe o PIN de cada pessoa. Elas entram digitando só o PIN.

Depois disso, a tela de login nunca mais mostra o botão de configuração.

## 8. Dia a dia do gestor

- **Equipe**: sidebar → *Equipe* → **gerenciar**. Ali dá para trocar nome, cor, cidade (para o clima),
  foto (vai redimensionada para 128 px no documento `equipeFotos`), aniversário, papel e ativo/desativado.
- **Adicionar pessoa**: no mesmo modal, informe nome + PIN. O app cria a conta e a entrada no `pinMap` na hora.
- **Trocar o próprio PIN**: ⚙️ Preferências → *Trocar meu PIN* (pede o PIN atual).
- **Backup**: 💾 no header → baixa um JSON com tudo; o gestor também pode restaurar a partir de um arquivo.
- **Instalar como app**: no celular, "Adicionar à tela inicial"; no Chrome desktop, ícone de instalar na barra de endereço.

## 9. Testar localmente

Abrir o `index.html` direto (`file://`) funciona para o modo demonstração. Com Firebase configurado,
prefira um servidor local, porque o service worker e algumas APIs precisam de `http://localhost`:

```bash
npx serve public
# ou
python -m http.server 8080 --directory public
```

Para forçar o modo demonstração mesmo com credenciais coladas: `http://localhost:8080/?demo`.

## 10. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "Credenciais do Firebase inválidas" | algum `COLE_AQUI` ficou, ou valor colado errado | confira o bloco `FIREBASE_CONFIG` |
| "Ative E-mail/senha em Authentication" | provedor desligado | passo 2 |
| "Sem permissão para ler/salvar" | regras não publicadas ou diferentes do arquivo | passo 4, clique em **Publicar** |
| "PIN não encontrado" | PIN digitado não existe no `pinMap` | o gestor confere/recria pela tela de equipe |
| Botão **Configurar contas** não aparece | `pinMap/map` já existe | as contas já foram criadas; entre com o PIN |
| Bolinha vermelha no header | sem conexão | as alterações ficam na fila (`offlineQueue`) e sobem quando voltar |
| Clima "indisponível" | cidade não encontrada no Open-Meteo | ajuste o nome da cidade na tela de equipe |
| Erro `auth/unauthorized-domain` | domínio do Render não autorizado | passo 2, item 3 |

## 11. Estrutura dos dados (para referência)

Cada chave do estado é **um documento** `logisticaData/<chave>` com o JSON em `value`:

`events, statuses, history, customColors, birthdays, requests, notes, priorities, diary, blocks,
reminders, kudos, messages, folgas, userPriorities, equipe, equipeFotos`

Os eventos referenciam pessoas pela **chave** (`alberto`, `ludmylla`, `rosilene`), nunca pelo nome.
Tema e modo festivo ficam só no `localStorage` de cada aparelho.
