# Forças e fraquezas do modelo publicado

Gerado por `modelo/analise_erros.py` em 2026-11-06T15:16:14. Modelo: logistica (StandardScaler + LogisticRegression(C=0.3, max_iter=5000)). Validação no tempo, atas 251–281 (2022-12-07 a 2026-09-16): 23 acertos em 31 previsões (74.2%).

**Amostra pequena:** 31 previsões e 6 viradas. Uma ata a mais ou a menos muda as taxas em vários pontos.

## 1. Por classe

| classe | previstas | realizadas | acertos | precisão | cobertura |
|---|---|---|---|---|---|
| alta | 7 | 7 | 5 | 71,4% | 71,4% |
| manutenção | 14 | 12 | 9 | 64,3% | 75,0% |
| corte | 10 | 12 | 9 | 90,0% | 75,0% |

## 2. Viradas contra continuações

| grupo | n | acertos | acurácia |
|---|---|---|---|
| viradas | 6 | 2 | 33,3% |
| continuações | 25 | 21 | 84,0% |

Demora para perceber cada virada (0 = acertou na própria virada; k = passou a prever a nova decisão k reuniões depois):

| ata | data | de | para | previsto na virada | reuniões até perceber |
|---|---|---|---|---|---|
| 255 | 2023-06-21 | manutenção | corte | manutenção | 2 |
| 262 | 2024-05-08 | corte | manutenção | manutenção | 0 |
| 264 | 2024-07-31 | manutenção | alta | manutenção | 2 |
| 271 | 2025-06-18 | alta | manutenção | alta | 1 |
| 276 | 2026-01-28 | manutenção | corte | corte | 0 |
| 281 | 2026-09-16 | corte | manutenção | corte | não percebeu |

A virada da ata 281 (corte → manutenção) é a última do período: não há reuniões depois dela no teste.

## 3. Por fase

Fases definidas pelas sequências de decisões em `banco/atas.json`. Cada previsão conta na fase da reunião que ela prevê (a seguinte). A previsão da ata 281 prevê a reunião 282, que ainda não está em atas.json; ela fica fora das fases.

| fase | atas | início | fim | atas na fase | previsões testadas | acertos | acurácia |
|---|---|---|---|---|---|---|---|
| manutenção inicial 2021 | 236–236 | 2021-01-20 | 2021-01-20 | 1 | 0 | — | — |
| ciclo de altas 2021–2022 | 237–248 | 2021-03-17 | 2022-08-03 | 12 | 0 | — | — |
| pausa 2022–2023 | 249–255 | 2022-09-21 | 2023-06-21 | 7 | 4 | 4 | 100,0% |
| ciclo de cortes 2023–2024 | 256–262 | 2023-08-02 | 2024-05-08 | 7 | 7 | 5 | 71,4% |
| pausa 2024 | 263–264 | 2024-06-19 | 2024-07-31 | 2 | 2 | 2 | 100,0% |
| retomada das altas 2024–2025 | 265–271 | 2024-09-18 | 2025-06-18 | 7 | 7 | 5 | 71,4% |
| pausa 2025–2026 | 272–276 | 2025-07-30 | 2026-01-28 | 5 | 5 | 3 | 60,0% |
| cortes de 2026 | 277–281 | 2026-03-18 | 2026-09-16 | 5 | 5 | 4 | 80,0% |

Fora do teste: o ciclo de altas 2021–2022 (e a manutenção inicial de 2021), porque a validação começa na ata 251. A pausa de 2022–2023 só entra em parte (4 de 7 atas).

## 4. Confiança e calibração

| maior probabilidade | n | acertos | acurácia |
|---|---|---|---|
| acima de 60% | 25 | 19 | 76,0% |
| até 60% | 6 | 4 | 66,7% |

| faixa | n | prob. média | acerto real |
|---|---|---|---|
| <50% | 2 | 46,7% | 50,0% |
| 50–60% | 4 | 56,2% | 75,0% |
| 60–75% | 5 | 71,3% | 80,0% |
| >75% | 20 | 87,6% | 75,0% |

