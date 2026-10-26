# Puzzle Hunt — sketch base

Puzzle match-3 de caçada inspirado em **Wedding Escape** (Firebird Games, 2015), com tema
de Monster Hunter. Roda direto no navegador (desktop ou celular), sem build.

```
python dev/serve.py
```
Depois abra http://localhost:5173. Abrir o `index.html` direto pelo arquivo também funciona na maioria dos navegadores.

## Do Wedding Escape para cá

| Wedding Escape | Puzzle Hunt |
|---|---|
| Faixa de corrida no topo, perseguidor atrás | **Faixa de caçada**: o caçador persegue o monstro com o cenário correndo |
| Placa "TILES TO GO" | Placa **VIDA** com quanto falta para abater o monstro |
| **MOVES** no centro | **JOGADAS** no centro: cada combinação gasta uma; quando acabam, o monstro ataca |
| Peças com +1/+2 | Peças com **+1** devolvem uma jogada |
| Contadores por cor que liberam poderes | Contadores por elemento: Fogo → Barril-Bomba, Gelo → Armadilha, Raio → Bomba de Luz, Água → Mega Poção; Dragão carrega o especial da arma |
| Grade de moedas/diamantes | Grade 7x8 com 5 elementos no formato dos ícones de elemento de MH |
| Virar peças | **Arrastar para trocar** com a vizinha (ou tocar em duas); se não combinar, a troca volta e não gasta jogada |
| Peça especial com 5+ | **4 em linha** = Lâmina (limpa a linha/coluna); **5+ ou L/T** = Ponto Fraco (explode 3x3, dano extra) |
| 60 personagens colecionáveis | **Forja**: monstros dropam materiais que viram armas novas |

## Loop de jogo

1. Escolha a missão no quadro e parta para a caçada.
2. Combine peças: cada peça destruída voa como energia até o monstro e causa dano.
   O elemento da **fraqueza** causa x2 e o da **resistência**, x0,5. Cascatas multiplicam o dano.
3. Cada combinação gasta uma **jogada**. Quando as jogadas acabam o monstro ataca (o próximo
   ataque aparece na faixa) e elas recomeçam:
   - **Mordida, Investida, Rabada**: dano direto
   - **Arremesso de Pedra** (Kulu-Ya-Ku): pedras que só quebram com combinações ao lado
   - **Bola de Fogo** (Anjanath, Rathalos): peças queimadas que não podem ser movidas
   - **Cauda Venenosa** (Pukei-Pukei): veneno que tira vida por 3 jogadas (a poção cura)
   - **Rugido**: trava o tabuleiro por um instante e tira uma jogada da próxima rodada
4. Cada peça combinada desconta do **contador do seu elemento**; ao zerar, o poder fica **PRONTO**
   (toque para usar, não gasta jogada). Só combinações enchem os contadores, não as peças
   destruídas por poderes.
5. Com metade da vida o monstro fica **enfurecido**: ataca uma jogada mais cedo e mais forte.
6. Desmaiar 3 vezes falha a missão. Estrelas: 3 sem desmaios, 2 com 1, 1 com 2.
7. A vitória dá materiais; na **Forja** eles viram as 14 armas, cada uma com passiva e especial
   próprios (o especial carrega combinando peças de Dragão). Espada Grande e Espada e Escudo já vêm liberadas.

| Arma | Passiva | Especial |
|---|---|---|
| Espada Grande | +20% de dano | Corte Carregado: corta 2 linhas |
| Espada e Escudo | bloqueia 20%, poção cura o dobro | Golpe Perfeito: linha + coluna e cura 30 |
| Espada Longa | +40% por combo | Corte Espiritual: coluna inteira + 30% de dano por 3 jogadas |
| Lâminas Duplas | +50% por combo | Modo Demônio: 4 jogadas com dano x2 |
| Martelo | pontos fracos x2 | Golpe Giratório: 3x3 + nocaute (+2 jogadas) |
| Lança | bloqueia 40% | Investida: linha inteira e jogadas cheias |
| Berrante | cada peça cura um pouco | Recital: cura 40 e +50% de dano por 3 jogadas |
| Glaive Inseto | fraqueza x2,2 | Mergulho Aéreo: anel 5x5 |
| Fuzil Leve | especial enche muito rápido | Rajada: 12 peças aleatórias |
| Arco | fraqueza x2,8 | Chuva de Flechas: dano + 3 trios do elemento fraco |
| Machado Alternado | +10% de dano, lâminas x2 | Descarga Elemental: as duas diagonais |
| Lançarma | pontos fracos x1,5, bloqueia 20% | Fogo de Wyvern: explosão em losango |
| Lâmina Carregada | especial enche rápido | Descarga Ampliada: todas as peças de um elemento |
| Fuzil Pesado | +25% de dano, especial lento | Tiro de Wyvern: 3 colunas |

