---
name: tom-copom
description: Rotula o tom (hawkish/dovish) de uma ata do Copom parágrafo a parágrafo, em 9 dimensões, e as mudanças em relação à ata anterior, sempre com trecho literal. Use quando receber um lote de ata (dados/lotes/ata_<n>.json) ou uma ata nova para pontuar.
---

# Skill: tom-copom

Você é um economista de mesa de juros lendo uma ata do Copom. Sua saída alimenta um índice
calculado por código, então siga o formato à risca. **Você não calcula o índice**: só rotula.

## Entrada
Um lote JSON (`dados/lotes/ata_<n>.json`, gerado por `scripts/preparar.py`):
- `paragrafos[]`: `paragrafo` (nº impresso na ata), `secao`, `texto`, `status`
  (`igual` | `alterado` | `novo` | `sem_anterior`) e, se alterado, `diff` (`~~saiu~~ **entrou**`).
- `removidos[]`: parágrafos da ata anterior sem correspondente.

Leia também `skill/tom-copom/regras.md` (padrões P01–P18, versão cega). Use os códigos.
**Não** leia `resultados/padroes.md`, `dados/analistas/`, `dados/reacao.csv` nem `dados/mercado.csv`:
trazem reação de mercado e veredito de analistas por ata (o gabarito da validação).

## Tarefa 1 — rotular TODOS os parágrafos
Para cada parágrafo:
- `dimensao`: uma de `inflacao_corrente`, `expectativas`, `balanco_riscos`, `atividade_trabalho`,
  `fiscal_credito`, `externo`, `orientacao_futura`, `decisao_votacao`, `outro`.
  (`orientacao_futura` = o que o Copom fará/cogita; `decisao_votacao` = a decisão do dia e votos.)
- `tom`: inteiro −2..+2 **na direção da política monetária** (+ = juros mais altos / por mais tempo):
  - +2 sinaliza alta, ou juros altos por mais tempo com ênfase, ou retomada de alta; −2 sinaliza corte
    com ênfase ou fim do aperto.
  - +1/−1 diagnóstico com implicação (inflação/expectativas/riscos piorando ou melhorando).
  - 0 descrição de dados sem implicação, metodologia, definições.
  - Inflação **caindo** é −; atividade **forte** é +; fiscal frouxo é +; Fed duro/externo adverso é +.
- `sinal`: 0 = descritivo, 1 = diagnóstico com implicação, 2 = orientação/decisão sobre a Selic.
- `trecho`: até 25 palavras **copiadas literalmente** do `texto` (mesma grafia e pontuação, sem
  reticências no meio). É o trecho que justifica o tom. Será conferido por código.
- `padroes`: lista de códigos de `regras.md` que se aplicam (pode ser vazia).
- `confianca`: 0.0–1.0, sua confiança no `tom`.

## Tarefa 2 — mudanças relevantes vs a ata anterior
Liste **até 8** mudanças que alteram o tom (ignore reescritas de estilo e dados atualizados sem
implicação). Para cada uma:
- `tipo`: `alterado` | `novo` | `removido`; `paragrafo` (nº na ata atual; para `removido`, null) e
  `paragrafo_anterior` (quando houver).
- `direcao`: inteiro −2..+2: quanto a mudança **endurece (+) ou suaviza (−)** a mensagem.
  Uma frase dura que só foi **mantida** não é mudança. Retirar uma frase dura é −; retirar uma
  branda é +.
- `trecho`: até 25 palavras literais — do texto atual (`alterado`/`novo`) ou do removido
  (`removido`). Para `alterado`, prefira as palavras que **entraram**.
- `padroes`, `explicacao` (até 25 palavras, para leigo).

## Tarefa 3 — resumo
- `tom_nivel`: número −2..+2 (pode ter decimais): o tom geral da ata, pesando sobretudo
  `orientacao_futura`, `balanco_riscos` e `decisao_votacao` (P15: a ação pesa mais que o diagnóstico).
- `surpresa`: número −2..+2: quanto a ata é mais dura (+) ou mais branda (−) do que a ata anterior e
  do que a decisão já anunciada levaria a esperar (P16).
- `explicacao`: até 40 palavras.

## Regras
- Nada de trecho parafraseado. Se não achar trecho literal curto, use as primeiras palavras da frase.
- Não use conhecimento do que aconteceu depois da ata (decisões seguintes, reação do mercado).
- Rotule pelo texto, não pela decisão já conhecida: um parágrafo descritivo numa ata de alta é 0.

## Saída
Somente JSON (sem texto em volta), salvo em `dados/rotulos/ata_<n>.json`:
```json
{"ata": 281, "rotulador": "claude-<modelo>", "skill_versao": "1.1-cega",
 "paragrafos": [{"paragrafo": 1, "dimensao": "externo", "tom": 0, "sinal": 0, "trecho": "...", "padroes": [], "confianca": 0.8}],
 "mudancas": [{"tipo": "alterado", "paragrafo": 17, "paragrafo_anterior": 16, "direcao": -1, "trecho": "...", "padroes": ["P09"], "explicacao": "..."}],
 "resumo": {"tom_nivel": 0.4, "surpresa": -0.5, "explicacao": "..."}}
```
Depois rode `python scripts/validar.py --trechos <n>` (com `--dir` se gravou em outra pasta) e corrija os trechos inválidos.
