# Validação do Sentiment Tracker

Gerado por `scripts/relatorio.py` em 2026-11-06T14:46:24-03:00. Todos os números vêm de `resultados/*.json` e `dados/reacao.csv`.

## 1. Gabarito: o que conta como acerto

Para cada ata, `rotulo_surpresa` (−2..+2) combina:
- **Analistas** (peso 1): veredito "mais dura / em linha / mais branda que o esperado" coletado de matérias (InfoMoney, Money Times, CNN Brasil, Agência Brasil), em `dados/analistas/`.
- **Mercado** (peso 0 a 0,5): variação da taxa prefixada de 2 anos (LTN, Tesouro Direto) no dia da ata em desvios de um dia comum (z), só se |z| ≥ 1. O peso cai a zero quando os analistas atribuíram o movimento a outro evento e é reduzido quando havia ≥ 2 eventos externos no dia.

- Atas com dado de mercado: 46; com movimento acima de um dia comum (|z| ≥ 1): 13.
- Reação atribuída pelos analistas só à ata: 0; parcialmente: 36; a outro evento: 10.
- Correlação entre a surpresa dos analistas e a variação do prefixado 2a no dia: 0.43 (n=46). Os dois gabaritos apontam na mesma direção, mas estão longe de idênticos.

## 2. Surpresa: desempenho fora da amostra (leave-one-out)

Estimador escolhido: **claude_encolhida** (regra: maior correlação leave-one-out; ridge só se superar o melhor sem ajuste por > 0,03).

| Comparação | n | Correlação | Acerto de direção (n direcionais) | Erro médio abs. |
|---|---|---|---|---|
| Índice × gabarito combinado | 46 | 0.44 | 70% (23) | 0.57 |
| Índice × só analistas | 46 | 0.49 | 70% (23) | 0.58 |
| Índice × Δ prefixado 2a (dias limpos, em dezenas de pb) | 36 | 0.15 | 50% (22) | 1.07 |

Base ingênua (prever sempre "em linha" = 0): erro médio abs. 0.58. Acerto de direção conta só atas em que o gabarito tem |surpresa| ≥ 0,5.

Candidatos (correlação leave-one-out com o gabarito):

- `media_sinais`: 0.40
- `claude_surpresa`: 0.39
- `claude_encolhida`: 0.44
- `claude_mudancas`: 0.33
- `ridge`: 0.26

Sinais isolados (correlação com o gabarito):

- `claude_surpresa`: 0.39
- `mudancas`: 0.30
- `delta_nivel`: 0.23
- `lex_delta_z`: 0.35
- `claude_nivel`: 0.21
- `nivel`: 0.24

Intervalo de previsão de 95% da surpresa: ± 1.46 (t de Student com n = 46). É largo porque a amostra é curta (atas desde 2021).

## 3. Teste de vazamento

A primeira rodada de rótulos (v1) usou uma versão da Skill que lia `resultados/padroes.md`, que traz reação de mercado e veredito dos analistas por ata. Os rótulos oficiais foram refeitos às cegas (`skill/tom-copom/regras.md`, sem dados por ata). Comparação:

| Rodada | Correlação LOO | Acerto de direção | Correlação com DI (dias limpos) |
|---|---|---|---|
| v1 (contaminada) | 0.63 | 83% | 0.54 |
| cega (oficial) | 0.44 | 70% | 0.15 |

A diferença estima quanto do desempenho da v1 vinha de ver o gabarito.

## 4. Rótulos por parágrafo

Modelo reserva sem IA (TF-IDF + ridge), deixando uma ata inteira de fora por vez, contra os rótulos do Claude: acerto exato 64%, até 1 ponto 96%, erro médio 0.41 (base "sempre 0": 27% exato) — 1060 parágrafos.

Concordância entre dois rotuladores independentes — esta Skill (Claude Opus, 9 dimensões) × rótulos simples do pipeline do time (`banco/rotulos.jsonl`, Claude Sonnet): acerto exato 65%, até 1 ponto 96% (n=1060 parágrafos).

## 5. Trechos

`scripts/validar.py` confere que cada trecho citado (parágrafos e mudanças) é cópia literal do parágrafo da ata. Todas as atas rotuladas passam (ver saída do script).

