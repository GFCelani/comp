# Contrato de dados — Tradutor do Copom

Formato de cada arquivo trocado entre o pipeline, o modelo do parceiro e o site. Quem escreve um arquivo é responsável por manter o formato; quem lê não deve depender de campos fora daqui.

Convenções: UTF-8; datas `AAAA-MM-DD`; `ata` = número da reunião (inteiro); notas inteiras de −2 a +2; índices com 2 casas decimais; proporções (acurácia etc.) entre 0 e 1; `gerado_em` em ISO 8601 com hora.

Pastas: `banco/` e `saida/` são escritos pelo pipeline (`pipeline/`), incluindo `banco/indice_modelo.json` e `banco/metricas_modelo.json`, escritos por `modelo/treinar.py`. O site lê só `site/data/dados_site.json` e `site/data/busca.json`, copiados pelo pipeline.

## banco/atas.json

Escreve: `pipeline/atualizar_banco.py` (metadados) e `pipeline/selic.py` (campos de Selic e Focus). Lista ordenada por `numero` crescente.

```json
[
  {
    "numero": 281,
    "data_reuniao": "2026-09-16",
    "data_publicacao": "2026-09-22",
    "url_pdf": "https://www.bcb.gov.br/content/copom/atascopom/Copom281-not20260916281.pdf",
    "arquivo": "ata_281_2026-09-16.pdf",
    "selic_apos": 13.75,
    "decisao_pp": -0.25,
    "decisao": "corte",
    "proxima_decisao_pp": null,
    "proxima_decisao": null,
    "focus_selic_fim_ano": { "data": "2026-09-18", "ano_referencia": 2026, "mediana": 13.25 }
  }
]
```

| Campo | Tipo | Nota |
|---|---|---|
| `numero` | int | nº da reunião |
| `data_reuniao` | data | último dia da reunião (campo `DataReferencia` do BC) |
| `data_publicacao` | data ou null | do metadado `CreationDate` do PDF; null se não houver |
| `url_pdf` | string | URL oficial no site do BC |
| `arquivo` | string | nome em `banco/atas/`, padrão `ata_<numero>_<AAAA-MM-DD>.pdf` |
| `selic_apos` | float | Selic meta (SGS 432) vigente no 1º dia útil após a reunião |
| `decisao_pp` | float | variação em pontos percentuais decidida na reunião |
| `decisao` | `"alta"` \| `"manutencao"` \| `"corte"` | derivado de `decisao_pp` |
| `proxima_decisao_pp` / `proxima_decisao` | float / string ou null | a decisão da reunião seguinte; null na última ata |
| `focus_selic_fim_ano` | objeto ou null | mediana do Focus (`Indicador=Selic`, `baseCalculo=0`, `DataReferencia` = ano da reunião) na data de coleta mais próxima da reunião |

## banco/paragrafos.jsonl

Escreve: `pipeline/extrair.py`. Uma linha por parágrafo, sem cabeçalho, rodapé nem número de página.

```json
{"ata": 281, "paragrafo": 12, "secao": "A) Atualização da conjuntura econômica e do cenário do Copom", "texto": "O Comitê avalia que ..."}
```

`paragrafo` é a numeração impressa na própria ata (1, 2, 3…), não um contador. `secao` é o título da seção em que o parágrafo está (string vazia se não houver).

## banco/rotulos.jsonl

Escreve: `pipeline/rotular.py`. Ordem de quem dá a nota: modelo do parceiro (`banco/modelo.pkl` ou `prever()` em `modelo/*.py`) > Claude (`claude -p --model sonnet`, uma chamada por ata) > TF-IDF de base (`pipeline/modelo_base.py`, se o Claude não estiver disponível ou falhar). O pipeline nunca fica sem nota. Uma linha por parágrafo rotulado; vale a última linha de cada `ata`+`paragrafo`.

```json
{"ata": 281, "paragrafo": 12, "nota": 1, "trecho": "o Comitê seguirá vigilante e avaliará se a estratégia", "trecho_valido": true, "modelo": "sonnet", "rotulado_em": "2026-11-06T13:05:00"}
```

| Campo | Tipo | Nota |
|---|---|---|
| `nota` | int −2..2 | régua: +2 muito duro, +1 duro, 0 neutro, −1 brando, −2 muito brando |
| `trecho` | string | até 25 palavras, copiado literalmente do parágrafo |
| `modelo` | `"parceiro"` \| `"sonnet"` \| `"tfidf_base"` | quem deu a nota. Com `parceiro` ou `tfidf_base`, `trecho` = primeira oração do parágrafo, até 25 palavras, recortada por código. Atas com nota `tfidf_base` são refeitas pelo Claude quando ele volta a estar disponível |
| `trecho_valido` | bool | `true` se o trecho é cópia exata (ignorando espaços múltiplos); `false` se falhou após uma correção |

## banco/indice.json

