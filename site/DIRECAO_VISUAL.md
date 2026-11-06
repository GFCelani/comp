# Direção visual — Tradutor do Copom

Alvo: sério, de mercado financeiro, claro para quem não é economista. Fundo escuro azul-marinho, cartões com borda sutil, números grandes, uma cor de destaque fria (ciano) e uma quente (âmbar/vermelho) só para sinal de tom.

O que tirei de cada referência:

1. `1750430880125.jpg` (dashboard azul-marinho de chamados): fundo azul profundo com cartões um tom mais claro e borda fina; coluna de KPIs com rótulo pequeno em cima e número grande embaixo; um gráfico largo dominando o meio da tela.
2. `1_rQ3d_dKG7V2JhX8SrUjs6g.png` (CRM dashboard escuro): grid de cartões com cantos arredondados e muito respiro; gráfico de linha com grade pontilhada discreta e tooltip em destaque; legenda à direita do título do cartão.
3. `D_NQ_NP_..._power-bi-dashboard...webp` (Power BI preto e verde-água): linha de KPIs no topo, uma única cor de destaque (aqui ciano) sobre quase-preto; o resto em cinza; tabelas de barras horizontais com rótulos numéricos ao lado.
4. `Dashboard-Comercial-no-Excel-12.png` (Excel azul-royal): títulos de seção como faixas discretas; gráfico de linha com os valores escritos em cada ponto (vou escrever o índice nos pontos do gráfico); rótulos sempre em português e curtos.
5. `MailChimp_Blog_Post_...png` (dashboard amarelo e preto): contraste forte entre barra lateral preta e área de conteúdo clara; tipografia limpa sem serifa; número principal em cor de destaque e número de comparação em cinza. Daqui vem a ideia de "valor atual em cor, valor anterior em cinza" nos cartões.
6. `luke-chesser-...jpg` (painel analítico em laptop, preto com ciano/rosa/verde): títulos de cartão em caixa alta pequena e cinza; número grande colorido com a cor da série; duas escalas no mesmo gráfico (eixo esquerdo e direito) — exatamente o que o gráfico índice × Selic precisa.

Decisões derivadas:

- Paleta: fundo `#0b1220`, cartão `#111a2e`, borda `#1f2a44`, texto `#e6ebf5`, texto secundário `#8b97b3`; destaque ciano `#38bdf8` para índice/ação; tom duro `#f59e0b` (âmbar) e brando `#34d399` (verde); erro/aperto no painel `#f87171`.
- Fonte: Inter (via `next/font`), números com `font-variant-numeric: tabular-nums`.
- Títulos de cartão em caixa alta pequena, cinza, letter-spacing leve. Títulos de seção com quebra de linha escrita no código, sem `text-wrap: balance`.
- Botões em minúsculas normais ("perguntar", "ver ata"), nunca Title Case.
- Trechos de atas sempre curtos, em itálico leve, com nº do parágrafo antes e link para o PDF depois.
- Mobile: tudo em uma coluna, gráfico com altura fixa, cartões de KPI em grid 2×2.