Para balancear, carregue `dev/sim.js` no console do jogo (instruções no topo do arquivo): ele
joga caçadas automáticas e mostra vitórias, jogadas e desmaios.

## Estrutura

- `index.html`, `style.css`: telas e layout retrato para celular (tema pixel no bloco `.theme-pixel` no fim do CSS)
- `js/data.js`: elementos, missões, ataques, itens, armas e materiais (todo o balanceamento de conteúdo)
- `js/game.js`: regras (jogadas, contadores, poderes, ataques), entrada por toque/arraste e telas; constantes no topo
- `js/art.js`: monta personagens, peças, ícones e cenários na tela
- `js/pixel.js`: peças do tabuleiro (seguindo os ícones de elemento de MH) e ícones de armas/itens em pixel art, gerados em código com contorno, luz e sombra automáticos
- `js/fx.js`: partículas em canvas e sons sintetizados com WebAudio
- `js/cloud.js`, `js/firebase-config.js`, `firestore.rules`: login com Google e perfil na nuvem (Firebase)
- `assets/pixel/`: os 5 monstros, recortados da arte original em `assets/source/arte-original.png`
- `dev/cutout.html`: recorta os personagens da arte original e remove o fundo
- `dev/pixel.html`: personagens, peças e ícones ampliados, para revisar
- `dev/serve.py`: servidor local sem cache
- `dev/sim.js`: simulador de balanceamento (bot que joga caçadas)

## Visual

Tudo é pixel art: os personagens da arte original, peças e ícones gerados em código e cenários
pixelizados. A interface acompanha: fonte pixelada, fundo roxo quadriculado, faixas vermelhas
como a do banner da arte, molduras com cantos de pixel e barras de vida em blocos.

## Publicação e login

- **Site**: GitHub Pages, publicado a partir da branch `main` (raiz do repositório).
- **Login com Google (opcional)** via Firebase Authentication. Quem entra tem o perfil salvo no
  Firestore (`profiles/<uid>`): monstros derrotados (total e por monstro), estrelas, materiais e
  armas forjadas. Sem login, tudo fica salvo só no aparelho (`localStorage`). Ao entrar, o
  progresso do aparelho e o da nuvem são juntados (fica o maior de cada valor).

### Configurar o Firebase (uma vez)

1. Em https://console.firebase.google.com crie um projeto.
2. **Authentication → Método de login → Google**: ative.
3. **Authentication → Configurações → Domínios autorizados**: adicione `yurineves92.github.io`.
4. **Firestore Database**: crie o banco e, na aba **Regras**, cole o conteúdo de `firestore.rules`.
5. **Configurações do projeto → Seus apps → Web (`</>`)**: registre o app e copie o objeto
   `firebaseConfig` para `js/firebase-config.js` (no lugar do `null`).

Esses valores de configuração são públicos por design; quem protege os dados são as regras do
Firestore, que só deixam cada jogador ler e escrever o próprio perfil.

## Próximos passos sugeridos

1. **Partes quebráveis**: cabeça/cauda com vida própria; quebrar dá material raro.
2. **Armaduras**: segundo slot da forja (mais vida, resistência a veneno/fogo).
3. **Mais monstros e padrões de ataque** (ex.: Legiana congelando peças, Zinogre carregando o tabuleiro).
4. **Mais personagens**: desenhar novos monstros no mesmo estilo da arte original e
   recortá-los com `dev/cutout.html`, como nos 60 colecionáveis do Wedding Escape.
5. **Android**: empacotar com Capacitor (`npx cap add android`) quando o loop estiver validado.

> Projeto de fã, sem fins comerciais, em homenagem a Monster Hunter. Nomes de monstros, armas e
> itens pertencem à Capcom.
