# Contrato de dados — Tradutor do Copom

Formato de cada arquivo trocado entre o pipeline, o modelo do parceiro e o site. Quem escreve um arquivo é responsável por manter o formato; quem lê não deve depender de campos fora daqui.

Convenções: UTF-8; datas `AAAA-MM-DD`; `ata` = número da reunião (inteiro); notas inteiras de −2 a +2; índices com 2 casas decimais; proporções (acurácia etc.) entre 0 e 1; `gerado_em` em ISO 8601 com hora.

Pastas: `banco/` e `saida/` são escritos pelo pipeline (`pipeline/`), exceto `banco/indice_modelo.json` e `banco/metricas_modelo.json`, escritos pelo parceiro a partir de `modelo/`. O site lê só `site/data/dados_site.json` e `site/data/busca.json`, copiados pelo pipeline.

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

## banco/indice_modelo.json — escrito pelo parceiro

Mesmo formato de `banco/indice.json`, com `metodo` descrevendo o modelo (ex.: `"regressao_ponderada_por_secao"`). Pode trazer campos extras por ata. Quando este arquivo existir, o site usa este índice em vez do simples (salvo escolha no painel).

## banco/metricas_modelo.json — escrito pelo parceiro

Métricas do modelo contra os rótulos do Claude (`banco/rotulos.jsonl`).

```json
{
  "metodo": "regressao_ponderada_por_secao",
  "gerado_em": "2026-11-06T14:00:00",
  "n_paragrafos": 1800,
  "acuracia": 0.71,
  "acuracia_1ponto": 0.95,
  "erro_medio_abs": 0.34,
  "matriz_confusao": { "rotulos": [-2, -1, 0, 1, 2], "valores": [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]] },
  "validacao_leave_one_out": [
    { "ata": 281, "acuracia": 0.70, "acuracia_1ponto": 0.94, "erro_medio_abs": 0.36 }
  ]
}
```

`matriz_confusao.valores[i][j]` = nº de parágrafos com rótulo do Claude `rotulos[i]` e previsão do modelo `rotulos[j]`. `validacao_leave_one_out`: uma entrada por ata deixada de fora do treino. Enquanto o arquivo não existir, o painel mostra "aguardando modelo".

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

## saida/textos.json

Escreve: `pipeline/textos.py` (uma chamada `claude -p --model sonnet`, verificada por código).

```json
{
  "ata_atual": 281, "ata_anterior": 280, "gerado_em": "2026-11-06T13:20:00",
  "mudancas": [
    { "paragrafo": 12, "trecho": "até 25 palavras copiadas do parágrafo", "efeito": "endureceu", "explicacao": "Duas frases simples.", "tipo": "alterado" }
  ],
  "origem": "claude",
  "impacto": { "texto": "Dois ou três períodos em linguagem condicional.", "data_selic": "2026-11-05", "data_focus": "2026-10-31", "origem": "claude" }
}
```

`mudancas` tem no máximo 3 itens; `efeito` ∈ `"endureceu"`, `"suavizou"`; `tipo` ∈ `"novo"`, `"alterado"`, `"removido"`. Só entram itens cujo trecho existe no parágrafo e cujos números existem nos dados. `origem` (das mudanças) e `impacto.origem` ∈ `"claude"`, `"automatico"`. Plano B sem LLM, quando o Claude não está disponível, falha ou reprova após 2 reescritas: as 3 mudanças são escolhidas por código no diff (maior \|nota\| em novos e removidos, maior variação de nota em alterados), com `trecho` = primeira oração do parágrafo e `explicacao` de modelo fixo com as notas; o `impacto` vem de modelo fixo com índice, variação, decisão e Selic. Por isso sempre há texto. Campo extra `verificacao: {reescritas, descartados, chamadas_claude}` registra a checagem.

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
  "conferencia_selic": { "verificado_em": "2026-11-06T13:00:00-03:00", "fonte_url": "https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros", "n_comparadas": 46, "divergencias": [] }
}
```

- `exemplo: true` faz o site mostrar a faixa "EXEMPLO".
- `ultima_verificacao`: data e hora ISO, com fuso de Brasília (ex.: `"2026-11-06T13:30:00-03:00"`), da última vez que o pipeline conferiu se há ata nova. Muda só quando o pipeline publica uma ata; a verificação de cada execução fica em `saida/status.json`. `gerado_em` também vai com o fuso.
- `textos_pendentes`: sempre `false` desde os textos automáticos (plano B); o campo continua para compatibilidade. `mudancas_origem` e `impacto.origem` ∈ `"claude"`, `"automatico"` (o site mostra "texto automático").
- `conferencia_selic` = conteúdo de `saida/conferencia_selic.json` ou null.
- `atas[].paragrafos[].trecho` é null quando o trecho não passou na checagem (`trecho_valido: false`).
- `fonte_indice` ∈ `"simples"`, `"modelo"`: de onde vêm `serie[].indice`, `atas[].indice` e `resumo.ultima_ata.indice`. Usa `banco/indice_modelo.json` quando existir, senão `banco/indice.json`.
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