Escreve: `pipeline/indice.py`. Índice simples de base.

```json
{
  "metodo": "media_sem_zeros",
  "gerado_em": "2026-11-06T13:10:00",
  "atas": [
    { "ata": 281, "data_reuniao": "2026-09-16", "indice": 0.42, "indice_media_simples": 0.18, "n_paragrafos": 40, "n_nao_zero": 17 }
  ]
}
```

`indice` = média das notas ignorando as notas 0 (null se nenhuma nota ≠ 0). `indice_media_simples` = média de todas as notas.

## banco/indice_modelo.json — escrito por modelo/treinar.py

`indice` = P(alta) − P(corte) da reunião seguinte pelo modelo publicado (`metodo`): fora da amostra (janela no tempo) da ata 251 em diante, dentro da amostra (treino nas 15 primeiras) antes. Por ata: `ata`, `data_reuniao`, `indice`, `amostra` (`"fora"`/`"dentro"`), `probabilidades` {alta, manutencao, corte}. Campo extra `previsao_283` (= `previsao_atual` de metricas_modelo.json). **Não é índice de tom**: o tom vem sempre de `banco/indice.json`.

## banco/metricas_modelo.json — escrito por modelo/treinar.py

Modelo de nota de tom: todas as variáveis vêm das atas e das notas dos parágrafos (`modelo/variaveis.py` → `modelo/base_modelo.csv`; lista e mapeamento em DECISOES.md). Alvo: decisão da reunião seguinte. Um único modelo publicado, o melhor entre logística, floresta e árvore na janela no tempo.

```json
{
  "tipo": "logistica", "gerado_em": "...", "descricao": "...",
  "hiperparametros": "StandardScaler + LogisticRegression(C=0.3, max_iter=5000)",
  "variaveis": [ { "nome": "decisao_registrada_na_ata_alta", "descricao": "...", "importancia": 0.096 } ],
  "coeficientes": { "alta": { "tom_nivel": 0.1 } },
  "coeficientes_logistica": { "...": "sempre presente" },
  "regra_arvore_pt": "Se ..., prevê ...", "regra_arvore_texto": "export_text bruto",
  "metricas": { "acuracia": 0.742, "acuracia_balanceada": 0.738, "n": 31,
                "periodo": { "inicio_ata": 251, "fim_ata": 281, "inicio": "2022-12-07", "fim": "2026-09-16" } },
  "matriz_confusao": { "rotulos": ["alta","manutencao","corte"], "linhas": "realizado", "colunas": "previsto", "valores": [[0,0,0],[0,0,0],[0,0,0]] },
  "viradas": { "acertos": 2, "total": 6 },
  "previsoes_ata_a_ata": [ { "ata": 251, "data_reuniao": "...", "previsto": "alta", "realizado": "alta", "acertou": true,
                             "probabilidades": { "alta": 0.8, "manutencao": 0.1, "corte": 0.1 } } ],
  "previsao_atual": { "reuniao": 283, "data": "2026-12-09", "ata_base": 281, "observacao": "...",
                      "probabilidades": { "alta": 0.152, "manutencao": 0.285, "corte": 0.562 }, "previsto": "corte",
                      "por_modelo": { "logistica": { "...": "..." } } },
  "acuracia_previsao_decisao": 0.742,
  "candidatos": { "arvore|logistica|floresta": { "hiperparametros": "...", "acuracia": 0.0, "acuracia_balanceada": 0.0, "n": 31,
                  "matriz_confusao": {}, "viradas": {}, "previsoes_ata_a_ata": [] } },
  "criterio_escolha": "...", "n_atas_treino": 46,
  "modelo_publicado": "logistica", "importancias": [ { "variavel": "...", "importancia": 0.0 } ],
  "descricoes_variaveis": { "...": "..." }, "validacao_tempo": { "inicio_ata": 251, "fim_ata": 281, "n": 31, "metodos": {} }
}
```

`viradas` = atas em que a decisão seguinte ≠ decisão registrada na ata. `importancia` = importância por permutação (n_repeats=30, random_state=42) do modelo publicado treinado em todas as atas com alvo. `modelo_publicado`, `importancias`, `descricoes_variaveis` e `validacao_tempo` existem para o painel atual. A previsão ingênua não entra neste arquivo (só em DECISOES.md).

## modelo/forcas_fraquezas.json → dados_site.json `forcas_fraquezas` — escrito por modelo/analise_erros.py

Análise das 31 previsões da validação no tempo (`previsoes_ata_a_ata` de banco/metricas_modelo.json). Só lê banco/ e modelo/base_modelo.csv; não altera o modelo. `pipeline/gerar_dados_site.py` copia o arquivo inteiro para `forcas_fraquezas` (null se não existir). Também gera `modelo/analise_erros.md`.

