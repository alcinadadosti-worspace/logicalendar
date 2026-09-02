# Prompt — Calendário da Equipe de Logística

Quero que você construa um **Calendário de Equipe para o setor de Logística**, do zero,
seguindo exatamente a arquitetura descrita abaixo. É a adaptação de um app que já roda em
produção para outro setor.

---

## 1. Arquitetura (não negociável)

- **Um único arquivo** `public/index.html` — HTML, CSS e JavaScript tudo junto, sem build,
  sem framework, sem npm. Vanilla JS dentro de um IIFE (`(() => { 'use strict'; ... })()`).
- **Firebase** via CDN compat (`firebase-app-compat`, `firebase-auth-compat`,
  `firebase-firestore-compat` v10.12.2).
- **Persistência**: Firestore como fonte da verdade + `localStorage` como cache/offline.
  Um adapter `window.storage` com `get(key)` / `set(key, value)`, onde cada chave do estado
  vira **um documento** numa collection (ex.: `logisticaData/events`, `logisticaData/folgas`).
  O valor é o JSON stringificado. Leitura com fallback pro cache quando o Firestore falhar.
- **Tempo real**: `onSnapshot` na collection inteira. Quando um doc muda em outro
  dispositivo, atualiza o `state`, refaz o cache e re-renderiza (com batch via
  `requestAnimationFrame`, pra não renderizar 5 vezes seguidas).
- **Fila offline**: se o `set` falhar, empilha a chave em `offlineQueue` no localStorage e
  sincroniza quando voltar. Bolinha de status online/offline no header.
- **PWA**: `manifest.json`, service worker (`sw.js`), ícones, `display: standalone`.
- **Deploy**: `render.yaml` como static site apontando pra `./public`, com
  `Cache-Control: no-cache`.

> **Importante:** crie um **projeto Firebase novo e uma collection nova** (`logisticaData`).
> Não reaproveite nenhum projeto/collection existente — existe outro calendário em produção
> e os dados não podem se misturar. O mesmo vale pro site no Render.

---

## 2. As 3 pessoas

| Pessoa | Papel | O que pode fazer |
|---|---|---|
| **Alberto** | `admin` (gestor) | Tudo: criar/editar/excluir evento, delegar tarefa, marcar reunião, cadastrar férias e folga, gerenciar equipe, ver eventos privados |
| **Ludmylla** | `viewer` | Vê o calendário, confirma presença, comenta, marca as tarefas dela como feitas, escreve nota pessoal e diário, manda mensagem, dá elogio, pede troca de dia / substituição / reunião |
| **Rosielene** | `viewer` | Idem Ludmylla |

Alberto é gestor **e também aparece no calendário como pessoa** — tem cor própria, entra na
contagem de carga, pode receber tarefa, tirar folga e férias. Ou seja: uma entrada normal do
roster que por acaso tem `role: 'admin'`.

Cada pessoa tem: `nome`, `cor` (hex), `foto`, `cidade` (pra previsão do tempo), `email`
interno (`ludmylla@logistica.cal` etc.) e `ativo`. Cores sugeridas — garanta contraste, o
app calcula a cor do texto automaticamente a partir da cor de fundo:

```js
const SEED_EQUIPE = {
  alberto:   { nome:'Alberto',   cor:'#A8C8F0', cidade:'...', email:'alberto@logistica.cal',   ativo:true },
  ludmylla:  { nome:'Ludmylla',  cor:'#F4C2D7', cidade:'...', email:'ludmylla@logistica.cal',  ativo:true },
  rosielene: { nome:'Rosielene', cor:'#B4E8B4', cidade:'...', email:'rosielene@logistica.cal', ativo:true }
};
```

O `SEED_EQUIPE` é só semente: assim que o Alberto mexer na equipe pela primeira vez, vale o
que está gravado em `state.equipe`. **Os eventos referenciam a pessoa pela chave**
(`collab: 'ludmylla'`), nunca pelos dados dela — então a chave nunca muda, mesmo se o nome
mudar. Quem é desativado sai da equipe ativa mas continua existindo no roster, pra não
quebrar o histórico.

### Login por PIN

Sem tela de senha longa: **PIN de 4 dígitos**. Como funciona:

1. Firebase Auth com email/senha, onde a senha é `pin + sufixo` (ex.: `'1234' + 'lg'`).
2. Um doc público `pinMap/map` mapeia `SHA-256(pin) → email`. O usuário digita o PIN, o app
   calcula o hash, descobre o email e faz `signInWithEmailAndPassword`.
