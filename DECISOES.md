# Decisões

## Previsão publicada = método com maior acurácia histórica (06/11/2026)

**Decisão.** A previsão para a próxima reunião do Copom (capa, manchete, `previsao.json`) vem sempre do método com maior acurácia no histórico, validada deixando uma ata de fora por vez (leave-one-out). A escolha é automática a cada execução do pipeline (`pipeline/metricas.py` → `escolhido`; `pipeline/previsao.py` → `metodo_escolhido`).

**Motivo.** Credibilidade. A capa publicava "aperto" pela regra de nível do índice de tom, que acertou 40% das reuniões, contra 84% da previsão ingênua (repetir a última decisão). Publicar o método pior destrói a confiança no produto.

**Métodos comparados.**
- `ingenua`: repete a decisão da reunião atual.
- `nivel_tom`: índice > +0,25 → aperto; < −0,25 → afrouxamento; senão manutenção.
- `variacao_tom`: Δ = índice(ata) − índice(ata anterior). Δ > +0,25 → um passo mais duro que a decisão atual; Δ < −0,25 → um passo mais brando; senão repete.
- `modelo_parceiro`: regra de nível sobre `banco/indice_modelo.json`. Indisponível hoje (o arquivo não existe).

**Limiar fixado a priori.** 0,25 nos dois métodos de tom, definido antes de ver o resultado. Nenhum outro valor foi testado.

**Leave-one-out.** Os métodos `ingenua`, `nivel_tom` e `variacao_tom` não têm parâmetros ajustados aos dados, então a acurácia LOO coincide com a acurácia simples. O cálculo roda mesmo assim no laço LOO, para que um método com parâmetros (o do parceiro) entre do mesmo jeito.

**Desempate.** Pela ordem `ingenua`, `variacao_tom`, `nivel_tom`, `modelo_parceiro`: no empate vence o mais simples.

**Acurácia real (45 reuniões, atas de 20/01/2021 a 05/08/2026, decisão da reunião seguinte).**

| Método | Acurácia LOO | Acerto de direção | Previsão para a 283 (09/12/2026) |
|---|---|---|---|
| ingenua | 84,4% | 90% | manutenção |
| variacao_tom | 64,4% | 80% | corte |
| nivel_tom | 40,0% | 42,9% | aperto |
| modelo_parceiro | indisponível | — | — |

Escolhido: `ingenua`. A mudança de tom (índice de 0,90 na ata 280 para 0,62 na 281) aparece nos textos só como explicação do que mudou na comunicação, nunca como previsão contraditória.

## Modelo de decisão por ata (modelo/) — fixado antes de rodar qualquer modelo

**Unidade e alvo.** Uma linha por ata (236 a 281). Alvo: `proxima_decisao` (alta, manutencao, corte). A ata 281 fica sem alvo no treino: a decisão da 282 (04/11/2026, manutenção) vem do endpoint oficial do BC, mas a 282 ainda não tem ata, então a 281 é usada só como linha de previsão para a 283, com `decisao_atual` = decisão da 282 (manutenção). Assim a linha da previsão tem o mesmo formato das linhas de treino (texto da ata mais recente + última decisão conhecida).

**Termos fixos de `sinais_virada`** (normalizados sem acento, minúsculas, contagem de ocorrências como prefixo de palavra nos parágrafos da seção "D) Decisão de política monetária"): interrupcao, pausa, prolongad, magnitude, calibragem, calibracao, encerramento, continuidade, ritmo, ajuste, ciclo, interromper, antecipar, vigilante, perseveranca, serenidade. A lista não muda depois de ver resultados.

**Seção de decisão.** Título que contém "decis" (todas as atas 236–281 têm a seção D). Se faltar, usa a média das últimas 3 seções.

**Hiperparâmetros fixos (sem ajuste olhando o teste).** Logística: StandardScaler + LogisticRegression(C=0.5, max_iter=2000). Floresta: RandomForestClassifier(n_estimators=300, max_depth=3, random_state=42). Árvore: DecisionTreeClassifier(max_depth=2, random_state=42). Ingênua: repete `decisao_atual`.

**Validação principal.** Janela crescente: para cada ata de índice t ≥ 15 (16ª ata em diante), treina com 0..t−1 e prevê t. Secundária: leave-one-out. Desempate: ingenua, variacao_tom, nivel_tom, arvore, logistica, floresta.

**Alvo da 281 (atualização).** O validacao/selic_oficial.csv (endpoint historicotaxasjuros do BC) traz a 282 (04/11/2026, manutenção, 13,75%). Ela entra como alvo da 281 no treino; a 281 também gera a linha de previsão da 283 com decisao_atual = manutenção (decisão da 282). Treino: 46 atas; janela no tempo: atas 251 a 281 (n = 31).

**Resultado (janela no tempo, n = 31).** ingênua 80,6% (6 viradas, 0 acertos); variacao_tom 67,7% (2/6); nivel_tom 22,6% (1/6); árvore 71,0% (1/6); logística 80,6% (1/6); floresta 77,4% (1/6). Nenhum modelo ganhou da ingênua: a capa continua com a ingênua (empate com a logística, desempate pelo mais simples). `destaque_viradas`: a logística empata no geral e acerta 1 virada a mais (1 de 6 contra 0 de 6); fica registrado em previsao.json e metricas_modelo.json.

