# Direção visual — Tradutor do Copom (v2, tema claro)

Alvo: jornal financeiro claro e minimalista. Texto e gráficos são os protagonistas; o resto recua. Muito espaço em branco, uma cor de destaque só, acabamento de detalhe no nível das quatro referências. O `/painel` é um produto separado (aplicativo de página única), com os mesmos tokens.

Medições feitas no Playwright em 06/11/2026 (1440×900, estilos computados). Capturas em `.playwright-mcp/ref-*.png`. Nada de textos, logos ou marcas dessas páginas entra no site; só medidas e padrões.

## O que entra de cada referência

| Referência | O que medimos | O que entra |
|---|---|---|
| **leblon-equities** (páginas internas `/cotas/`, `/acoes/`, `/acao/…`), clara, petróleo | Inter; H1 56–64px/500, −0,025em, entrelinha 1,02; lead 19px/30,8px; primária `#3B6065`; superfície `#F7F9F9`; tabelas com números à direita, `lining-nums tabular-nums`, zebra, linhas por `box-shadow inset` (não borda), régua mais forte sob o cabeçalho; faixa de KPIs com divisores verticais de 1px; raios 6/10/14px | **A base do tema**: acento petróleo profundo (nosso `#11646b`, mais escuro e mais saturado, não o da marca), gramática de tabela (`.tabela`: inset, zebra `papel-2`, números à direita), faixa de números com divisores, peso 500 nos títulos grandes |
| **cartoes-nfc**, clara, tons quentes | Instrument Sans + Geist Mono; H1 56,8px/600, −0,038em, entrelinha 1,035; container 1152px + 32px; seções com 86–96px; sombra de cartão em 3 camadas (`inset 0 1px 0 branco, 0 1px 2px, 0 16px 36px -16px`); hairlines na cor do texto com 10–22% de alfa | A sombra em 3 camadas do `.cartao-destaque` (cartão da previsão na capa), o container de ~1200px com 32px de lateral, o tracking apertado nos títulos. Não entram: o gradiente no texto e os tons quentes |
| **cardine.dev**, escura | Mesmas fontes; H2 46px/600; seções com ~130px de respiro; coluna de texto de 672px; cartões sem sombra, só contorno de 1px; linhas pontilhadas finas; 9 elementos com `tabular-nums`; ícones de 16px com traço 2 | O respiro grande entre seções, a coluna de leitura estreita (~680px), o contorno em vez de sombra nos cartões comuns, a grade pontilhada fina nos gráficos, ícones pequenos de traço fino. Não entra: o fundo escuro |
| **vallt.app**, escura | Geist (variável) + Geist Mono para números; H1 80px/600, −0,03em, entrelinha 0,98; três cinzas de texto; acento usado num ponto só; cartões raio 16px, botões 12px; números em mono, alinhados à direita | Geist como fonte de interface, três níveis de cinza (`tinta`, `tinta-2`, `tinta-3`), o acento num ponto só por bloco, Geist Mono só em datas e fontes pequenas. Não entra: o laranja e o halo |
| **imagens em `referencias/`** (painéis) | Barra lateral de ~240px; KPI com rótulo pequeno em cima e número grande; cartões brancos sobre `#F6F6F8` sem sombra (MailChimp, a única clara); grade só horizontal; tooltip em cartão branco; linha de média tracejada com rótulo direto | O layout do `/painel`: barra lateral branca de 240px, conteúdo sobre `papel-2`, cartões brancos com hairline, KPIs com número tabular de 28–32px, item ativo com fundo `acento-suave`. Não entram: gradientes, glass, donuts decorativos, eixo duplo, valor escrito em todos os pontos |

## Tokens escolhidos (`app/globals.css`)

**Fontes**
- Newsreader (serifa variável com tamanho óptico) para manchete, títulos editoriais e o corpo do relatório (`.titulo-serifa`, `.texto-leitura`, `.trecho`). Peso 500 nos títulos, −0,02em.
- Geist para interface, números e rótulos (`font-sans`), sempre com `tabular-nums lining-nums` em números (`.num`).
- Geist Mono só em datas e fontes pequenas, com moderação.
- Escala: manchete 44→68px (entrelinha 1,04); título de seção 32–40px; corpo do relatório 19px/1,68 (17px no celular); interface 15–16px; rótulo 13px (`.rotulo`, caixa normal, nunca caixa alta); mínimo 12px.

**Cores** (contraste sobre branco)
- `papel #ffffff`, `papel-2 #f6f7f8` (faixas, painel), `papel-3 #eef0f2` (trilhos, hover)
- `tinta #101317` (texto), `tinta-2 #474f58` (8,6:1), `tinta-3 #69717b` (4,9:1, rótulos)
- `linha #e4e7eb` (hairline), `linha-2 #d3d8de` (campo, régua média)
- `acento #11646b` petróleo profundo (6,9:1), `acento-2 #0b4d53` (hover), `acento-suave #e7f1f1` (marca de citação, seleção, item ativo)
- Estado (só no painel e em selos, sempre com texto): `ok #17784a`, `alerta #9a5b00`, `erro #b42d22`, cada um com fundo suave.

**Espaçamento**: escala de 4px (4, 8, 12, 16, 24, 32, 48, 64, 96, 128). Container 1200px com 16px (celular) / 32px de lateral. Seções da página pública separadas por 96–128px no desktop, 64px no celular. Padding de cartão 20–28px.

**Raios**: 4px (marca de citação), 10px (campo, tooltip), 14px (cartão), 18px (cartão de destaque), 999px (botão e selo).

**Sombras**: `sombra-1` (cartão comum, quase nada: `0 1px 2px` + `0 2px 8px -2px` a 4–5%); `sombra-2` (cartão de destaque, 3 camadas com brilho interno). Nada de sombra cinza padrão em tudo.

## Gráficos

- Uma cor só: a série principal em `acento`, 2px; todo o resto em cinzas (`tinta-2`, `tinta-3`, `linha`).
- Nunca eixo duplo: tom e Selic em dois painéis empilhados com o mesmo eixo de reuniões.
- Eixos leves (hairline), no máximo 3–5 linhas de grade horizontais, rótulos de 12px em `tinta-3`.
- Legenda dentro do gráfico, como rótulo direto na ponta da linha; anotações curtas nos pontos de virada da Selic (início das altas, pausa, início dos cortes), derivadas dos dados.
- Tooltip em cartão branco com hairline e `sombra-2`; crosshair vertical; tabela escondida para leitor de tela.

## Regras de acabamento

- Títulos com quebra de linha escrita no código, sem `text-wrap: balance`. Botões em minúsculas, nunca Title Case.
- Rótulos em caixa normal; nada de etiqueta em caixa alta espaçada acima de todo título.
- Nada de gradiente, glass, ícone grande ou cartão genérico repetido. Ícone, quando houver, 16px e traço fino.
- Trechos das atas sempre em serifa itálica, com régua vertical de 2px em `acento`, número do parágrafo e link para o PDF.
- O que não existe no JSON aparece como `.aguardando` (ponto vazado + "aguardando"), nunca como número.
- Celular: uma coluna, nada corta nem sobrepõe em 390px, fonte mínima 12px.
