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
