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

Mesmo formato de `banco/indice.json`, com `metodo`. Aqui `indice` = P(alta) − P(corte) da reunião seguinte, pelo melhor modelo não ingênuo na janela no tempo (hoje a logística): fora da amostra da 16ª ata (251) em diante, dentro da amostra (treino nas 15 primeiras) antes. Campos extras por ata: `amostra` (`"fora"`, `"dentro"`, `"previsao_283"`) e `probabilidades` {alta, manutencao, corte}. A entrada da 281 é a linha de previsão da 283 (decisão atual = 282). **Não é índice de tom**: metricas.py, previsao.py e gerar_dados_site.py usam sempre `banco/indice.json` para o tom (`fonte_indice = "simples"`); o site recebe este arquivo no campo `indice_modelo` de dados_site.json.

## banco/metricas_modelo.json — escrito por modelo/treinar.py

Modelo de decisão por ata (base em `modelo/base_modelo.csv`, gerada por `modelo/variaveis.py`). Alvo: decisão da reunião seguinte (alta, manutencao, corte).

```json
{
  "metodo": "...", "gerado_em": "...", "n_atas": 46,
  "variaveis": ["decisao_atual_alta", "decisao_atual_manutencao", "decisao_atual_corte", "tom_nivel", "tom_variacao",
                "tom_orientacao", "saldo_duro_brando", "sinais_virada", "distancia_focus", "hiato_inflacao"],
  "hiperparametros": { "logistica": "...", "floresta": "...", "arvore": "..." },
  "validacao_tempo": { "inicio_ata": 251, "fim_ata": 281, "n": 31,
    "metodos": { "ingenua|logistica|floresta|arvore": {
      "acuracia": 0.806, "acuracia_balanceada": 0.813,
      "matriz_confusao": { "rotulos": ["alta","manutencao","corte"], "linhas": "realizado", "colunas": "previsto", "valores": [[0,0,0],[0,0,0],[0,0,0]] },
      "viradas": { "acertos": 0, "total": 6 },
      "previsoes": [ { "ata": 251, "previsto": "alta", "realizado": "alta", "probabilidades": { "alta": 1, "manutencao": 0, "corte": 0 } } ] } } },
  "validacao_loo": { "n": 46, "metodos": { "...": "mesmo formato" } },
  "melhor": "ingenua", "melhor_nao_ingenuo": "logistica",
  "destaque_viradas": { "metodo": "logistica", "acuracia": 0.806, "viradas": {"acertos": 1, "total": 6}, "viradas_ingenua": {"acertos": 0, "total": 6} },
  "coeficientes_logistica": { "alta": { "tom_nivel": 0.1 } },
  "importancias_floresta": [ { "variavel": "decisao_atual_alta", "importancia": 0.05, "desvio": 0.03 } ],
  "regra_arvore_pt": "Se ..., prevê ...
...", "regra_arvore_texto": "export_text bruto",
  "previsao_atual": { "reuniao": 283, "data": "2026-12-09", "linha_base": { "ata": 281, "decisao_atual": "manutencao" },
    "modelo": "ingenua", "probabilidades": { "alta": 0, "manutencao": 1, "corte": 0 },
    "por_modelo": { "ingenua|arvore|logistica|floresta": { "alta": 0, "manutencao": 1, "corte": 0 } } },
  "acuracia_previsao_decisao": 0.806
}
```

`viradas` = atas em que a decisão seguinte ≠ decisão atual. `destaque_viradas` é null se nenhum modelo empata com a ingênua no geral acertando mais viradas. `acuracia_previsao_decisao` = acurácia na janela no tempo do `melhor`.

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

Escreve: `pipeline/previsao.py` (etapa `previsao` do `rodar.py`, depois de `metricas`). Previsão para a **próxima reunião ainda não realizada**, pelo método escolhido em `metricas_previsao.json`.