**Fonte do índice de tom.** banco/indice_modelo.json passou a guardar P(alta) − P(corte) da logística (fora da amostra da ata 251 em diante; dentro da amostra, treino nas 15 primeiras, antes). Por isso metricas.py, previsao.py e gerar_dados_site.py usam sempre banco/indice.json para o tom; o modelo_parceiro saiu da comparação (substituído por árvore, logística e floresta).

## Modelo de nota de tom (substitui o anterior) — fixado antes de rodar, 06/11/2026 ~14h50

**Decisão do usuário.** Todas as variáveis vêm das atas e dos rótulos. Saem `distancia_focus` e `hiato_inflacao`. Ingênua, nível do tom e variação simples deixam de ser métodos concorrentes publicados: há UM modelo publicado, o melhor entre logística, floresta e árvore pela validação no tempo. A ingênua aparece só aqui, como comparação.

**Variáveis (modelo/variaveis.py → modelo/base_modelo.csv, uma linha por ata).** tom_nivel, tom_variacao, tom_media_3_atas (média do índice das últimas 3 atas, incluindo a atual); tom por seção (média das notas dos parágrafos da seção); saldo_duro_brando ((n>0 − n<0)/total), proporcao_muito_duro (+2), proporcao_muito_brando (−2), dispersao_notas (desvio-padrão); sinais_virada (lista fixa acima, parágrafos da seção de decisão); termos por tema por 1000 palavras da ata; n_paragrafos, var_n_paragrafos; decisao_registrada_na_ata (alta, manutencao, corte, one-hot).

**Mapeamento das seções (títulos distintos em paragrafos.jsonl, sem acento, por palavra-chave):**
- "A) Atualização da conjuntura econômica e do cenário (básico/de referência) do Copom" → `tom_cenario_domestico` (palavra-chave "conjuntura"). Os parágrafos de cenário externo também estão nesta seção; não há título próprio.
- "B) Cenários e análise de riscos" e "B) Riscos em torno do cenário ... para a inflação" → `tom_balanco_riscos` (palavra-chave "risco").
- "C) Discussão sobre a condução da política monetária" e "D) Decisão de política monetária" → `tom_decisao_orientacao` (palavras-chave "conducao", "decis").
- `tom_cenario_externo` e `tom_expectativas_projecoes`: não há seção com esse título nas atas 236–281, então valem 0 em todas as linhas (constantes, sem efeito no modelo).

**Termos por tema (prefixos sem acento, minúsculas, ocorrências como início de palavra em toda a ata, por 1000 palavras):**
- inflacao: inflac, ipca, precos, desinflac
- expectativas: expectativ, focus, projec, ancorag, desancorag
- atividade: atividade, pib, crescimento, demanda, hiato, consumo
- mercado_trabalho: mercado de trabalho, emprego, desemprego, desocupac, salari, rendimento
- cambio: cambi, dolar, moeda
- fiscal: fiscal, divida publica, gasto, despesa, endividamento
- cenario_externo: extern, global, internacion, estados unidos, economias avancadas, emergentes, commodit

**Hiperparâmetros fixos.** Logística: StandardScaler + LogisticRegression(C=0.3, max_iter=5000). Floresta: RandomForestClassifier(n_estimators=300, max_depth=3, min_samples_leaf=3, random_state=42). Árvore: DecisionTreeClassifier(max_depth=2, random_state=42). predict_proba mapeado para as 3 classes, 0 nas ausentes do treino.

**Validação e escolha.** Janela crescente a partir da 16ª ata. Maior acurácia; empate → maior acurácia balanceada → mais simples (árvore, logística, floresta). Importância por permutação (n_repeats=30, random_state=42) do escolhido treinado em todas as atas com alvo.

**Alvo e previsão.** Alvo da 281 = decisão da 282 (manutenção, validacao/selic_oficial.csv). A ata da 282 ainda não saiu: a previsão da 283 (09/12/2026) usa a linha da última ata publicada (281), com decisao_registrada_na_ata = corte (decisão da reunião 281).

**Resultado (janela no tempo, atas 251 a 281, n = 31).** Logística 74,2% (balanceada 73,8%, viradas 2 de 6); floresta 67,7% (70,2%, 1 de 6); árvore 64,5% (65,5%, 1 de 6). Publicado: logística. Previsão da 283 (linha da ata 281): alta 15,2%, manutenção 28,5%, corte 56,2% → corte.

**Sensibilidade sem `decisao_registrada_na_ata` (só informativa, não usada para escolher nada).** Logística 61,3% (bal. 60,7%, viradas 2/6); árvore 51,6% (56,3%, 2/6); floresta 51,6% (54,4%, 2/6).

**Comparação com a previsão ingênua (mesmo período, fora de qualquer JSON do site).** Ingênua 80,6% (bal. 81,3%, viradas 0 de 6). O modelo publicado fica 6,4 pontos abaixo no geral e acerta 2 viradas a mais. Publicamos o modelo por decisão do usuário.

**Regra da árvore (todas as atas com alvo).** Se a decisão registrada na ata não é alta e a média do tom nas últimas 3 atas ≤ 0,64, prevê corte; se > 0,64, prevê manutenção. Se a decisão registrada na ata é alta e os termos de virada na seção de decisão ≤ 7,5, prevê alta; se > 7,5, prevê manutenção.

**Validação humana cancelada** (decisão do usuário): saiu de dados_site.json; no lugar, `checagens_automaticas`.