3. Botão "Configurar contas" na tela de login (só aparece se o `pinMap` ainda não existe)
   cria as contas de uma vez. O `set` do pinMap tem que ser `{ merge: true }` — senão apaga
   o acesso de quem foi criado depois.
4. Ao adicionar alguém pela tela de equipe, o admin define o PIN dessa pessoa e o app cria
   a conta + a entrada no pinMap.

Regras do Firestore: `logisticaData` exige `request.auth != null`; `pinMap` e `authSetupDone`
são públicos (o login precisa ler antes de autenticar).

---

## 3. Telas e visualizações

**Header**: mês/ano em serifada grande, relógio, ← hoje →, alternador mês/semana/dia, e
ícones para: status da equipe, insights, histórico, solicitações (com badge), tema
claro/escuro, preferências, imprimir/PDF, backup JSON, e a bolinha online/offline.

**Banner** abaixo do header: próximo compromisso, uma citação do dia, e o clima da cidade da
pessoa logada (Open-Meteo, sem API key). Clicar no clima abre um modal com o tempo atual e a
previsão de todas as cidades da operação.

**Sidebar** (vira drawer no mobile): login/logout, filtro "só os meus", busca de eventos,
status do dia (no CD / em rota / na estrada / home office / folga), botões de Meu dia,
Mensagens, Elogios, Diário, Solicitar reunião, lista da equipe com foto e cor, próximos
compromissos, resumo do mês por pessoa e mural de elogios.

**Views**: mês (grade com os cartões coloridos por pessoa), semana e dia (linha do tempo por
hora). Feriados nacionais marcados. Aniversários. Chuva de flocos/confetes em datas festivas
(desligável nas preferências).

---

## 4. O modal do dia — 4 abas

Ao clicar num dia, abre um modal com os eventos existentes e, para o Alberto, um formulário
com **4 abas**:

### 📅 Evento
Título, início/fim, **Equipe & Tarefas** (escolhe a pessoa, a prioridade e a função — com
atalhos rápidos + campo livre), tipo, local, recorrência (diária/semanal/mensal/personalizada
"a cada N dias/semanas/meses, N vezes"), link, descrição, prioridade, 📌 fixar, 🔒 privado.

Um evento **precisa ter pelo menos uma tarefa atribuída**. Se todas as tarefas forem da mesma
pessoa, o evento é dela; se forem de pessoas diferentes, o evento é "Todos". Se a pessoa já
tiver 5+ eventos naquela semana, pede confirmação antes de sobrecarregar.

**Tipos de evento (adaptados pra logística):**

```js
const EVENT_TYPES = {
  entrega:     { label:'Entrega',      ico:'📦' },
  coleta:      { label:'Coleta',       ico:'📥' },
  rota:        { label:'Rota',         ico:'🚚' },
  carregamento:{ label:'Carregamento', ico:'🏗️' },
  inventario:  { label:'Inventário',   ico:'📋' },
  manutencao:  { label:'Manutenção',   ico:'🔧' },
  reuniao:     { label:'Reunião',      ico:'📞' },
  treinamento: { label:'Treinamento',  ico:'📚' },
  viagem:      { label:'Viagem',       ico:'✈️' },
  folga:       { label:'Folga',        ico:'🌴' },
  aniversario: { label:'Aniversário',  ico:'🎂' },
  tarefa:      { label:'Tarefa',       ico:'✅' },  // criada pela aba Tarefa, não aparece no seletor
  outro:       { label:'Outro',        ico:'✦' }
};
```

**Atalhos de função** (nas tarefas): 🚚 Rota, 📦 Separação, 🔍 Conferência, 🏗️ Carregamento,
📤 Expedição, 📋 Inventário, ⭐ Responsável, ✏️ Outro (campo livre).

**Modelos prontos** (um clique preenche o formulário): Rota Diária, Coleta Programada,
Inventário Mensal, Manutenção Preventiva.

### ✅ Tarefa
Monta uma fila de tarefas — pode misturar pessoas — e delega tudo de uma vez. Cada pessoa
recebe **um único cartão** com a lista dela, sem horário, e vai marcando uma a uma. O Alberto
pode delegar tarefa pra si mesmo.

### 👥 Reunião
Escolhe com quem (ou ★ Todos), horário e assunto. A reunião entra no calendário na hora — não
depende de aceite — e a equipe é notificada e confirma presença.

