# Conferência manual de 3 atas (modelo/base_modelo.csv)

Recalculado com um script independente direto de banco/atas.json, banco/indice.json, data/case1_focus/focus_anuais.csv (Selic, baseCalculo=0, Data ≤ reunião, ano da reunião) e data/case1_focus/sgs_realizado.csv (ipca_12m).

| Ata | Data | decisão atual → alvo | tom_nivel / variação | Selic − Focus | IPCA 12m − meta | Confere |
|---|---|---|---|---|---|---|
| 236 | 2021-01-20 | manutenção → alta | 0,23 / 0 (primeira) | 2,00 − 3,50 = −1,50 | 4,56 − 3,75 = 0,81 | sim |
| 260 | 2024-01-31 | corte → corte | 0,47 / 0,47 − 0,39 = 0,08 | 11,25 − 9,00 = 2,25 | 4,51 − 3,00 = 1,51 | sim |
| 281 | 2026-09-16 | corte → manutenção (282, CSV oficial) | 0,62 / 0,62 − 0,90 = −0,28 | 13,75 − 13,75 = 0 | 4,58 − 3,00 = 1,58 | sim |

A 281 aparece duas vezes na base: linha de treino (decisão atual = corte da própria 281, alvo = manutenção da 282) e linha de previsão da 283 (prever=1, decisão atual = manutenção da 282).
tom_orientacao, saldo_duro_brando e sinais_virada vêm de banco/rotulos.jsonl e banco/paragrafos.jsonl (seção "D) Decisão de política monetária", presente nas 46 atas); não foram recontados à mão.

Limitação encontrada: o IPCA 12m usa a observação com data de referência ≤ data da reunião (como pedido). Na 281 isso pega o IPCA de setembro/2026, que ainda não estava divulgado em 16/09. Há vazamento de até um mês no hiato_inflacao; não foi corrigido por falta de tempo.