```json
{
  "gerado_em": "2026-11-06T13:02:10-03:00",
  "base_ata": 281, "base_data_reuniao": "2026-09-16", "fonte_indice": "simples", "indice": 0.62,
  "regra": { "aperto": "indice > 0.25", "afrouxamento": "indice < -0.25" },
  "previsto": "manutencao",
  "metodo_escolhido": "ingenua", "acuracia_escolhido": 0.844, "previsto_nivel_tom": "aperto",
  "variacao_tom": { "delta": -0.28, "ata": 281, "ata_anterior": 280 },
  "metodos": [
    { "nome": "ingenua", "rotulo_pt": "Previsão ingênua (repete a última decisão)", "acuracia_loo": 0.844, "acerto_sinal": 0.9, "n": 45, "previsto_proxima": "manutencao", "disponivel": true },
    { "nome": "variacao_tom", "...": "..." }, { "nome": "nivel_tom", "...": "..." },
    { "nome": "modelo_parceiro", "rotulo_pt": "...", "acuracia_loo": null, "acerto_sinal": null, "n": null, "previsto_proxima": null, "disponivel": false }
  ],
  "proxima_reuniao": { "numero": 283, "data": "2026-12-09", "fonte": "BCB, calendário oficial do Copom (bcb.gov.br/controleinflacao/copom)" },
  "ultima_decisao_conhecida": { "numero": 282, "data": "2026-11-04", "selic": 13.75, "decisao_pp": 0.0, "decisao": "manutencao", "ata_publicada": false, "fonte": "BCB, histórico das taxas de juros (...)", "confere_sgs432": true },
  "ultima_decisao": { "...": "mesmo formato; sempre preenchido, mesmo com a ata publicada" },
  "acerto": {
    "indice": { "acuracia": 0.4, "acerto_sinal": 0.429, "n": 45, "n_direcionais": 42 },
    "ingenua": { "acuracia": 0.844, "acerto_sinal": 0.9, "n": 45, "n_direcionais": 30, "previsto": "manutencao" },
    "periodo": { "inicio": "2021-01-20", "fim": "2026-08-05" }, "melhor": "ingenua"
  },
  "focus_selic": { "mediana": 13.5, "ano_referencia": 2026, "data": "2026-10-30" }
}
```

- `previsto`: previsão do método `metodo_escolhido` (o de maior `acuracia_loo`; `acuracia_escolhido`). `previsto_nivel_tom` = regra de nível do tom (a antiga `previsto`). `metodos`: todos os métodos na ordem de desempate, inclusive os indisponíveis (`disponivel: false`, campos null). Para a próxima reunião, `ingenua` e `variacao_tom` partem da última decisão conhecida (mesmo sem ata publicada); `variacao_tom.delta` = índice da última ata − índice da anterior.
- `indice`/`base_ata`: índice da última ata com índice (sempre `indice.json`). `metodos[]` ganha `acuracia_tempo`, `n_tempo`, `viradas_tempo` e `probabilidades` (só nos modelos); `acuracia_escolhido` é a acurácia no tempo; campos novos `criterio_escolha`, `validacao_tempo` e `destaque_viradas`. Regra fixa de ±0,25, a mesma de `metricas_previsao.json`; não é ajustada.
- `proxima_reuniao`: calendário oficial do BC (`https://www.bcb.gov.br/api/servico/sitebcb/calendario/anual`, lista "Reuniões do Copom", a mesma do "Calendário do Copom" em bcb.gov.br/controleinflacao/copom). A data é o 2º dia da reunião (dia da decisão): a primeira posterior à última decisão conhecida e não anterior a hoje. `numero` = número da última decisão conhecida + 1. Se o calendário falhar e não houver data futura já gravada: `data` e `numero` null e `fonte: "indisponível"`. Nunca se inventa data.
- `ultima_decisao_conhecida`: preenchido só quando há decisão oficial **sem ata publicada** (`ata_publicada: false`); senão null. Fonte: tabela oficial `historicotaxasjuros` (reuniões ordinárias), conferida com a SGS 432 (`confere_sgs432`). `ultima_decisao` tem a mesma estrutura e vem sempre.
- `acerto`: copiado de `banco/metricas_previsao.json` (`n` = nº de atas avaliadas). `ingenua.previsto` = última decisão conhecida no vocabulário da previsão (`alta → aperto`, `corte → afrouxamento`).
- `focus_selic`: mediana do Focus (Selic, `baseCalculo=0`) para o fim do ano da próxima reunião, na coleta mais recente (`data`).
- O arquivo só é regravado quando algo além de `gerado_em` muda.

## saida/textos.json

Escreve: `pipeline/textos.py`. Relatório de mercado (manchete, linha fina e 3 seções), com uma chamada `claude -p --model sonnet` verificada por código, ou plano B determinístico.

