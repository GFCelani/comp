# Validação do Sentiment Tracker

Gerado por `scripts/relatorio.py` em 2026-11-06T14:08:39-03:00. Todos os números vêm de `resultados/*.json` e `dados/reacao.csv`.

## 1. Gabarito: o que conta como acerto

Para cada ata, `rotulo_surpresa` (−2..+2) combina:
- **Analistas** (peso 1): veredito "mais dura / em linha / mais branda que o esperado" coletado de matérias (InfoMoney, Money Times, CNN Brasil, Agência Brasil), em `dados/analistas/`.
- **Mercado** (peso 0 a 0,5): variação da taxa prefixada de 2 anos (LTN, Tesouro Direto) no dia da ata em desvios de um dia comum (z), só se |z| ≥ 1. O peso cai a zero quando os analistas atribuíram o movimento a outro evento e é reduzido quando havia ≥ 2 eventos externos no dia.

- Atas com dado de mercado: 46; com movimento acima de um dia comum (|z| ≥ 1): 13.
- Reação atribuída pelos analistas só à ata: 0; parcialmente: 36; a outro evento: 10.
- Correlação entre a surpresa dos analistas e a variação do prefixado 2a no dia: 0.43 (n=46). Os dois gabaritos apontam na mesma direção, mas estão longe de idênticos.

## 2. Surpresa: desempenho fora da amostra (leave-one-out)

Estimador escolhido: **claude_surpresa** (regra: maior correlação leave-one-out; ridge só se superar o melhor sem ajuste por > 0,03).

| Comparação | n | Correlação | Acerto de direção (n direcionais) | Erro médio abs. |
|---|---|---|---|---|
| Índice × gabarito combinado | 46 | 0.63 | 83% (23) | 0.47 |
| Índice × só analistas | 46 | 0.58 | 83% (23) | 0.55 |
| Índice × Δ prefixado 2a (dias limpos, em dezenas de pb) | 36 | 0.54 | 68% (22) | 0.99 |

Base ingênua (prever sempre "em linha" = 0): erro médio abs. 0.56. Acerto de direção conta só atas em que o gabarito tem |surpresa| ≥ 0,5.

Candidatos (correlação leave-one-out com o gabarito):

- `media_sinais`: 0.54
- `claude_surpresa`: 0.63
- `ridge`: 0.54

Sinais isolados (correlação com o gabarito):

- `claude_surpresa`: 0.63
- `mudancas`: 0.40
- `delta_nivel`: 0.36
- `lex_delta_z`: 0.34
- `claude_nivel`: 0.32
- `nivel`: 0.31

Intervalo de previsão de 95% da surpresa: ± 1.22 (t de Student com n = 46). É largo porque a amostra é curta (atas desde 2021).

## 3. Teste de vazamento

A primeira rodada de rótulos (v1) usou uma versão da Skill que lia `resultados/padroes.md`, que traz reação de mercado e veredito dos analistas por ata. Os rótulos oficiais foram refeitos às cegas (`skill/tom-copom/regras.md`, sem dados por ata). Comparação:

| Rodada | Correlação LOO | Acerto de direção | Correlação com DI (dias limpos) |
|---|---|---|---|
| v1 (contaminada) | 0.63 | 83% | 0.54 |
| cega (oficial) | 0.63 | 83% | 0.54 |

A diferença estima quanto do desempenho da v1 vinha de ver o gabarito.

## 4. Rótulos por parágrafo

Modelo reserva sem IA (TF-IDF + ridge), deixando uma ata inteira de fora por vez, contra os rótulos do Claude: acerto exato 66%, até 1 ponto 96%, erro médio 0.38 (base "sempre 0": 30% exato) — 674 parágrafos.

Concordância entre dois rotuladores independentes — esta Skill (Claude Opus, 9 dimensões) × rótulos simples do pipeline do time (`banco/rotulos.jsonl`, Claude Sonnet): acerto exato 68%, até 1 ponto 98% (n=674 parágrafos).

## 5. Trechos

`scripts/validar.py` confere que cada trecho citado (parágrafos e mudanças) é cópia literal do parágrafo da ata. Todas as atas rotuladas passam (ver saída do script).

## 6. Atas com maior surpresa estimada

| Ata | Nível | Surpresa | Confiança | Analistas | Δ pre 2a (pb) |
|---|---|---|---|---|---|
| 264 | +1.28 | +1.50 | 58 | mais_dura | 4.7 |
| 242 | +1.70 | +1.30 | 37 | mais_dura | 44.9 |
| 255 | -0.48 | -1.20 | 62 | mais_branda | -7.6 |
| 262 | +0.74 | +1.20 | 44 | mais_dura | 4.4 |
| 247 | +1.22 | +1.00 | 50 | mais_dura | -7.9 |
| 261 | +0.03 | +1.00 | 48 | em_linha | 2.8 |
| 267 | +1.74 | +1.00 | 32 | em_linha | 39.1 |
| 239 | +1.72 | +0.80 | 37 | mais_dura | 8.0 |
| 246 | +0.83 | -0.80 | 55 | misto | -30.3 |
| 276 | -0.98 | -0.80 | 57 | em_linha | -2.9 |

## 7. Limitações

- **Amostra curta**: ~46 atas (2021–2026), um regime de alta, um de manutenção e dois de corte. Intervalos largos; não extrapolar para regimes diferentes.
- **Padrões em amostra**: as regras P01–P18 foram destiladas da leitura dos analistas sobre essas mesmas atas. A versão cega tira os dados por ata, mas as frases-exemplo continuam vindo daqui.
- **Mercado**: taxa "manhã" do Tesouro Direto (não o DI futuro de fechamento) e dados diários; sem controle por Treasury (FRED bloqueado pelo proxy). A ata sai às 8h, antes da taxa manhã.
- **Gabarito qualitativo**: "esperado" pelos analistas costuma ser o comunicado da semana anterior; veredito vem em geral de uma ou duas casas por ata.
- **Rotulador único por ata**: cada ata foi rotulada uma vez; a variância entre execuções do Claude não foi medida (não testado).
- Interpretação, não previsão; não é recomendação de investimento.
