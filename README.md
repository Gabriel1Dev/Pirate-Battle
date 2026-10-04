# Desafio React & Pixi JS — Pirate Battle

Desenvolva um **shooter naval 2D com visão superior** usando React, TypeScript e PixiJS. O jogador deve navegar entre ilhas, enfrentar navios inimigos e acumular pontos até o fim da partida.

O desafio avalia gameplay, domínio de PixiJS, arquitetura, integração de dados, experiência de uso e qualidade da entrega. Informe sua estimativa de prazo antes de iniciar.

## 1. Stack obrigatória

| Responsabilidade                        | Tecnologia                 |
| --------------------------------------- | -------------------------- |
| Interface e menus                       | React                      |
| Linguagem                               | TypeScript em modo estrito |
| Renderização do jogo                    | PixiJS                     |
| Estado remoto do ranking e do histórico | TanStack Query             |
| Cliente HTTP do ranking e do histórico  | Axios                      |
| Mocking das APIs de ranking e histórico | MSW                        |
| Testes E2E e regressão visual           | Playwright                 |

Todas as tecnologias devem participar efetivamente da solução. A ferramenta de build, a estilização e as bibliotecas complementares ficam a critério do candidato.

O jogo é single-player e deve funcionar integralmente no navegador. Gameplay e configurações são locais. Ranking e histórico de partidas usam APIs REST simuladas com MSW, consumidas por Axios e TanStack Query.

## 2. Gameplay

### Jogador

- Movimentação para a frente e rotação para os dois lados.
- Disparo frontal com um projétil.
- Disparo lateral com três projéteis paralelos, com comandos para o lado esquerdo e o direito do navio.
- Vida limitada, reduzida por projéteis inimigos e pelo impacto de um Chaser.
- Movimentação restrita à arena visível, sem atravessar ilhas.

Defina controles de teclado e controles de toque para movimento, rotação e ataques. Permita movimentar e disparar simultaneamente. Apresente os comandos na interface.

### Inimigos

| Tipo        | Comportamento                                                                |
| ----------- | ---------------------------------------------------------------------------- |
| **Chaser**  | Persegue o jogador, causa dano ao colidir com seu navio e explode no impacto |
| **Shooter** | Aproxima-se do jogador e dispara quando estiver dentro do alcance de ataque  |

Ambos devem avançar, rotacionar, receber dano e respeitar as colisões com ilhas. Os dois tipos precisam aparecer durante uma partida padrão.

Inimigos surgem a cada intervalo configurado até o encerramento da partida. Os pontos de spawn devem estar livres de obstáculos e suficientemente afastados do jogador para evitar dano imediato inevitável.

### Arena, colisões e combate

- A arena deve conter água e pelo menos uma ilha que bloqueie navios e projéteis.
- Projéteis devem respeitar direção, velocidade, dano e alcance ou tempo de vida.
- Disparos do jogador atingem inimigos; disparos inimigos atingem o jogador.
- Cada projétil deve aplicar dano uma única vez e ser removido ao atingir um alvo ou obstáculo, expirar ou sair da arena.
- Cada arma deve respeitar seu intervalo entre disparos.
- Inimigos destruídos deixam de causar dano, disparar e participar das colisões.

### Regras da partida

- Duração configurável entre **60 e 180 segundos** de jogo ativo.
- Cada inimigo destruído pelos ataques do jogador vale **1 ponto**. A autodestruição de um Chaser contra o jogador não pontua.
- A partida termina quando o tempo acaba ou a vida do jogador chega a zero.
- O encerramento interrompe movimento, ataques, dano, spawns e contagem de pontos.
- Reiniciar deve criar uma nova partida, com vida, pontuação, cronômetro e entidades restaurados.

Exiba vida acima do navio do jogador e de cada inimigo. O HUD deve apresentar também pontuação e tempo restante.

Implemente pausa manual e automática ao perder o foco ou ocultar a aba. Durante a pausa, cronômetro, cooldowns e simulação ficam suspensos. A retomada exige uma ação do jogador e não pode acumular movimento ou disparos do período pausado.

