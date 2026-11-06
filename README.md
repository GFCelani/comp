# CopomAI — Case 2: Tradutor do Copom

> Claude Lab · Economia & Finanças · PUC-Rio · 06/11/2026

O CopomAI lê as atas do Copom e mostra o tom de cada ata, o que mudou de uma para outra e uma previsão para a próxima reunião. Cada afirmação vem com a citação da ata conferida.

- **🔗 Site:** https://tradutor-copom.vercel.app
- **🔐 Painel:** https://tradutor-copom.vercel.app/painel. Senha de demonstração: `12345`. Ela será trocada depois da avaliação.
- **🎬 Vídeo (2 min):** LINK_DO_VIDEO

## Equipe

| Nome | Papel |
|---|---|
| NOME | |
| NOME | |
| NOME | |

## O problema

As atas do Copom são longas e técnicas. Pequenas mudanças de redação sinalizam mudanças de rumo dos juros, e quem não acompanha o BC todo dia não tem tempo de ler e comparar cada ata.

## A solução

Um site público feito a partir de 46 atas, da reunião 236 (20/01/2021) à 281 (16/09/2026), com 1060 parágrafos. Ele mostra:
- manchete e relatório com citações;
- índice de tom por ata, de −2 a +2, ao lado da Selic;
- o que mudou em relação à ata anterior;
- previsão da próxima reunião;
- "Pergunte às atas", com respostas que citam as fontes.

Um GitHub Actions roda nos dias úteis às 10h, 14h e 18h. Ele baixa as atas novas, dá as notas, recalcula tudo e publica. Cada etapa tem plano B: para a nota, o modelo do parceiro, depois o Claude e depois um TF-IDF; para o texto, o Claude e depois um texto automático sem IA.

A previsão vem de uma regressão logística (C = 0,3) com variáveis tiradas só das atas e das notas de tom. Na validação no tempo (atas 251 a 281, n = 31), acertou 74,2% e 2 de 6 viradas. Para a reunião 283 (09/12/2026), as probabilidades são: corte 56,2%, manutenção 28,5% e alta 15,2%. Detalhes em `DECISOES.md` e `STATUS.md`.

## Como verificamos

- **Trechos citados conferidos por código:** cada nota e cada citação precisam trazer um trecho que existe no parágrafo citado. Dos 1060 parágrafos, só 1 tem trecho inválido (ata 236 §19, palavra quebrada no PDF).
- **Selic contra o histórico oficial do BC** (`historicotaxasjuros`): 46 reuniões, 0 divergências. Se surgir divergência, o workflow abre uma issue.
- **Validação no tempo:** cada ata é prevista só com as anteriores. Os modelos novos (v2 e v3) tiveram as variáveis fixadas antes de rodar, com um período de escolha (atas 251–270) e uma confirmação rodada uma única vez (atas 271–281). Nenhum dos dois superou o modelo atual.
- **Portão de qualidade (`pipeline/portao.py`):** antes de publicar, confere três coisas: o número de parágrafos é plausível, a numeração vai de 1 a n e os trechos inválidos não passam de 10% dos rótulos. Também confere o build do site. Se reprovar, nada é publicado.

## Limitações

- **A regra ingênua acerta mais:** repetir a última decisão acerta 80,6% no mesmo período, contra 74,2% do modelo publicado, que só acerta 2 viradas a mais.
- **Erra nas viradas:** acerta 2 de 6 (33%), contra 21 de 25 nas continuações. Também é confiante demais: com probabilidade acima de 75%, acerta 75%. Detalhes em `modelo/analise_erros.md`.
- **Amostra pequena:** 31 previsões e só 6 viradas.
- **Ainda não testado em produção:** a edição pelo painel e o workflow com o token do Claude cadastrado.

## Aviso

Projeto acadêmico desenvolvido em workshop. **Não constitui recomendação de investimento.**

**Feito com:** Claude (Claude Code, Sonnet e Haiku), Python, scikit-learn, Next.js, Vercel e GitHub Actions.
