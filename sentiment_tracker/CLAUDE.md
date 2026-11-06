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

## ESTADO DO TRABALHO E PRÓXIMOS PASSOS (handoff, 06/11 ~14h20)
Feito: mercado, leitura de analistas (47 atas), reação isolada, padrões, Skill cega, lotes, léxico,
índice com confiança e escolha leave-one-out, modelo reserva, avaliar_ata.py, relatorio.py.
Rótulos v1 (contaminados) completos: `dados/rotulos/` (46) e referência em
`resultados/calibracao_v1_contaminado.json`.

Pendente:
1. **Rotulagem cega das atas que faltarem em `dados/rotulos_cego/`** (confira com
   `ls dados/rotulos_cego`; ao fechar esta sessão faltavam 241 246 247 253 258 259 265 271 276 277).
   Para cada uma, rode subagentes em paralelo com este prompt (troque N):
   "Rotule a ata N seguindo `sentiment_tracker/skill/tom-copom/SKILL.md` e `regras.md`. Leia
   `dados/lotes/ata_N.json`, grave `dados/rotulos_cego/ata_N.json` (`skill_versao` 1.1-cega) e rode
   `.venv/bin/python scripts/validar.py --dir rotulos_cego --trechos N` até OK. PROIBIDO ler `resultados/`,
   `dados/analistas/`, `dados/reacao.csv`, `dados/mercado.csv`, `dados/lexico.csv`, `dados/rotulos/`,
   `banco/rotulos.jsonl`."
2. Com as 46 cegas: `export TOM_ROTULOS=rotulos_cego` e rodar `indice.py`, `modelo_reserva.py`,
   `relatorio.py` (gera `resultados/validacao.md` com o teste de vazamento v1 × cega).
3. Testar `scripts/avaliar_ata.py 281 --reserva` (caminho sem IA) e, se houver `claude` logado,
   `avaliar_ata.py 281` (cuidado: sobrescreve `dados/rotulos_cego/ata_281.json` se TOM_ROTULOS=rotulos_cego;
   teste com uma cópia). Ata 282 deve sair em 10/11.
4. Integração: copiar `resultados/indice_modelo.json` e `metricas_modelo.json` para `../banco/`.
