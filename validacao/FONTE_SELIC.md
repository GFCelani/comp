# Fonte da tabela `selic_oficial.csv`

Decisões do Copom da reunião 236 (20/01/2021) à 282 (04/11/2026): 47 reuniões, todas ordinárias.

## Fonte

- Página: https://www.bcb.gov.br/controleinflacao/historicotaxasjuros
- Dados lidos do endpoint JSON que a própria página chama para montar a tabela (identificado pelo tráfego de rede no Chromium/Playwright):
  https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros
- Coleta: 2026-11-06T16:00:14Z (UTC).
- SHA-256 do JSON bruto baixado (102.633 bytes; não versionado): `3b8bee1210fb078d28508c25950010647791d580712cb96b3b3e6724239d6fce`
- Não foi usada nenhuma série do SGS, nem a 432. Nenhum valor foi preenchido manualmente.

## Colunas

| coluna | origem no JSON | regra |
|---|---|---|
| `numero` | `NumeroReuniaoCopom` | inteiro |
| `data_reuniao` | `DataReuniaoCopom` | convertido para horário de Brasília (UTC−3) e gravado como `AAAA-MM-DD`; no período, todos os registros vêm como `T03:00:00Z`, ou seja, meia-noite em Brasília |
| `selic_apos` | `MetaSelic` | meta Selic % a.a. (não a taxa efetiva), com 2 casas |
| `decisao` | derivada | `alta`, `baixa` ou `manutencao`, conforme o sinal de `decisao_pp` |
| `decisao_pp` | derivada | `MetaSelic` da reunião menos `MetaSelic` da reunião anterior, em p.p., com 2 casas |
| `vigencia_inicio` | `DataInicioVigencia` | mesma conversão de data de `data_reuniao` |
| `fonte_url` | n/a | URL do endpoint efetivamente lido |

A meta anterior da reunião 236 vem da reunião 235 (09/12/2020, meta 2,00), lida do mesmo JSON. A reunião 235 não entra no CSV.

## Conferências feitas

- Números de reunião consecutivos de 236 a 282, sem buracos nem repetições.
- `data_reuniao` e `vigencia_inicio` estritamente crescentes, e `vigencia_inicio` nunca anterior a `data_reuniao`.
- 8 reuniões por ano de 2021 a 2025, e 7 em 2026 até 06/11.
- `decisao_pp` recalculada a partir de `selic_apos`, com `decisao` coerente com o sinal de `decisao_pp`.
- Nenhuma reunião extraordinária nem decisão monocrática do presidente no período (`ReuniaoExtraordinaria` e `descisaoMonocraticaPres` falsos).
- Todas as 47 linhas comparadas com a tabela renderizada na página (número, data, meta e início de vigência), sem nenhuma divergência.

## Limitações

- O endpoint é interno ao site do BCB e não tem documentação; formato e URL podem mudar.
- A reunião 282 ainda não tem fim de vigência nem taxa efetiva. Isso não afeta as colunas desta tabela.