### Animações e feedback

Implemente efeitos de disparo, explosão de destruição e deterioração visual dos navios conforme a vida restante. A destruição combina explosão sobre o sprite, fragmentos de casco, vela, madeira e canhão que se espalham, e um bote com tripulantes como destroço temporário. Ataques, impactos e dano devem ter feedback perceptível, mantendo a leitura da arena.

## 3. Telas e configurações

| Tela           | Requisitos                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Menu principal | Ações **Play** e **Options**, instruções de controle e abas **Ranking** e **Match History**                                   |
| Options        | **Game session time** e **Enemy spawn time**, com validação, salvamento e persistência após refresh                           |
| Partida        | Arena PixiJS, HUD, controles e pausa                                                                                          |
| Resultado      | Pontuação total, tempo jogado, motivo do encerramento, situação do registro da partida e ações **Play Again** e **Main Menu** |
| Ranking        | Classificação, identificação dos jogadores, pontuação e paginação                                                             |
| Match History  | Histórico do jogador, com data, pontuação, duração, motivo do encerramento e paginação                                        |

Centralize os parâmetros de gameplay em uma configuração tipada e ajustável: duração, intervalo e distribuição dos spawns, vida, velocidades de movimento e rotação, dano, alcance, velocidade e duração dos projéteis, cooldowns e alcance do Shooter. Mudanças de balanceamento não devem exigir alterações na lógica dos sistemas.

A tela Options deve expor os dois parâmetros indicados. O intervalo de spawn deve ser positivo e ter limites documentados. Cada partida utiliza um snapshot da configuração vigente ao iniciar; alterações posteriores valem para novas partidas.

Recarregar a página ou sair da tela de combate encerra a partida em andamento. Persista localmente as opções do jogador e o resultado da última partida concluída. Uma partida abandonada não é registrada no ranking nem no histórico.

Interface, identificadores de código e documentação da solução devem estar em inglês. A identidade visual dos menus fica a seu critério e deve ser coerente com os assets do jogo.

## 4. PixiJS e arquitetura

Use PixiJS para arena, navios, projéteis, efeitos e indicadores sobre os navios. Use React nos menus, formulários, painéis e diálogos.

A solução deve demonstrar:

- separação entre regras do jogo, renderização, input e estado da interface;
- simulação baseada em tempo, com movimento, dano e spawns independentes da taxa de quadros;
- sincronização da interface com o jogo sem renderizações React a cada frame;
- carregamento e reutilização de texturas, com tratamento de falhas antes de iniciar o combate;
- ajuste do canvas à tela e à densidade de pixels, preservando proporções, coordenadas de input e limites da arena;
- liberação de listeners, ticker, timers, entidades e recursos ao sair ou reiniciar;
- inicialização e desmontagem corretas também com React Strict Mode.

O estado contínuo do combate deve permanecer na simulação. A estratégia de gerenciamento de estado e de sincronização com a interface fica a critério do candidato.

As regras de movimentação, combate, colisões e comportamento dos inimigos devem ser implementadas pelo candidato. A organização interna é livre; descreva as principais decisões em `ARCHITECTURE.md`.

## 5. Ranking e histórico de partidas

Implemente as abas **Ranking** e **Match History** no menu principal, com contratos tipados para os seguintes recursos:

| Recurso   | Operações mínimas                                                           |
| --------- | --------------------------------------------------------------------------- |
| Ranking   | Consultar classificação paginada, ordenada por pontuação                    |
| Histórico | Registrar uma partida concluída e consultar o histórico paginado do jogador |

Cada registro deve conter identificação da partida e do jogador, data, pontuação, duração efetiva, motivo do encerramento e configuração usada. Compare no ranking partidas com a mesma configuração e adote um critério determinístico de desempate. Outros jogadores são representados por fixtures.

Use **Axios** nas chamadas HTTP e **TanStack Query** nas consultas e no registro de partidas. Gerencie carregamento, vazio, erro, atualização em segundo plano, cache, invalidação e retries. Atualize as duas abas após registrar uma partida e ao voltar a exibi-las. Respostas atrasadas não devem sobrescrever dados mais recentes.