```json
{
  "gerado_em": "...", "modelo": "logistica", "hiperparametros": "...",
  "periodo": { "atas": "251–281", "inicio": "2022-12-07", "fim": "2026-09-16", "n": 31 },
  "acuracia_geral": { "n": 31, "acertos": 23, "acuracia": 0.742 },
  "por_classe": [{ "classe": "alta", "n_previsto": 7, "n_realizado": 7, "acertos": 5, "precisao": 0.714, "cobertura": 0.714 }],
  "viradas": { "n": 6, "acertos": 2, "acuracia": 0.333,
               "demora": [{ "ata": 255, "data_reuniao": "...", "de": "manutencao", "para": "corte", "previsto_na_virada": "manutencao", "reunioes_ate_perceber": 2 }] },
  "continuacoes": { "n": 25, "acertos": 21, "acuracia": 0.84 },
  "por_fase": [{ "fase": "ciclo de cortes 2023–2024", "decisao": "corte", "inicio": "...", "fim": "...", "atas": "256–262",
                 "n_atas_na_fase": 7, "n_previsoes_testadas": 7, "n": 7, "acertos": 5, "acuracia": 0.714, "fora_do_teste": false, "parcial": false }],
  "confianca": { "limiar": 0.6, "acima": { "n": 25, "acertos": 19, "acuracia": 0.76 }, "abaixo": { "n": 6, "acertos": 4, "acuracia": 0.667 },
                 "calibracao": [{ "faixa": ">75%", "n": 20, "prob_media": 0.876, "acerto": 0.75 }],
                 "brier": 0.399, "brier_ingenua": 0.387, "aviso": "amostra pequena..." },
  "erros": [{ "ata": 256, "data_reuniao": "...", "decisao_registrada": "corte", "previsto": "manutencao", "realizado": "corte",
              "probabilidades": { "alta": 0.136, "manutencao": 0.622, "corte": 0.241 },
              "puxaram_errado": [{ "variavel": "termos de virada na seção de decisão", "codigo": "sinais_virada", "contribuicao": 0.627 }],
              "nota": null }],
  "conferencia_reajuste": { "max_diferenca_prob": 0.0005 },
  "conclusao": { "confiavel": "...", "falha": "...", "porque": "...", "proximos_passos": ["...", "...", "..."] }
}
```

`reunioes_ate_perceber`: 0 = acertou na própria virada; k = passou a prever a nova decisão k reuniões depois; `"não percebeu"` = não previu antes de o regime acabar ou o período terminar. Fases: sequências de decisões iguais em banco/atas.json; cada previsão conta na fase da reunião que ela prevê (ata seguinte). `puxaram_errado`: até 3 maiores valores positivos de coef(prevista)·z − coef(realizada)·z na logística da própria janela; null com `nota` quando a classe realizada não existia no treino da janela. `brier` = Brier multiclasse (soma nas 3 classes, média nas atas); `brier_ingenua` = mesma conta para "repetir a decisão registrada" com probabilidade 1.

## banco/modelo_base.pkl e banco/metricas_modelo_base.json

Escreve: `pipeline/modelo_base.py`. TF-IDF (1–2 gramas) + regressão logística treinados só nos rótulos `sonnet` de `banco/rotulos.jsonl`; retreina quando o número desses rótulos muda. As métricas vêm de validação cruzada estratificada de 5 folds (semente 42), no formato de `banco/metricas_modelo.json` sem `validacao_leave_one_out`, com o campo extra `validacao` (texto).

## banco/metricas_previsao.json

Escreve: `pipeline/metricas.py`. Compara o índice de cada ata com a decisão da reunião seguinte.

Regra de tradução do índice em previsão: `indice > 0.25` → `"aperto"`; `indice < -0.25` → `"afrouxamento"`; senão `"manutencao"`. Realizado: `proxima_decisao` de `atas.json` mapeada para `alta → aperto`, `corte → afrouxamento`, `manutencao → manutencao`.

Base de comparação (`ingenua`): prevê para a reunião seguinte a mesma decisão da reunião atual (`decisao` da própria ata).

```json
{
  "regra": { "aperto": "indice > 0.25", "afrouxamento": "indice < -0.25", "manutencao": "entre -0.25 e 0.25" },
  "fonte_indice": "simples",
  "gerado_em": "2026-11-06T13:12:00",
  "n_atas": 45,
  "periodo": { "inicio": "2021-01-20", "fim": "2026-08-05" },
  "indice": {
    "acuracia": 0.62,
    "acerto_sinal": 0.80,
    "matriz_confusao": { "rotulos": ["afrouxamento", "manutencao", "aperto"], "valores": [[0,0,0],[0,0,0],[0,0,0]] },
    "atas": [
      { "ata": 280, "data_reuniao": "2026-08-05", "indice": -0.55, "previsto": "afrouxamento", "realizado": "afrouxamento", "variacao_pp": -0.25, "acertou": true }
    ]
  },
  "ingenua": {
    "acuracia": 0.70,
    "acerto_sinal": 0.85,
    "matriz_confusao": { "rotulos": ["afrouxamento", "manutencao", "aperto"], "valores": [[0,0,0],[0,0,0],[0,0,0]] },
    "atas": [
      { "ata": 280, "data_reuniao": "2026-08-05", "previsto": "afrouxamento", "realizado": "afrouxamento", "acertou": true }
    ]
  },
  "melhor": "ingenua"
}
```