Brier multiclasse: 0.399 (regra ingênua de repetir a decisão da ata: 0.387; menor é melhor).

## 5. Erros

Contribuição = coef(prevista) × valor padronizado − coef(realizada) × valor padronizado, na logística treinada só com as atas anteriores (o reajuste reproduz as probabilidades publicadas com diferença máxima de 0.0005).

| ata | data | previsto | realizado | probabilidades | puxaram para o erro |
|---|---|---|---|---|---|
| 255 | 2023-06-21 | manutenção | corte | alta 8% / manutenção 92% / corte 0% | classe 'corte' ausente do treino desta janela: contribuição não calculável |
| 256 | 2023-08-02 | manutenção | corte | alta 14% / manutenção 62% / corte 24% | termos de virada na seção de decisão (+0.627); termos de câmbio por mil palavras (+0.33); termos de atividade por mil palavras (+0.268) |
| 264 | 2024-07-31 | manutenção | alta | alta 3% / manutenção 92% / corte 4% | desvio-padrão das notas (+1.222); número de parágrafos (+0.836); decisão registrada na ata = manutencao (+0.788) |
| 265 | 2024-09-18 | manutenção | alta | alta 22% / manutenção 76% / corte 2% | termos de atividade por mil palavras (+1.655); termos fiscais por mil palavras (+0.632); termos de mercado de trabalho por mil palavras (+0.587) |
| 271 | 2025-06-18 | alta | manutenção | alta 84% / manutenção 15% / corte 2% | termos de câmbio por mil palavras (+0.666); decisão registrada na ata = alta (+0.607); termos de expectativas por mil palavras (+0.507) |
| 274 | 2025-11-05 | alta | manutenção | alta 52% / manutenção 44% / corte 4% | termos de câmbio por mil palavras (+1.763); variação do tom contra a ata anterior (+0.301); termos de virada na seção de decisão (+0.258) |
| 280 | 2026-08-05 | manutenção | corte | alta 14% / manutenção 44% / corte 42% | variação do número de parágrafos (+0.881); termos de inflação por mil palavras (+0.45); variação do tom contra a ata anterior (+0.324) |
| 281 | 2026-09-16 | corte | manutenção | alta 11% / manutenção 4% / corte 84% | termos de virada na seção de decisão (+1.377); decisão registrada na ata = corte (+1.03); decisão registrada na ata = manutencao (+0.49) |

## 6. Conclusão

- **Onde é confiável:** Nas continuações (a próxima decisão repete a da ata): 21 de 25 acertos (84%). Quando prevê corte, acerta 9 de 10 (precisão 90%).

- **Onde falha:** Nas viradas de ciclo: 2 de 6 acertos (33%). Em geral percebe a mudança 1 ou 2 reuniões depois, e não percebeu a pausa que veio depois da ata 281. Com probabilidade acima de 75% acerta 75% (15 de 20), abaixo da confiança média de 88%: o modelo é confiante demais.

- **Por quê:** A variável mais forte é a decisão registrada na própria ata, que empurra para repetir a decisão. Nos erros, sinais_virada, termos de câmbio e de atividade puxaram para o lado errado. O Brier multiclasse (0,399) ficou pior que o da regra ingênua de repetir a decisão (0,387), e a regra ingênua acerta 25 de 31 (as continuações). Amostra pequena: 31 previsões e só 6 viradas.

Próximos passos (não executados):

1. Medir o modelo sempre ao lado da regra ingênua e só publicá-lo se ganhar dela na acurácia ou no Brier.
2. Calibrar as probabilidades (por exemplo, regularização mais forte ou calibração por temperatura na validação no tempo) para que 88% de confiança média corresponda a acerto parecido.
3. Criar e testar variáveis próprias de virada (mudança na orientação futura entre atas, Focus da Selic) e avaliar o modelo pela acurácia nas viradas, não só no total.