Uma partida concluída deve gerar um único registro no histórico e uma única entrada no ranking. Reenvios e cliques repetidos devem recuperar o registro existente, sem duplicação. Preserve registros pendentes após falhas ou refresh e permita tentar novamente. O jogador deve conseguir iniciar outra partida enquanto houver um registro pendente.

Falhas nessas APIs não devem bloquear o acesso ao jogo, às configurações ou interromper o combate. Essas integrações se limitam ao ranking e ao histórico de partidas.

## 6. Mocking com MSW

Implemente os mocks das APIs de ranking e histórico na camada de rede, compartilhando contratos, fixtures e handlers entre desenvolvimento, testes e demonstração. Registros confirmados devem aparecer nas consultas seguintes, com estado consistente entre as duas abas.

### Simulating Network Conditions and Failures

Disponibilize cenários configuráveis e reproduzíveis para:

- sucesso, listas vazias e múltiplas páginas;
- lentidão, latência variável e respostas fora de ordem;
- timeout, falhas de conexão e respostas HTTP 4xx/5xx;
- falha ao consultar ranking ou histórico;
- timeout depois de registrar uma partida, com recuperação sem duplicação;
- indisponibilidade no encerramento da partida e registro após recuperação.

Inclua uma forma de selecionar os cenários e restaurar o estado inicial. Controle aleatoriedade e latência nos testes. Os mocks devem funcionar no build publicado. Use persistência local para manter os registros confirmados e os envios pendentes após refresh.

## 7. Interface, assets e acessibilidade

Os arquivos estão disponíveis em [assets/](assets/): navios, partes de navios, projéteis, efeitos, tiles, sprites de HUD e menus, spritesheets e imagens de referência. Os atlas de interface estão em [ui_sheet.json](assets/spritesheet/ui_sheet.json) e [ui_sheet_retina.json](assets/spritesheet/ui_sheet_retina.json), com recortes, alinhamento e caminhos dos PNGs individuais. Os campos `ui` contêm metadados complementares; suas medidas e as bordas usam unidades lógicas (1×), relativas ao canto superior esquerdo do sprite. Os efeitos sonoros e loops de ambiente estão em [assets/sounds/](assets/sounds/), no formato WAV. A interface reproduz sons de navegação; a partida associa efeitos e loops aos tiros, impactos, dano, pontuação, alertas, pausa e encerramento. A vela rasgada do jogador aparece progressivamente conforme a vida cai, usando os limites visuais da configuração da partida.

Utilize os assets fornecidos como base visual. Conversão de atlas, otimização de imagens e recursos complementares são permitidos; inclua as fontes e licenças correspondentes na entrega.

A interface e o jogo devem funcionar em desktop e mobile, com controles de toque utilizáveis e sem cortes na arena ou no HUD. Defina a orientação suportada no mobile e adapte o layout à mudança de tamanho sem alterar as regras da partida.

O carregamento dos assets da partida deve ter progresso ou estado de carregamento visível.

Garanta navegação por teclado nos menus, foco visível, controle de foco em diálogos, labels, contraste adequado e mensagens de erro acessíveis. Disponibilize pontuação, tempo e estado da partida também em uma interface semântica; evite anúncios a cada frame. As teclas do jogo só devem ser capturadas enquanto o contexto de gameplay estiver ativo.

## 8. Testes com Playwright

Entregue testes E2E cobrindo:

1. Navegação, validação e persistência das opções.
2. Carregamento dos assets, falhas e nova tentativa.
3. Início de partida, movimento, rotação, limites da arena e colisão com ilhas.
4. Disparos frontal e lateral, dano, cooldown e pontuação sem duplicação.
5. Comportamentos de Chaser e Shooter e intervalo de spawn.
6. Encerramento por tempo e por morte, interrupção da simulação e reinício limpo.
7. Pausa, perda de foco e retomada sem avanço indevido do cronômetro.
8. Exibição do resultado e sua persistência após refresh.
9. Abandono da partida, navegação repetida entre telas e controles de toque.
10. Consulta e paginação das abas Ranking e Match History, incluindo carregamento, vazio e erro.
11. Registro da partida, atualização das duas abas e recuperação de envio pendente após refresh.
12. Reenvio após timeout sem duplicação e respostas atrasadas sem sobrescrever dados recentes.

