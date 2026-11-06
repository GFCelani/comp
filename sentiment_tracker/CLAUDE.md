# sentiment_tracker — modelo de tom das atas do Copom

Guia para o Claude que for integrar esta pasta à infraestrutura do time (pipeline em `../pipeline/`,
site em `../site/`, contrato em `../CONTRATO.md`). Leia antes de mexer.

## O que é
Modelo que dá a cada ata do Copom dois números separados, com evidência e confiança:
- **nível** (−2..+2 e −100..+100): quão duro é o texto;
- **surpresa** (−2..+2): quanto a ata endureceu (+) ou suavizou (−) em relação ao esperado;
- **confiança** (0–100) e intervalos; dimensões (inflação, expectativas, balanço de riscos, atividade,
  fiscal, externo, orientação futura, decisão); até 3 mudanças-chave com trecho literal.

Julgamento = Claude seguindo a Skill `skill/tom-copom/` (sem chave de API: subagentes do Claude Code ou
`claude -p`). Agregação, calibração, verificação de trechos e confiança = Python determinístico.
Reserva sem IA: `scripts/modelo_reserva.py`.

## Contrato com o resto do repositório
Entradas que esta pasta LÊ (escritas pelo pipeline do time, formato em `../CONTRATO.md`):
- `../banco/paragrafos.jsonl` (ata, paragrafo, secao, texto) e `../banco/atas.json`.

Saídas que esta pasta ESCREVE (só dentro de `sentiment_tracker/`):
- `resultados/indice_modelo.json` — **mesmo formato de `banco/indice_modelo.json` do CONTRATO.md**
  (`indice` = nível −2..+2), com campos extras por ata: `indice_100`, `surpresa`, `confianca`, `ic95`,
  `dimensoes`, `mudancas` [{tipo, paragrafo, direcao, trecho, explicacao}], `explicacao`.
- `resultados/metricas_modelo.json` — formato de `banco/metricas_modelo.json` (modelo reserva vs rótulos
  do Claude, leave-one-ata-out), com extras.
- `resultados/indice.json` — formato completo (componentes, gabarito, calibração).

**Integração mínima**: copiar `resultados/indice_modelo.json` e `resultados/metricas_modelo.json` para
`../banco/`. Pelo CONTRATO.md, o site passa a usar este índice (`fonte_indice: "modelo"`). Esta pasta não
escreve em `../banco/` sozinha — a decisão é de quem integra.

**Ata nova** (depois que o pipeline extrair a ata para `banco/paragrafos.jsonl`):
```bash
cd sentiment_tracker && .venv/bin/python scripts/avaliar_ata.py <n>
```
Usa `../pipeline/claude_cli.py` (`claude -p`, mesma autenticação do pipeline) para aplicar a Skill; sem
Claude disponível, cai no modelo reserva e marca `rotulador: "modelo_reserva"`. Depois copie as saídas
para `../banco/` como acima. Sugestão: chamar isso em `pipeline/rodar.py` após `extrair.py`.

## Estrutura
```
skill/tom-copom/SKILL.md   régua multidimensional, formato de saída, regras de trecho literal
skill/tom-copom/regras.md  padrões P01–P18 (versão cega, sem dados por ata) — usada na rotulagem
resultados/padroes.md      padrões com evidência por ata (reação de mercado, analistas) — NÃO dar ao rotulador
scripts/
  baixar_mercado.py   prefixado 1a/2a (Tesouro Direto), Selic, dólar, Ibovespa, Focus → dados/mercado.csv
  isolar_reacao.py    reação no dia da ata, dias contaminados, gabarito de surpresa → dados/reacao.csv
  preparar.py         lote por ata: parágrafos + diff com a anterior → dados/lotes/ata_<n>.json
  validar.py          confere formato e trechos literais dos rótulos (sai com erro se falhar)
  lexico.py           placar de palavras (2ª opinião sem IA) → dados/lexico.csv
  indice.py           nível, surpresa (calibrada, leave-one-out), confiança → resultados/
  modelo_reserva.py   TF-IDF + ridge sem IA; prever(textos) → notas; métricas → resultados/
  avaliar_ata.py      ata nova de ponta a ponta
  relatorio.py        resultados/validacao.md a partir dos JSON
dados/
  analistas/*.jsonl   leitura de analistas por ata (veredito, gatilhos, fatores externos, fontes com URL)
  rotulos_cego/       rótulos OFICIAIS (Skill cega)
  rotulos/            rótulos v1 (contaminados; só para o teste de vazamento)
```
Pasta de rótulos usada pelos scripts: variável `TOM_ROTULOS` (padrão `rotulos`; oficial: `rotulos_cego`).

## Como rodar tudo
```bash
cd sentiment_tracker
uv venv .venv && uv pip install -p .venv/bin/python -r requirements.txt
.venv/bin/python scripts/baixar_mercado.py      # precisa de rede: Tesouro, BCB, Yahoo
.venv/bin/python scripts/isolar_reacao.py
.venv/bin/python scripts/preparar.py
.venv/bin/python scripts/lexico.py
export TOM_ROTULOS=rotulos_cego
.venv/bin/python scripts/validar.py --dir rotulos_cego
.venv/bin/python scripts/indice.py
.venv/bin/python scripts/modelo_reserva.py
.venv/bin/python scripts/relatorio.py
```

## Regras ao mexer
- Nunca dê ao rotulador `resultados/`, `dados/analistas/`, `dados/reacao.csv` ou `dados/mercado.csv`:
  é o gabarito. Já aconteceu (rodada v1) e invalidou a avaliação.