### 🏝️ Férias
Escolhe a pessoa, o mês, o dia de início e quantos dias (2 a 40, **dias corridos** — fim de
semana e feriado entram na conta). Mostra prévia do período e **avisa se o período colide com
compromissos já marcados** daquela pessoa. Lista embaixo as férias já cadastradas (de hoje em
diante), com opção de cancelar. Na mesma aba, a **folga avulsa do dia**: marca quem está de
folga e se é integral (🏖️) ou parcial (🌗 manhã/tarde). Folga não conta como carga do mês.

Para Ludmylla e Rosielene, no lugar do formulário aparece a **nota pessoal do dia** (texto +
ícone) e o aviso de que elas podem confirmar presença e comentar.

---

## 5. Funcionalidades de equipe

- **Confirmar presença (RSVP)** e **comentários** nos eventos, com menção `@nome`.
- **Solicitações**: pedir troca de dia, pedir substituição num evento, solicitar reunião com
  alguém. Tudo cai num modal de Solicitações com badge, e o destinatário aceita ou recusa.
- **Mensagens diretas** entre as pessoas, com badge de não lidas.
- **Elogios (kudos)**: manda um elogio pra alguém, aparece num mural na sidebar.
- **Meu dia**: prioridades do dia e blocos de tempo reservados.
- **Diário** pessoal por data, com contador de palavras e histórico.
- **Insights do mês**: eventos por pessoa (barras nas cores de cada uma), distribuição por
  tipo, e heatmap de qual dia da semana a equipe está mais ocupada.
- **Histórico** de ações (quem criou/editou/excluiu o quê e quando).
- **Status da equipe hoje**: onde cada pessoa está.
- **Busca** por título/descrição/local, e **backup JSON** + impressão em PDF.

---

## 6. Avisos

Nada de serviço externo de push — tudo acontece dentro do app, com a aba aberta:

- **Notificação do navegador** (API `Notification`, pedindo permissão na primeira vez).
  O `onSnapshot` compara o dado que chegou com o que estava no `state` e avisa quando é algo
  que interessa à pessoa logada: mensagem direta, elogio recebido, menção em comentário,
  convite de reunião, pedido de substituição, tarefa nova atribuída.
- **Nunca avisar quem disparou a própria ação.**
- **Badges** na sidebar e no header: mensagens não lidas, elogios novos, solicitações
  pendentes.
- **Toast** curto no rodapé pra confirmar o que acabou de ser salvo.

---

## 7. Visual

Estética **neo-brutalista suave**: fundo creme (`#FBF8F1`), tinta roxo-escura (`#1A1438`),
bordas de 1.5px, sombras sólidas deslocadas (`2px 2px 0`), cantos de 6px, botões pílula.
Tipografia: **Fraunces** (serifada, para títulos e frases em itálico) + **Inter** (interface).
Tema claro e escuro via `data-theme` no `<html>`, com as cores em CSS custom properties —
a cor de cada pessoa é injetada dinamicamente (`--c-ludmylla`, `--c-ludmylla-ink`), porque
quem entra depois também precisa nascer com cor.

Totalmente responsivo: no mobile a sidebar vira drawer com hambúrguer, e o modal trava o
scroll do body enquanto está aberto.

---

## 8. Detalhes que importam

- **Escape de HTML** em tudo que vem do usuário (título, comentário, nota, nome).
- **Links** só `http://` ou `https://`.
- Cartão de evento só fecha no **X** (não fecha ao clicar fora, pra não perder o que foi
  digitado).
- Ao editar um evento, preencher o formulário **da aba certa** — nunca preencher um
  formulário escondido.
- Estado do app (as chaves que viram documentos no Firestore):
  `events, statuses, history, customColors, birthdays, requests, notes, priorities, diary,
  blocks, reminders, kudos, messages, folgas, userPriorities, equipe, equipeFotos`.
  Tema e "modo festivo" são preferências **locais** por dispositivo, não sincronizam.
- Fotos da equipe vão em documento separado (`equipeFotos`) como data URL, pra não inchar o
  doc `equipe`.
- Feriados nacionais de 2026 a 2028 embutidos numa constante.

---

## 9. Entregáveis

```
public/
  index.html              ← o app inteiro
  manifest.json
  sw.js
  icon-192.svg
  icon-512.svg
  logo.png
  (fotos das 3 pessoas)
render.yaml
firestore.rules
SETUP-FIREBASE.md         ← passo a passo pra criar o projeto e publicar
```

Comece pelo `public/index.html` completo e funcional. Deixe as credenciais do Firebase como
placeholders bem marcados no topo do script, e explique no `SETUP-FIREBASE.md` exatamente
onde colar cada uma. Comentários no código em português, explicando **o porquê** das decisões
não óbvias — não o óbvio.