Execute os fluxos principais em Chromium, em desktop e mobile. Inclua regressão visual do menu, da arena em um estado estável e da tela de resultado, com baselines versionadas.

Use cenários com seed e controle do tempo da simulação para tornar os testes reproduzíveis. A instrumentação de teste pode observar o estado e controlar o relógio, preservando a execução real das regras, inputs, colisões e renderização. Os testes de combate devem acionar controles do jogo e verificar seus efeitos.

Cada teste deve partir de um estado isolado. Entregue relatório HTML e traces das falhas.

## 9. Performance do jogo

Avalie a performance do combate em build otimizado, com **60 FPS como alvo** no ambiente de referência documentado. Registre taxa de quadros, percentil 95 do tempo entre frames e quantidade de entidades em uma partida de três minutos.

Verifique o uso de memória após cinco ciclos de iniciar, jogar e sair, investigando crescimento contínuo de recursos. Entregue evidências de profiling com hardware, navegador, resolução, configuração da partida e limitações observadas.

## 10. Critérios de avaliação

| Critério                                                    |  Pontos |
| ----------------------------------------------------------- | ------: |
| Gameplay, regras, colisões e comportamento dos inimigos     |      35 |
| PixiJS, arquitetura e ciclo de vida dos recursos            |      20 |
| Interface, feedback, responsividade e acessibilidade        |      15 |
| TanStack Query, Axios e consistência do ranking e histórico |      10 |
| MSW e cenários de falha                                     |       5 |
| Testes com Playwright                                       |      10 |
| Performance e documentação                                  |       5 |
| **Total**                                                   | **100** |

Serão considerados o funcionamento completo da partida, a clareza das responsabilidades, a qualidade do código e a execução reproduzível. O console deve permanecer sem erros não tratados durante os fluxos previstos.

## 11. Entrega

Entregue o repositório com código-fonte, lockfile, assets, mocks, fixtures e testes.