```json
{
  "ata_atual": 281, "ata_anterior": 280, "gerado_em": "2026-11-06T13:20:00-03:00",
  "origem": "claude", "motivo_automatico": null, "tentativas": 1, "reescritas": 0,
  "hash_entrada": "9f2c...", "previsto": "aperto", "proxima_reuniao": { "numero": 283, "data": "2026-12-09", "fonte": "..." },
  "manchete": "Copom suaviza o tom sobre a inflação e o sinal aponta aperto da Selic em 09/12",
  "linha_fina": "Uma frase de apoio.",
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
- `manchete`: anuncia a previsão do **método escolhido** (`previsao.json` `previsto`) para a próxima reunião, com a data em DD/MM; a mudança de tom entra só como explicação do que mudou na comunicação (ex.: "Copom deve manter a Selic em 09/12; ata 281 mostra tom menos duro"). Manchete e linha fina são reprovadas se citarem termos de outra direção (`TERMOS_CONTRA` em `textos.py`: para manutenção, "alta", "aperto", "subir", "corte", "redução" etc.). `metodo_escolhido` também é gravado em `textos.json`. `VERSAO` = 4.
- Verificação por código (vale para o Claude e para o plano B): toda sentença tem marcador; marcadores e citações batem nos dois sentidos; todo trecho é cópia literal (espaços e aspas tipográficas normalizados) de até 25 palavras do parágrafo indicado da ata atual ou da anterior; todo número da manchete, da linha fina e dos textos existe nos dados enviados (vírgula decimal e % normalizados; ignorados números de ata, de parágrafo, de reunião, anos e datas presentes nos dados); a manchete menciona a previsão de `previsao.json` e a data da próxima reunião; nas seções do relatório, nenhuma sentença fala dos nossos próprios dados (reprovadas as que contêm "acert", "previsão ingênua", "ingênua", "nosso sinal", "Focus" ou "não foi publicada"; manchete e linha fina podem); cada citação sustenta a sua sentença (ao menos uma palavra de 5+ letras fora das stopwords em comum entre a sentença e o trecho, sem acento e sem caixa). Até 2 reescritas com os erros.
- `origem` ∈ `"claude"`, `"automatico"`. `motivo_automatico` ∈ `null`, `"indisponivel"` (sem Claude, erro ou timeout), `"reprovado"` (falhou na verificação após 2 reescritas). Plano B: manchete por modelo fixo ("Copom deve {subir|manter|cortar} a Selic em DD/MM; ata N mostra tom {mais duro|menos duro|sem grande mudança}"), linha fina com o método escolhido e sua acurácia; `mudou` = até 3 mudanças do diff com maior \|nota\| ou maior variação de nota, cada uma com um de 3 ou 4 modelos de frase por tipo (novo, alterado, removido) e efeito (endureceu, suavizou), escolhido pela posição, e com o tema tirado do trecho citado; `efeito` = frase condicional fixa pela previsão, citando o parágrafo de maior \|nota\| das seções de condução/decisão; `observar` = frase fixa citando o parágrafo de maior \|nota\| que fala de riscos. No plano B o trecho é recortado por código: as primeiras até 25 palavras do parágrafo.
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
  "validacao_humana": null,
  "datas_dados": { "selic": "2026-11-05", "focus": "2026-10-31" },
  "previsao": { "...": "cópia de banco/previsao.json" },
  "manchete": { "texto": "Copom suaviza o tom ... e o sinal aponta aperto da Selic em 09/12", "linha_fina": "...", "origem": "claude" },
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
- `metricas_previsao` = conteúdo de `banco/metricas_previsao.json` ou null; `metricas_modelo` = `banco/metricas_modelo.json` ou null; `validacao_humana` = `validacao/resultado.json` ou null.

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

## validacao/para_rotular.csv e validacao/resultado.json

`pipeline/exportar_validacao.py` escreve o CSV com 20 parágrafos de atas diferentes, sem a nota do Claude; colunas `ata,paragrafo,texto,nota_humana` (`nota_humana` em branco para o time preencher).

`validacao/comparar.py` lê o CSV preenchido e `banco/rotulos.jsonl` e escreve:

```json
{ "n": 20, "concordancia_exata": 0.65, "concordancia_1ponto": 0.90, "itens": [ { "ata": 281, "paragrafo": 12, "nota_humana": 1, "nota_claude": 1 } ] }
```

## Edições do painel (banco Postgres)

Escreve: o site (`/painel/editar`). Tabelas `edicoes(id, criado_em, campo, chave, valor_antigo, valor_novo, motivo)` e `config(chave, valor)`. O site público aplica a edição mais recente de cada `campo`+`chave` sobre o JSON e marca "revisado pelo time"; o JSON original nunca muda. Se o banco estiver fora, o site mostra o JSON.

Campos editáveis de textos (acrescentados em 06/11):

| campo | chave | regra |
|---|---|---|
| `manchete.texto` | `<ata>` | texto livre, não vazio, até 300 caracteres, motivo obrigatório |
| `manchete.linha_fina` | `<ata>` | idem |
| `relatorio.paragrafo` | `<ata>.<secao>.<i>` (secao ∈ `mudou`, `efeito`, `observar`; i base 0) | ao menos um marcador `[[cN]]`; todo marcador tem de existir nas `citacoes` do parágrafo original; nenhuma citação nova; motivo obrigatório |

`<ata>` é `relatorio.base_ata`, senão `previsao.base_ata`, senão `resumo.ultima_ata.numero`. Quando o pipeline regenera manchete e relatório para outra ata, as edições antigas deixam de ser aplicadas (continuam no histórico).