`acuracia` = acertos / n_atas. `acerto_sinal` = entre as atas em que a previsão foi `aperto` ou `afrouxamento`, a fração em que o realizado teve o mesmo sinal. `matriz_confusao.valores[i][j]` = nº de atas com previsto `rotulos[i]` e realizado `rotulos[j]`. `n_atas` exclui a última ata (sem decisão seguinte). `melhor` ∈ `"indice"`, `"ingenua"`, `"empate"`, pela acurácia. A regra de ±0,25 não é ajustada para vencer a base. Cada bloco traz também `n_previsoes_direcionais` (nº de previsões `aperto`/`afrouxamento`, base do `acerto_sinal`, que é null se for 0). `indice` null numa ata (nenhuma nota ≠ 0) vira previsão `manutencao`.

**Escolha do método publicado (ver DECISOES.md).** Campos adicionais (os blocos `indice` e `ingenua` acima continuam iguais):

```json
"validacao": "leave-one-out (...)", "ordem_desempate": ["ingenua", "variacao_tom", "nivel_tom", "modelo_parceiro"],
"metodos": {
  "ingenua":      { "disponivel": true, "rotulo_pt": "...", "acuracia_loo": 0.844, "acerto_sinal": 0.9, "n": 45, "n_previsoes_direcionais": 30, "matriz_confusao": { "rotulos": [...], "valores": [[...]] }, "atas": [ { "ata": 280, "data_reuniao": "...", "previsto": "...", "realizado": "...", "acertou": true } ] },
  "variacao_tom": { "...": "mesmo formato" },
  "nivel_tom":    { "...": "mesmo formato" },
  "arvore|logistica|floresta": { "disponivel": true, "rotulo_pt": "...", "acuracia_loo": 0.848, "acuracia_tempo": 0.806,
    "acuracia_balanceada_tempo": 0.813, "viradas_tempo": { "acertos": 1, "total": 6 }, "n_tempo": 31, "fonte_acuracia": "banco/metricas_modelo.json" }
},
"escolhido": "ingenua"
```

- `ingenua`: repete a decisão da reunião atual. `nivel_tom`: índice de `indice.json` > 0,25 → aperto, < −0,25 → afrouxamento, senão manutenção. `variacao_tom`: Δ = índice(ata) − índice(ata anterior com índice); Δ > 0,25 → um passo mais duro que a decisão atual (afrouxamento→manutencao→aperto→aperto); Δ < −0,25 → um passo mais brando; senão repete. Δ indefinido → repete. `arvore`, `logistica`, `floresta`: lidos de `banco/metricas_modelo.json`. Todos os métodos ganham `acuracia_tempo`, `viradas_tempo` e `n_tempo` (janela crescente, atas 251–281, mesmo período para todos). `escolhido` = maior `acuracia_tempo`, desempate ingenua, variacao_tom, nivel_tom, arvore, logistica, floresta (`criterio_escolha = "acuracia_tempo"`; volta a `acuracia_loo` se não houver validação no tempo). Campos novos no topo: `criterio_escolha`, `validacao_tempo` {inicio_ata, fim_ata, n} e `destaque_viradas` (método que empata com o escolhido e acerta mais viradas, ou null).
- `acuracia_loo`: laço leave-one-out (cada ata é prevista com o método "ajustado" nas demais). Os três primeiros não têm parâmetros ajustados aos dados, então coincide com a acurácia simples. Limiar 0,25 fixo a priori.
- `escolhido` = maior `acuracia_loo` entre os disponíveis; empate → ordem de `ordem_desempate` (vence o mais simples). Escolha automática a cada execução.

## saida/diff_ultimas.json

Escreve: `pipeline/diff.py`. Comparação da última ata com a anterior.

```json
{
  "ata_atual": 281, "ata_anterior": 280,
  "novos": [{ "paragrafo": 14, "texto": "..." }],
  "removidos": [{ "paragrafo": 9, "texto": "..." }],
  "alterados": [{ "paragrafo_atual": 12, "paragrafo_anterior": 11, "similaridade": 0.81, "diff": "texto com ~~removido~~ e **adicionado**" }],
  "iguais": 30
}
```

## banco/previsao.json

Escreve: `pipeline/previsao.py`. Previsão para a **próxima reunião ainda não realizada**, SEMPRE pelo modelo de nota de tom (`banco/metricas_modelo.json`).