O **deploy é obrigatório**. Envie uma URL pública e funcional do jogo. Recomenda-se [Vercel](https://vercel.com/); [Netlify](https://www.netlify.com/) e [Cloudflare Pages](https://pages.cloudflare.com/) também são aceitos.

A versão publicada deve corresponder ao código entregue, permanecer funcional e acessível durante a avaliação e executar os mocks de ranking e histórico. O jogo deve funcionar ao abrir ou recarregar a URL publicada.

O `README.md` da solução deve incluir setup, variáveis de ambiente, controles, configuração de gameplay, seleção e reset dos cenários de rede, comandos e instruções para reproduzir falhas. Disponibilize comandos para desenvolvimento, build, preview, lint, verificação de tipos e Playwright.

Documente em `ARCHITECTURE.md` a integração React/PixiJS, o ciclo da simulação, colisões, gerenciamento de recursos, persistência local e integração do ranking e histórico, incluindo contratos, cache e recuperação de registros pendentes. Registre limitações e decisões de balanceamento.

Inclua os relatórios de testes e profiling. A solução deve executar a partir de um checkout limpo, sem depender de serviços privados.

---

## Current build: setup and controls

The Portuguese sections above describe the full challenge requirements. The
following section documents the current implementation; features not listed as
implemented here are still pending.

### Requirements

- Node.js 20.19+ or 22.12+
- npm

### Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite to play. Available validation commands:

```sh
npm run build
npx tsc -b --pretty false
npm run lint
npm run test:e2e
npm run test:profile
npm run preview
```

`npm run build` performs the TypeScript project build before creating the Vite
production bundle. Install the Playwright Chromium browser once with
`npx playwright install chromium`. `npm run test:e2e` runs the suite against
Chromium desktop and a mobile Chromium profile and writes the HTML report to
`playwright-report/`; open it with `npm run test:e2e:report`. To intentionally
replace screenshot baselines after reviewing a visual change, use
`npm run test:e2e:update`.

`npm run test:profile` creates a separate optimized profiling build, serves it
with Vite Preview, and records frame pacing, three-minute match entity counts,
and heap readings across twenty start/exit cycles. The profile-only test hook is
not included in the normal production build. Profiling output and the written
measurements are documented in `PERFORMANCE.md`.

### Implemented gameplay

- Start, play, pause, resume, restart, and return to the main menu.
- Move forward and turn with **W/Up**, **A**, and **D**.
- Fire the front cannon with **Space** and left/right broadsides with **Q/E**.
- On touch screens, use the six on-screen buttons for the same actions.
- Sink enemies for points, avoid Chaser collisions and Shooter projectiles, and
  survive until the match timer expires.

The current build includes the seeded simulation, fixed-step clock, enemy
spawning and combat, circular island obstacles, PixiJS rendering, ship health
bars, combat effects, a throttled HUD, and a persisted Options screen. Use
**Options** from the main menu to set the game session time (60–180 whole
seconds) and enemy spawn time (1–10 whole seconds). Saved options are restored
after refresh and copied into a configuration snapshot when a new match starts;
changes affect future matches only. Defaults are 90 seconds per match and 3
seconds between spawns. Game tuning and limits are defined in
`src/game/config.ts`.

Each match receives a client-generated ID. On time or player death, its score,
active duration, end reason, completion time, and full config snapshot are
saved to localStorage as a pending submission before upload. Axios submits the
record through TanStack Query to the MSW-backed API, which upserts by match ID;
confirmed records are marked locally and pending records are retried after
refresh or with the menu retry action. API errors never block gameplay.

Use **Ranking** and **Match History** from the main menu to browse paginated
API results. Ranking entries are filtered to the exact current match config and
ordered by score descending, duration ascending, completion date ascending,
then match ID. Fixture players populate the ranking. The **Network demo**
selector in the menu exposes success, empty, pagination, latency, timeout,
HTTP error, per-endpoint failure, timeout-after-save, and offline-on-finish
scenarios. Selecting a scenario also updates the `scenario` query parameter;
**Reset mock data** restores the success scenario and clears mock-server data.
The mocks run in development and production and persist accepted mock matches
locally in the browser.

Playwright currently covers options persistence, deterministic movement and
combat/spawning, island and arena-boundary blocking, match end on player death,
manual and focus-loss pause, fresh-match behavior, mobile touch controls,
asset load retry, combat damage/cooldowns/scoring, end by timer, abandoned
matches, result persistence across refresh, pending upload recovery,
timeout-after-save idempotency, delayed ranking responses, and pagination plus
empty/failure scenarios. Visual baselines cover the menu, paused arena, and
completed result on both viewports; they are stored under
`e2e/__screenshots__/`. Test traces and failure artifacts are written under the
ignored `test-results/` directory. The latest validation results and the
profiling conditions are recorded in `TEST_REPORT.md` and `PERFORMANCE.md`.
The production preview also confirmed that MSW starts, a completed match is
submitted once, and its record appears in history and ranking.

### Deploy to Vercel

The repository includes `vercel.json` with the Vite build command and `dist`
output directory. The public deployment is
https://pirate-battle-navy.vercel.app/. No environment variables or external API
credentials are required: ranking and history are served by MSW in the
production build. After pushing changes, verify the updated deployment at that
URL.

In development, `window.__game` can read a copied simulation state, set the
current input, advance a deterministic amount of simulation time, reset with a
seed, or switch back to the real-time clock. The hook is also enabled in the
separate performance profile build for reproducible entity counts; it is
omitted from normal production builds.

## Project architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the simulation/rendering boundary,
fixed-step lifecycle, input handling, pause behavior, current limitations, and
the planned integration boundaries for features not implemented yet.
See [copilot-instruction.md](./.github/copilot-instructions.md) for the project's System Design Specification (SDD), defining its architecture, technical requirements, coding conventions, and operational context for integration with generative AI models and AI-powered development agents. See GitHub README for the project overview.