- Todo trecho tem que passar em `validar.py`. Nada de número fora de `resultados/*.json`.
- `indice.py` escolhe o estimador de surpresa pela correlação leave-one-out; não ajuste regras para
  "ganhar" do gabarito sem refazer a validação.
- Sem segredos no código: o único usado é o do pipeline (`CLAUDE_CODE_OAUTH_TOKEN`, na nuvem).

## ESTADO DO TRABALHO E PRÓXIMOS PASSOS (handoff — leia isto primeiro)

### Onde paramos (06/11)
Pronto e validado: 46 atas rotuladas às cegas (`dados/rotulos_cego/`), índice oficial, melhorias A/B/C,
teste fora da amostra com 2020 (`dados/holdout/`), modelo reserva, `avaliar_ata.py --reserva` testado,
relatório `resultados/validacao.md`. Notas sempre em −2..+2 (`indice.py` falha se sair da faixa).

Em andamento quando a sessão parou: **2ª leitura independente focada em DIREÇÃO**. Entradas prontas em
`dados/segunda_leitura/entrada/ata_<n>.txt` (só o que mudou vs a ata anterior). Saídas esperadas em
`dados/segunda_leitura/ata_<n>.json`. O código que usa essas saídas já está pronto (`indice.py` cria o
candidato `duas_leituras`; `teste_fora.py` usa o mesmo; o classificador de direção com zona neutra e
limiar por leave-one-out aninhado já roda).

Linha de base da direção SEM a 2ª leitura (fora da amostra): acerto 3 classes 54% (sempre "em linha": 50%),
precisão quando aponta direção 53%, sentido trocado 1 em 46.

### Passo 1 — terminar a 2ª leitura
Ver quais faltam: `ls dados/segunda_leitura/*.json` (precisa de 236–281 menos 236, e 228–235).
Rodar subagentes em paralelo (~13 atas cada) com este prompt (troque a lista):
> Segunda leitura independente de atas do Copom, focada em DIREÇÃO. Atas: <LISTA>. Leia primeiro
> `sentiment_tracker/skill/tom-copom/regras.md`. Para cada ata N leia SÓ
> `sentiment_tracker/dados/segunda_leitura/entrada/ata_N.txt` (só o que mudou vs a anterior: ALTERADO com
> ~~saiu~~ **entrou**, NOVO, REMOVIDO) e responda: comparada à anterior, a mensagem ficou mais dura, em
> linha ou mais branda? O padrão é em_linha; só aponte direção se houver mudança relevante para os juros
> (orientação, balanço de riscos, cláusulas de retomada/duração, suficiência da taxa, qualificadores, quem
> concorda). Dados atualizados, estilo e repetição não contam. Sinais opostos: pese ação acima do diagnóstico;
> se ambíguo, em_linha. Não use o que aconteceu depois; não leia outros arquivos de dados/, resultados/,
> banco/; sem web. Grave `sentiment_tracker/dados/segunda_leitura/ata_N.json`:
> {"ata": N, "direcao": "mais_dura"|"em_linha"|"mais_branda", "surpresa": -2..2 (0 em linha; ±0.5 leve;
> ±1 clara; ±2 forte), "confianca": 0-1, "evidencias": [{"trecho": "≤25 palavras do texto, sem ~~ e **",
> "efeito": "+"|"-"}], "explicacao": "≤30 palavras"}. Sem commit.

### Passo 2 — medir e escolher
```bash
cd sentiment_tracker && export TOM_ROTULOS=rotulos_cego
.venv/bin/python scripts/indice.py        # escolhe o estimador (inclui duas_leituras) por LOO e mede a direção
cd scripts && ../.venv/bin/python teste_fora.py && cd ..   # 2020, modelo congelado
.venv/bin/python scripts/relatorio.py     # atualiza resultados/validacao.md (seção 6b = direção)
```
Critério: a 2ª leitura só fica se melhorar a direção fora da amostra (`calibracao.json` → `direcao`:
acurácia 3 classes, precisão quando aponta direção, sentido trocado) sem piorar a correlação. Commit + push.

### Passo 3 — integrar ao site do time
```bash
cp resultados/indice_modelo.json resultados/metricas_modelo.json ../banco/
```
Pelo `../CONTRATO.md`, o site passa a usar este índice (`indice` = nível −2..+2; extras: `surpresa`
−2..+2, `direcao`, `confianca`, `ic95`, `mudancas` com trecho). Avisar o colega da infra. Commit + push.

### Passo 4 — ata 282 (publicação prevista 10/11)
Depois que o pipeline do time extrair a ata para `banco/paragrafos.jsonl`:
`TOM_ROTULOS=rotulos_cego .venv/bin/python scripts/avaliar_ata.py 282` (caminho com `claude -p` ainda não
testado; `--reserva` testado). Para a 2ª leitura da 282: `scripts/preparar_diff.py` e um subagente com o
prompt do Passo 1. Rodar `indice.py` de novo e copiar para `../banco/`.

### Ideias depois disso
- Ampliar o teste fora da amostra para 2019 (PDFs 220–227 já em `dados/holdout/atas/`; falta rotular e
  coletar analistas).
- O modelo superestima a surpresa de atas "em linha" no teste de 2020: a zona neutra deve ajudar; conferir.

### Regras
Commit + push a cada passo (`git push -u origin sentiment-tracker`). Nunca dar ao rotulador o gabarito
(`resultados/`, `dados/analistas/`, `dados/reacao.csv`, `dados/mercado.csv`).