```json
{
  "gerado_em": "...", "base_ata": 281, "base_data_reuniao": "2026-09-16", "fonte_indice": "simples", "indice": 0.62,
  "previsto": "afrouxamento", "metodo_escolhido": "logistica", "acuracia_escolhido": 0.742,
  "probabilidades": { "alta": 0.152, "manutencao": 0.285, "corte": 0.562 },
  "texto_publico": "Nosso modelo, treinado com as atas desde 2021, acertou 74% das decisões seguintes.",
  "observacao": "a ata da reunião 282 ainda não saiu; a previsão usa a última ata publicada (281)",
  "criterio_escolha": "...", "validacao_tempo": { "inicio_ata": 251, "fim_ata": 281, "inicio": "...", "fim": "..." },
  "metodos": [ { "nome": "logistica", "rotulo_pt": "modelo de nota de tom", "acuracia_tempo": 0.742, "acuracia_balanceada": 0.738,
                 "n_tempo": 31, "n": 31, "viradas_tempo": { "acertos": 2, "total": 6 }, "probabilidades": {}, "previsto_proxima": "afrouxamento", "disponivel": true } ],
  "proxima_reuniao": { "numero": 283, "data": "2026-12-09", "fonte": "BCB, calendário oficial do Copom" },
  "ultima_decisao_conhecida": { "numero": 282, "data": "2026-11-04", "selic": 13.75, "decisao_pp": 0.0, "decisao": "manutencao", "ata_publicada": false, "fonte": "...", "confere_sgs432": true },
  "ultima_decisao": { "...": "mesmo formato; sempre preenchido" },
  "focus_selic": { "mediana": 13.5, "ano_referencia": 2026, "data": "2026-10-30" }
}
```

- `previsto`: classe de maior probabilidade do modelo, no vocabulário `aperto`/`manutencao`/`afrouxamento`. `metodos` tem UMA entrada (o modelo). Saíram `acerto`, `destaque_viradas`, `previsto_nivel_tom`, `variacao_tom`, `regra` e os métodos ingênua, nível e variação do tom.
- `indice`/`base_ata`: índice de tom da última ata (explicação, não previsão).
- `proxima_reuniao`: calendário oficial do BC; nunca se inventa data. `ultima_decisao_conhecida`: só quando a ata da última decisão não saiu.
- `focus_selic`: contexto de mercado, não é variável do modelo.

## saida/textos.json

Escreve: `pipeline/textos.py`. Relatório de mercado: manchete e linha fina montadas por código (modelo de texto fixo, sem o Claude) e 3 seções escritas por uma chamada `claude -p --model sonnet` verificada por código, ou pelo plano B determinístico.

```json
{
  "ata_atual": 281, "ata_anterior": 280, "gerado_em": "2026-11-06T13:20:00-03:00",
  "origem": "claude", "motivo_automatico": null, "tentativas": 1, "reescritas": 0,
  "hash_entrada": "9f2c...", "previsto": "aperto", "proxima_reuniao": { "numero": 283, "data": "2026-12-09", "fonte": "..." },
  "manchete": "Selic deve cair na reunião de 9 de dezembro, prevê o CopomAI",
  "linha_fina": "Probabilidade estimada de 56% de corte; o modelo acertou 23 de 31 reuniões desde dezembro de 2022. A ata 281 trouxe tom menos duro, com destaque para a desaceleração da atividade.",
  "secoes": [
    { "id": "mudou", "titulo": "O que mudou na comunicação do Copom",
      "paragrafos": [ { "texto": "Frase com afirmação [[c1]]. Outra frase [[c2]][[c3]].",
                        "citacoes": [ { "id": "c1", "ata": 281, "paragrafo": 9, "trecho": "até 25 palavras copiadas literalmente" } ] } ] },
    { "id": "efeito", "titulo": "O efeito provável no mercado", "paragrafos": [] },
    { "id": "observar", "titulo": "O que observar até a próxima reunião", "paragrafos": [] }
  ],
  "mudancas": [ { "paragrafo": 12, "trecho": "até 25 palavras", "efeito": "endureceu", "explicacao": "Duas frases.", "tipo": "alterado" } ],
  "impacto": { "texto": "Dois ou três períodos condicionais.", "data_selic": "2026-11-06", "data_focus": "2026-10-30", "origem": "automatico" },
  "verificacao": { "reescritas": 0, "descartados": [], "chamadas_claude": 1 }
}
```

**Marcador de citação `[[cN]]`.** Dentro de `texto`, cada sentença termina com um ou mais marcadores `[[c1]]`, `[[c2]]`… colados antes do ponto final (`... decisão [[c1]][[c2]].`). Cada marcador aponta para um item de `citacoes` do mesmo parágrafo, `{id, ata, paragrafo, trecho}`. Os ids são únicos no relatório inteiro (c1…cN, renumerados por código, na ordem de leitura) e o mesmo marcador pode aparecer em mais de uma sentença. Regex: `\[\[(c\d+)\]\]`. O site troca cada marcador por uma referência clicável (ata e parágrafo) e mostra o trecho.

