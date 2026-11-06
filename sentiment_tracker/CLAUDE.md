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

## ESTADO DO TRABALHO (06/11, fim da sessão)
Concluído: 46 atas rotuladas às cegas (`dados/rotulos_cego/`, todas validadas), índice oficial
(`TOM_ROTULOS=rotulos_cego`), melhorias A (gabarito de mercado com menos ruído), B (encolhimento da surpresa
quando os sinais discordam; escolhido por leave-one-out) e C (confiança calibrada pelo acerto real),
teste fora da amostra com atas de 2020 (`scripts/teste_fora.py`, dados em `dados/holdout/`), modelo
reserva retreinado, `avaliar_ata.py --reserva` testado de ponta a ponta. Números em `resultados/validacao.md`.

Próximos passos sugeridos:
1. Integrar: copiar `resultados/indice_modelo.json` e `metricas_modelo.json` para `../banco/`.
2. Ata 282 (sai 10/11): `TOM_ROTULOS=rotulos_cego .venv/bin/python scripts/avaliar_ata.py 282` (caminho com
   `claude -p` ainda não testado; o caminho `--reserva` foi testado).
3. Precisão: 2ª leitura independente só do diff de cada ata e média das duas (reduz variância, mede o
   intervalo entre execuções); ampliar o holdout para 2019 (atas 220–227 já baixadas em `dados/holdout/`).
4. O modelo superestima a surpresa de atas "em linha" (ver teste fora da amostra): calibrar a escala.
