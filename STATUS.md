# Status — Tradutor do Copom (06/11/2026, congelamento das 15h00)

## URLs

- Site público: https://tradutor-copom.vercel.app
- Painel: https://tradutor-copom.vercel.app/painel (pede login com `ADMIN_PASSWORD`)
- Repositório: https://github.com/GFCelani/comp
- Busca (API): `GET https://tradutor-copom.vercel.app/api/busca?q=cambio`

## Banco

- 46 atas do Copom, da reunião 236 (20/01/2021) à 281 (16/09/2026). A 282 (04/11/2026) já foi decidida (Selic mantida em 13,75%), mas a ata ainda não foi publicada; o workflow a incorpora quando sair.
- 1060 parágrafos, todos rotulados pelo Claude (Sonnet), com 1 trecho inválido (ata 236 §19, palavra quebrada no PDF).
- Selic e decisões conferidas com a tabela oficial do BC: 46 reuniões, 0 divergências pelo endpoint `historicotaxasjuros` e 0 divergências contra `validacao/selic_oficial.csv`.

## Previsão da próxima reunião (283, 09/12/2026)

Regra (ver `DECISOES.md`): a capa publica o método com maior acurácia na validação com janela crescente no tempo (da 16ª ata em diante, n = 31, atas 251 a 281). Em empate, vale o mais simples.

| Método | Acurácia no tempo | Acurácia balanceada | Viradas acertadas |
|---|---|---|---|
| Previsão ingênua (repete a decisão atual) | 80,6% | 81,3% | 0 de 6 |
| Regressão logística (C = 0,5) | 80,6% | 81,3% | 1 de 6 |
| Floresta aleatória (300 árvores, prof. 3) | 77,4% | 78,6% | 1 de 6 |
| Árvore de decisão (prof. 2) | 71,0% | 71,0% | 1 de 6 |
| Variação do tom (±0,25) | 67,7% | — | 2 de 6 |
| Nível do tom (±0,25) | 22,6% | — | 1 de 6 |

- **Na capa: previsão ingênua → manutenção.** A logística empatou e acertou 1 virada a mais (registrado como `destaque_viradas`).
- Probabilidades para a 283:

| Modelo | Alta | Manutenção | Corte |
|---|---|---|---|
| Logística | 37,6% | 47,9% | 14,6% |
| Floresta | 13,5% | 59,2% | 27,3% |

- Variáveis mais importantes (permutação, todas fracas): decisão atual = alta, Selic − Focus do fim do ano e tom da seção de decisão.
- Validação deixando uma ata de fora (secundária, n = 46): ingênua 82,6%, logística 84,8%.

## Modelos de tom de parágrafo

- TF-IDF de base (plano B da nota) contra os rótulos do Claude, em 5 folds: acurácia 75,6%, 96,1% dentro de 1 ponto, erro médio absoluto 0,29.
- O classificador do parceiro (branch `sentiment-tracker`) tem acurácia de 0,662 segundo os arquivos dele. Ainda não foi trazido para a main (ver pendências).

## Pipeline e automação

- `pipeline/rodar.py` rodou duas vezes no congelamento. Na 1ª houve 1 chamada ao Claude, porque o relatório foi regenerado com a nova regra de escolha. Na 2ª, nenhuma chamada e nenhum download. Nenhuma falha.
- O workflow `atualizar_atas.yml` roda em dias úteis às 10h, 14h e 18h e também pelo botão manual. O teste de ponta a ponta numa branch passou: a ata 281 foi removida e voltou inteira, com os planos B de nota e de texto.
- Planos B da nota: modelo do parceiro → Claude → TF-IDF. Planos B dos textos: Claude com verificação → texto automático sem IA.

## Verificação feita no congelamento

- Produção no Playwright em 1280 e 390 px: a manchete "Copom deve manter a Selic em 09/12; ata mostra tom menos duro", nenhum erro no console, nenhuma rolagem lateral no celular e nenhuma faixa EXEMPLO. Capturas em `.playwright-mcp/congelamento-home-*.png`.
- O `/painel` abriu a tela de login. O conteúdo autenticado do painel não foi conferido.

## Pendências e o que não foi testado

- **Edição em produção:** o banco já é reconhecido, porque a integração Neon usa o prefixo `DATABASE_URL_` e o site lê esse nome. Mas o login de teste com a senha baixada por `vercel env pull` deu 401. Por isso a edição real, o histórico e os erros com sessão (400, 422, 409) não foram testados em produção. Os testes locais das regras passaram (13 de 13).
- **Token do Claude no GitHub:** `CLAUDE_CODE_OAUTH_TOKEN` não está cadastrado. O workflow funciona pelos planos B; falta o 2º teste de ponta a ponta com o token e a data do cadastro em `saida/status.json`.
- **Validação humana:** `validacao/para_rotular.csv` ainda não foi preenchido.
- **Pasta do parceiro:** trazer `sentiment_tracker/` da branch `sentiment-tracker` para a main foi bloqueado pela permissão; precisa de decisão do time.
- **Vazamento no modelo:** `hiato_inflacao` pode vazar até um mês de informação (usa o IPCA do mês da reunião, divulgado depois). Está documentado e não foi corrigido.
- **Variáveis sem conferência manual:** `tom_orientacao`, `saldo_duro_brando` e `sinais_virada` não foram recontadas à mão (`modelo/CONFERENCIA.md`).
- **Dados do BC:** o `scripts/baixar_dados_bcb.py` do case falha hoje (400 no Focus); o `pipeline/selic.py` tem plano B.
