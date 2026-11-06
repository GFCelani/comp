# Sentiment Tracker do Copom

Modelo que lê cada ata do Copom e mede **quão dura é** (nível), **quanto surpreendeu** em relação ao
esperado (surpresa) e **quanto dá para confiar** na leitura (confiança 0–100), com o trecho literal da ata
que sustenta cada nota.

## Como funciona
1. **Julgamento por IA, com regras explícitas.** O Claude lê parágrafo a parágrafo seguindo a Skill
   `skill/tom-copom` (9 dimensões, régua −2..+2, 18 padrões aprendidos) e lista as mudanças em relação à
   ata anterior. Sem chave de API: roda pelo Claude Code.
2. **Padrões vindos do mercado.** Lemos o que analistas disseram de 47 atas (2021–2026) — que palavras
   surpreenderam, para que lado — e quanto a taxa prefixada de 2 anos andou no dia da ata, descontando dias
   em que outro evento (IPCA, Fed, fiscal, eleição) explica o movimento.
3. **Python faz o que precisa ser exato**: confere cada trecho, agrega os parágrafos com pesos por
   dimensão, escolhe o estimador de surpresa pelo melhor desempenho fora da amostra (leave-one-out),
   calcula intervalos e a confiança (concordância entre Claude, placar de palavras e precisão estatística).
4. **Reserva sem IA**: um modelo de texto treinado nos rótulos do Claude dá nota provisória quando não há
   Claude disponível.

## Resultados e validação
Ver `resultados/validacao.md` (gerado por `scripts/relatorio.py` a partir dos JSON, sem números à mão),
`resultados/indice.json` e `resultados/padroes.md`. Inclui um **teste de vazamento**: a primeira rodada
de rótulos via, sem querer, a reação do mercado; refizemos às cegas e comparamos.

## Limitações
Amostra curta (≈46 atas), padrões extraídos das mesmas atas, mercado com dados diários do Tesouro Direto.
Interpretação, não previsão. Não é recomendação de investimento.

Detalhes técnicos e integração: `CLAUDE.md`.
