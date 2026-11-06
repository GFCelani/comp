# Direção visual — Tradutor do Copom

Alvo: sério, de mercado financeiro, claro para quem não é economista. A página pública tem estrutura de **jornal financeiro** (manchete, linha fina, data e edição, editorias, colunas de texto com gráficos integrados), não de landing page. O `/painel` é um painel de análise com números em destaque e gráficos, no mesmo acabamento.

## Sites de referência (direção principal)

- **leblon-equities.vercel.app, páginas internas** (`/cartas/`, `/carta/carta-leblon-22/`; capturas em `.playwright-mcp/ref-leblon-*.png`): estrutura de página editorial. Título grande e sem ornamento, linha fina logo abaixo, linha de data separada por uma régua fina, e uma régua mais forte fechando o cabeçalho. Listas em linhas (etiqueta pequena em cima, título embaixo, data à direita) em vez de cartões soltos. Daqui vêm: a manchete + linha fina + linha de data com `regua-forte`, as editorias com título e régua, a lista de atas em linhas e o rodapé em colunas.
- **cardine.dev** (`.playwright-mcp/ref-cardine*.png`): acabamento. Fundo quase preto com leve tom esverdeado, manchete com tracking apertado (−0,035em), etiquetas pequenas em fonte mono com um ponto colorido antes ("● rio de janeiro · brasil"), botões em pílula, muito respiro entre blocos, números de passo (01, 02…) nas seções. Daqui vêm: `--fundo #0a0e13`, a classe `.etiqueta`/`.pilula` em Geist Mono, os botões em pílula e os kickers numerados do painel.
- **vallt.app** (`.playwright-mcp/ref-vallt-top.png`): acabamento. Âmbar como única cor de destaque sobre o fundo escuro (segunda linha da manchete, botão principal), texto secundário cinza-azulado bem legível, cartão de "relatório" com barras finas e números tabulares. Daqui vêm: `--acento #f5a524` para índice/links/botão principal, o cinza `--texto-2`, e os cartões de métrica do painel.

Regras: nada de textos, logos ou marcas desses sites; só estrutura e acabamento.

## Imagens em `referencias/` (complemento)

1. `1750430880125.jpg` (dashboard azul-marinho): cartões com borda fina um tom acima do fundo; rótulo pequeno em cima, número grande embaixo.
2. `1_rQ3d_dKG7V2JhX8SrUjs6g.png` (CRM dashboard escuro): grade pontilhada discreta no gráfico e tooltip em destaque.
3. `D_NQ_NP_..._power-bi-dashboard...webp` (Power BI): uma única cor de destaque sobre quase-preto; o resto em cinza.
4. `Dashboard-Comercial-no-Excel-12.png` (Excel azul): valores escritos nos pontos do gráfico de linha; rótulos curtos em português.
5. `MailChimp_Blog_Post_...png` (amarelo e preto): número atual em cor de destaque, número de comparação em cinza.
6. `luke-chesser-...jpg` (painel analítico): duas escalas no mesmo gráfico (eixo esquerdo e direito), títulos de cartão discretos.

## Decisões

- Paleta: fundo `#0a0e13`, cartão `#10171f`, borda `#1d2733`, texto `#eef2f6` / `#94a1af`; âmbar `#f5a524` para índice, links e ação principal; tom duro `#f0785a` (coral), tom brando `#3fc7b5` (verde-água); erro `#f07070`.
- Fontes: Inter para texto e títulos (tracking negativo nos títulos); Geist Mono só nas etiquetas pequenas e na linha "edição nº · data".
- Títulos com quebra de linha escrita no código, sem `text-wrap: balance`. Botões em minúsculas, nunca Title Case.
- Trechos de atas sempre curtos, em itálico ou como citação em destaque, com nº do parágrafo antes e link para o PDF depois.
- Celular: tudo em uma coluna; colunas de texto viram blocos empilhados; gráfico com altura fixa.