- 3 seções fixas, nesta ordem: `mudou`, `efeito`, `observar`; de 3 a 5 parágrafos no total, pelo menos 1 por seção. A seção `efeito` usa linguagem condicional (Selic, juros futuros, câmbio, inflação esperada, crédito). Não é recomendação de investimento.
- `manchete` (modelo de texto fixo, `manchete_fixa` em `textos.py`, sem o Claude): sempre previsão, nunca certeza, e não fala de tom. Pela classe prevista do modelo publicado (`previsao.json` `previsto`):
  - corte: "Selic deve cair na reunião de {data}, prevê o CopomAI";
  - manutenção: "Selic deve ficar em {taxa}% em {data}, prevê o CopomAI";
  - alta: "Selic deve subir na reunião de {data}, prevê o CopomAI".
  `{data}` = `previsao.proxima_reuniao.data` por extenso (dia sem zero à esquerda e mês minúsculo, ex.: "9 de dezembro"); sem data, "na reunião de {data}"/"em {data}" vira "na próxima reunião". `{taxa}` = `previsao.ultima_decisao_conhecida.selic` (senão a `selic_apos` da última ata de `atas.json`), vírgula decimal e 2 casas.
- `linha_fina` (modelo de texto fixo, `linha_fina_fixa`): "Probabilidade estimada de {P}% de {classe}; o modelo acertou {K} de {N} reuniões desde {mês} de {ano}. A ata {n} trouxe tom {menos duro|mais duro|estável}, com destaque para {tema}." `P` = probabilidade da classe prevista em `previsao.json` `probabilidades`, arredondada; `classe` ∈ corte, manutenção, alta; `N` = `metricas_modelo.json` `metricas.n`, `K` = round(`metricas.acuracia` × N), mês e ano de `metricas.periodo.inicio`. Tom pela variação do índice entre a ata atual e a anterior (limiar ±0,05). `tema` vem da 1ª mudança do diff com o mesmo efeito do tom (suavizou para menos duro, endureceu para mais duro; qualquer uma se estável), por palavras-chave no trecho: expectativas de inflação, mercado de trabalho, cenário externo, câmbio, crédito, atividade ("a desaceleração da atividade" quando o trecho fala de desaceleração ou moderação) e inflação. Sem tema, a frase termina em "tom {…}.". Sem "método", "ingênua" nem termos técnicos. Manchete e linha fina continuam reprovadas se citarem termos de outra direção (`TERMOS_CONTRA`). `metodo_escolhido` também é gravado em `textos.json`. `VERSAO` = 6.
- Certeza sobre o futuro (verificação por código, lista `CERTEZA` em `textos.py`, vale para manchete, linha fina e toda sentença do relatório, do Claude e do plano B): reprovadas as frases com "vai", "vão", "irá", "irão", "será", "serão" (palavra inteira), "certamente", "com certeza", "sem dúvida" ou "garant…" (garante, garantir, garantia), sem acento e sem caixa. O relatório fala do futuro só com "prevê", "é esperado", "a projeção indica", "pode", "tende a". O prompt pede o mesmo.
- Verificação por código (vale para o Claude e para o plano B): toda sentença tem marcador; marcadores e citações batem nos dois sentidos; todo trecho é cópia literal (espaços e aspas tipográficas normalizados) de até 25 palavras do parágrafo indicado da ata atual ou da anterior; todo número da manchete, da linha fina e dos textos existe nos dados enviados (vírgula decimal e % normalizados; ignorados números de ata, de parágrafo, de reunião, anos e datas presentes nos dados); manchete e linha fina são iguais às do modelo fixo (o Claude devolve só `secoes`; o código põe manchete e linha fina); nas seções do relatório, nenhuma sentença fala dos nossos próprios dados (reprovadas as que contêm "acert", "previsão ingênua", "ingênua", "nosso sinal", "Focus" ou "não foi publicada"; manchete e linha fina podem); cada citação sustenta a sua sentença (ao menos uma palavra de 5+ letras fora das stopwords em comum entre a sentença e o trecho, sem acento e sem caixa). Até 2 reescritas com os erros.
- `origem` ∈ `"claude"`, `"automatico"`. `motivo_automatico` ∈ `null`, `"indisponivel"` (sem Claude, erro ou timeout), `"reprovado"` (falhou na verificação após 2 reescritas). Plano B: a mesma manchete e a mesma linha fina de modelo fixo; `mudou` = até 3 mudanças do diff com maior \|nota\| ou maior variação de nota, cada uma com um de 3 ou 4 modelos de frase por tipo (novo, alterado, removido) e efeito (endureceu, suavizou), escolhido pela posição, e com o tema tirado do trecho citado; `efeito` = frase condicional fixa pela previsão, citando o parágrafo de maior \|nota\| das seções de condução/decisão; `observar` = frase fixa citando o parágrafo de maior \|nota\| que fala de riscos. No plano B o trecho é recortado por código: as primeiras até 25 palavras do parágrafo.
- `mudancas` e `impacto` (seção de Evidência) vêm sempre do código: as mesmas até 3 mudanças do plano B, com `explicacao` de modelo fixo, e o impacto de modelo fixo com índice, variação, decisão e Selic.
- Idempotência: `hash_entrada` = hash de (versão do formato, ata atual, ata anterior, `previsao.json` sem `gerado_em`). Com o mesmo hash, `textos.py` não faz nada; a exceção é `origem: "automatico"` com `motivo_automatico: "indisponivel"` quando o Claude volta. Um plano B por reprovação só é refeito quando a entrada muda.