## 6. Atas com maior surpresa estimada

| Ata | Nível | Surpresa | Confiança | Analistas | Δ pre 2a (pb) |
|---|---|---|---|---|---|
| 255 | -0.61 | -1.24 | 66 | mais_branda | -7.6 |
| 276 | -1.02 | -1.10 | 63 | em_linha | -2.9 |
| 264 | +1.24 | +0.99 | 55 | mais_dura | 4.7 |
| 242 | +1.63 | +0.57 | 38 | mais_dura | 44.9 |
| 247 | +1.32 | +0.57 | 46 | mais_dura | -7.9 |
| 279 | +0.33 | +0.56 | 51 | misto | -7.9 |
| 236 | +0.66 | +0.52 | 49 | mais_dura | -0.1 |
| 238 | +0.73 | -0.48 | 39 | mais_branda | -3.8 |
| 274 | +0.11 | -0.45 | 46 | mais_branda | -20.4 |
| 261 | +0.17 | +0.43 | 40 | em_linha | 2.8 |

## 7. Melhorias desta versão (medidas, não supostas)

- **A · gabarito de mercado menos ruidoso**: z médio do prefixado 1a e 2a, em 1 e 2 dias. Correlação com a surpresa dos analistas: 0.41 (só 2a, 1 dia) → 0.50 (média).
- **B · encolhimento quando os sinais discordam** (`claude_encolhida`): correlação LOO 0.39 (surpresa crua) → 0.44.
- **C · confiança calibrada**: acerto de direção fora da amostra por terço de confiança:
  - baixa (28–42): 56% de acerto (9 atas direcionais), erro médio 0.59
  - media (43–53): 75% de acerto (8 atas direcionais), erro médio 0.55
  - alta (55–73): 83% de acerto (6 atas direcionais), erro médio 0.58
  O campo `confianca_calibrada` de cada ata traz esse acerto histórico da faixa.

Contra o **mercado puro** (z médio, dias limpos): correlação 0.09, acerto de direção 41% (22). O texto acompanha bem a leitura dos analistas, mas quase não prevê o preço do dia: a reação dos juros no dia da ata é dominada por outros fatores.

## 8. Teste fora da amostra (atas de 2020, nunca usadas)

Modelo congelado (estimador `claude_encolhida`, escalas de 2021+) aplicado às atas 228–235, rotuladas às cegas.

| Comparação | n | Correlação | Acerto de direção (n) | Erro médio | Erro de prever 0 |
|---|---|---|---|---|---|
| × gabarito combinado | 8 | 0.70 | 100% (1) | 0.32 | 0.14 |
| × analistas | 8 | 0.63 | 100% (1) | 0.32 | 0.12 |
| × mercado (dias limpos) | 7 | 0.09 | 33% (3) | 0.55 | 0.50 |

Leitura: em 2020 quase todas as atas foram "em linha" para os analistas (só 1 direcional), então o teste confirma a ordenação (correlação positiva) mas mostra que o modelo **superestima a surpresa** de atas em linha — erro médio maior que prever sempre 0. n = 8: checagem de sanidade, não estimativa precisa.

## 9. Limitações

- **Amostra curta**: ~46 atas (2021–2026), um regime de alta, um de manutenção e dois de corte. Intervalos largos; não extrapolar para regimes diferentes.
- **Padrões em amostra**: as regras P01–P18 foram destiladas da leitura dos analistas sobre essas mesmas atas. A versão cega tira os dados por ata, mas as frases-exemplo continuam vindo daqui.
- **Mercado**: taxa "manhã" do Tesouro Direto (não o DI futuro de fechamento) e dados diários; sem controle por Treasury (FRED bloqueado pelo proxy). A ata sai às 8h, antes da taxa manhã.
- **Gabarito qualitativo**: "esperado" pelos analistas costuma ser o comunicado da semana anterior; veredito vem em geral de uma ou duas casas por ata.
- **Rotulador único por ata**: cada ata foi rotulada uma vez; a variância entre execuções do Claude não foi medida (não testado). Próximo passo: 2ª leitura só do diff e média das duas.
- Interpretação, não previsão; não é recomendação de investimento.
