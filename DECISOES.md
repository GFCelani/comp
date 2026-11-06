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