## saida/dados_site.json → site/data/dados_site.json

Escreve: `pipeline/gerar_dados_site.py`, que também copia para `site/data/`. Tudo que o site público e o painel mostram vem daqui; o site não calcula nada além de formatação.

```json
{
  "gerado_em": "2026-11-06T13:30:00",
  "exemplo": false,
  "ultima_verificacao": "2026-11-06T13:30:00",
  "textos_pendentes": false,
  "fonte_indice": "simples",
  "resumo": {
    "ultima_ata": { "numero": 281, "data_reuniao": "2026-09-16", "decisao": "corte", "decisao_pp": -0.25, "selic_apos": 13.75, "indice": 0.42, "url_pdf": "https://..." },
    "n_atas": 46, "n_paragrafos": 1840, "n_trechos_invalidos": 3,
    "periodo": { "inicio": "2021-01-20", "fim": "2026-09-16" }
  },
  "serie": [ { "ata": 281, "data_reuniao": "2026-09-16", "indice": 0.42, "selic_apos": 13.75, "decisao": "corte", "decisao_pp": -0.25 } ],
  "mudancas": [ { "paragrafo": 12, "trecho": "...", "efeito": "endureceu", "explicacao": "...", "tipo": "alterado" } ],
  "mudancas_origem": "claude",
  "impacto": { "texto": "...", "data_selic": "2026-11-05", "data_focus": "2026-10-31", "origem": "claude" },
  "atas": [
    { "numero": 281, "data_reuniao": "2026-09-16", "url_pdf": "https://...", "indice": 0.42, "n_paragrafos": 40, "n_nao_zero": 17,
      "paragrafos": [ { "paragrafo": 12, "nota": 1, "trecho": "..." } ] }
  ],
  "como_medimos": { "regua": "texto", "agregacao": "texto", "validacao": "texto" },
  "metricas_previsao": null,
  "metricas_modelo": null,
  "checagens_automaticas": { "trechos": { "validos": 1059, "invalidos": 1, "total": 1060 }, "citacoes_relatorio": { "verificadas": 13, "total": 13, "ok": true }, "portao_qualidade": null },
  "datas_dados": { "selic": "2026-11-05", "focus": "2026-10-31" },
  "previsao": { "...": "cópia de banco/previsao.json" },
  "manchete": { "texto": "Selic deve cair na reunião de 9 de dezembro, prevê o CopomAI", "linha_fina": "...", "origem": "claude" },
  "relatorio": { "origem": "claude", "gerado_em": "2026-11-06T13:20:00-03:00", "reescritas": 0,
    "secoes": [ { "id": "mudou", "titulo": "O que mudou na comunicação do Copom",
      "paragrafos": [ { "texto": "Frase [[c1]].", "citacoes": [ { "id": "c1", "ata": 281, "paragrafo": 9, "trecho": "...", "url_pdf": "https://...", "data_reuniao": "2026-09-16" } ] } ] } ] },
  "conferencia_selic": { "verificado_em": "2026-11-06T13:00:00-03:00", "fonte_url": "https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros", "n_comparadas": 46, "divergencias": [] }
}
```

- `exemplo: true` faz o site mostrar a faixa "EXEMPLO".
- `ultima_verificacao`: data e hora ISO, com fuso de Brasília (ex.: `"2026-11-06T13:30:00-03:00"`), da última vez que o pipeline conferiu se há ata nova. Muda só quando o pipeline publica uma ata; a verificação de cada execução fica em `saida/status.json`. `gerado_em` também vai com o fuso.
- `previsao` = conteúdo de `banco/previsao.json` ou null. `manchete` e `relatorio` vêm de `saida/textos.json` (null se os textos forem de outra ata); cada citação do relatório ganha `url_pdf` e `data_reuniao` da ata citada. Formato do marcador `[[cN]]`: ver `saida/textos.json`. Nenhum texto completo de parágrafo entra aqui, só trechos de até 25 palavras (o gerador para com erro se achar um maior).
- `textos_pendentes`: sempre `false` desde os textos automáticos (plano B); o campo continua para compatibilidade. `mudancas_origem` e `impacto.origem` ∈ `"claude"`, `"automatico"` (o site mostra "texto automático").
- `conferencia_selic` = conteúdo de `saida/conferencia_selic.json` ou null; `status` = conteúdo de `saida/status.json` ou null (na hora em que o pipeline publicou).
- `atas[].paragrafos[].trecho` é null quando o trecho não passou na checagem (`trecho_valido: false`).
- `fonte_indice` = `"simples"`: `serie[].indice`, `atas[].indice` e `resumo.ultima_ata.indice` vêm sempre de `banco/indice.json`.
- `indice_modelo` = conteúdo de `banco/indice_modelo.json` (P(alta) − P(corte) por ata) ou null.
- `validacao_selic_oficial` = conteúdo de `saida/validacao_selic_oficial.json` (gerado por `pipeline/validar_selic_oficial.py`: cruza `validacao/selic_oficial.csv` com `banco/atas.json`) ou null.
- `atas[].paragrafos` só traz parágrafos com nota ≠ 0, e só o trecho (nunca o texto inteiro).
- `metricas_previsao` = resumo público do modelo publicado (`escolhido`, `metodos` com UMA entrada, `periodo`); ingênua, nível e variação do tom não entram. `metricas_modelo` = `banco/metricas_modelo.json` ou null.
- `checagens_automaticas`: `trechos` (rótulos com trecho literal válido), `citacoes_relatorio` (citações do relatório conferidas como cópia literal do parágrafo, até 25 palavras), `portao_qualidade` (`{resultado, motivo, verificado_em}` de `saida/status.json` campo `portao`, ou null).

## saida/conferencia_selic.json

Escreve: `pipeline/conferir_selic.py`, em toda execução do workflow. Compara `selic_apos`, `decisao_pp` e `decisao` de `banco/atas.json` com a tabela oficial do BC (`https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros`, a mesma da página "Histórico das taxas de juros"; reuniões extraordinárias ignoradas).

```json
{ "verificado_em": "2026-11-06T13:00:00-03:00", "fonte_url": "https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros", "n_comparadas": 46,
  "divergencias": [ { "ata": 281, "campo": "selic_apos", "banco": 13.75, "oficial": 14.0 } ] }
```

Se o BC não responder, vem `erro` (texto) e `divergencias` vazio. Com divergência, o workflow abre uma issue (sem duplicar).

## saida/status.json

Escreve: `pipeline/verificar_nova.py`, em toda execução do workflow. Só é commitado com ata nova ou uma vez por semana (commit "Registra verificação semanal" quando `ultimo_commit_keepalive` tem mais de 6 dias). O site mostra a última verificação pela API pública do GitHub Actions.

```json
{ "ultima_verificacao": "2026-11-06T13:00:00-03:00", "ultimo_commit_keepalive": "2026-11-06T13:00:00-03:00",
  "token_cadastrado_em": null, "token_expira_em": null,
  "fluxo": { "agenda": "...", "ultima_ata_no_banco": 281, "atas_novas": [], "pendencias": [], "token_no_ambiente": false } }
```

`token_cadastrado_em` (`AAAA-MM-DD`) é informado pelo usuário; `token_expira_em` = 1 ano depois. Com 30 dias ou menos, o workflow abre uma issue (sem duplicar).

## saida/busca.json → site/data/busca.json

Escreve: `pipeline/gerar_dados_site.py`. Parágrafos completos para a busca. **Lido só no servidor** pela rota `GET /api/busca`; nunca vai para `site/public/` nem para o navegador.

```json
[ { "ata": 281, "data_reuniao": "2026-09-16", "paragrafo": 12, "texto": "parágrafo completo", "url_pdf": "https://..." } ]
```

A rota devolve no máximo 5 resultados com até 40 palavras de `texto` cada.

## Edições do painel (banco Postgres)

Escreve: o site (`/painel/editar`). Tabelas `edicoes(id, criado_em, campo, chave, valor_antigo, valor_novo, motivo)` e `config(chave, valor)`. O site público aplica a edição mais recente de cada `campo`+`chave` sobre o JSON e marca "revisado pelo time"; o JSON original nunca muda. Se o banco estiver fora, o site mostra o JSON.

Campos editáveis de textos (acrescentados em 06/11):

| campo | chave | regra |
|---|---|---|
| `manchete.texto` | `<ata>` | texto livre, não vazio, até 300 caracteres, motivo obrigatório |
| `manchete.linha_fina` | `<ata>` | idem |
| `relatorio.paragrafo` | `<ata>.<secao>.<i>` (secao ∈ `mudou`, `efeito`, `observar`; i base 0) | ao menos um marcador `[[cN]]`; todo marcador tem de existir nas `citacoes` do parágrafo original; nenhuma citação nova; motivo obrigatório |

`<ata>` é `relatorio.base_ata`, senão `previsao.base_ata`, senão `resumo.ultima_ata.numero`. Quando o pipeline regenera manchete e relatório para outra ata, as edições antigas deixam de ser aplicadas (continuam no histórico).
