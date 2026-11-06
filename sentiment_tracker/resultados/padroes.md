# Padrões de tom das atas do Copom (2021–2026)

Extraídos de **200 gatilhos** que analistas e imprensa apontaram em 46 atas (236–281), cruzados com a
variação da taxa prefixada de 2 anos no dia da publicação (`dados/reacao.csv`). Fontes de cada gatilho
em `dados/analistas/*.jsonl` (URL e trecho curto). Cada padrão traz as atas que o sustentam.
`Δpre2` = variação em pontos-base no dia; `z` = em desvios de um dia comum.

> Atenção: os padrões foram tirados das mesmas 46 atas em que o modelo é avaliado. É conhecimento de
> domínio, não um parâmetro ajustado, mas há risco de otimismo. Ver `validacao.md`.

## O que mais move o mercado (os casos com |z| ≥ 1 e reação atribuída à ata)

| Ata | Δpre2 | z | O que os analistas apontaram |
|---|---|---|---|
| 242 | +44,9 | +4,3 | "significativamente mais contracionista"; avaliou ritmos > 1,50 p.p. |
| 267 | +39,1 | +4,1 | juro neutro 4,75→5,00; fiscal e crédito "mitigando" a política monetária |
| 269 | +20,6 | +1,7 | "restrição monetária maior e por mais tempo" (mas sinaliza ajuste menor) |
| 241 | +16,7 | +1,6 | "significativamente contracionista" (e "ritmo atual suficiente") |
| 275 | +11,7 | +1,3 | **não** retirou "retomará o ciclo"; nenhuma discussão de cortes |
| 257 | +13,8 | +1,4 | fiscal: da "aprovação" para a "execução" das metas |
| 246 | −30,3 | −2,8 | balanço de riscos deixou de ser "assimétrico para cima" |
| 277 | −22,0 | −3,0 | debate só sobre o tamanho do corte, não sobre pausa |
| 274 | −20,4 | −2,1 | "maior convicção de que a taxa corrente é suficiente" |
| 249 | −25,2 | −1,9 | hiato zerado ainda convergiria em 2024 |
| 279 | −7,9 | −1,1 | diagnóstico duro ("assimetria altista") com ação branda: o mercado seguiu a ação |

Lição central: **o mercado reage à orientação sobre os próximos passos e ao balanço de riscos**;
diagnóstico de conjuntura raramente move preço sozinho.

## Padrões (use os códigos na rotulagem)

**P01 · Orientação explícita do próximo passo (peso máximo).** Frases que dizem o que o Copom fará
ou cogita: "não hesitará em elevar" (264, +2), "processo parcimonioso de inflexão na próxima reunião"
(255, −2), "iniciar a flexibilização já na próxima reunião" (276), "ajuste de menor magnitude" (269),
"antecipa uma interrupção" (271). Avaliar ritmos maiores que o atual = duro (239, 242).

**P02 · Plural x singular e horizonte da orientação.** "Nas próximas reuniões" (plural) compromete
mais de um passo: duro num ciclo de alta (244), âncora de ritmo num ciclo de corte (256). Retirar o
plural ou deixar de dar orientação = aumenta a opcionalidade; leitura depende do ciclo (261, 262: duro).

**P03 · Balanço de riscos.** "Assimétrico para cima / assimetria altista" = duro (264, 279, 280);
passar a "equilibrado/simétrico" = brando forte (246); debate sobre torná-lo neutro = brando (270).

**P04 · Duração: "período (bastante) prolongado", "maior e por mais tempo".** Duro no nível, mas
quando apenas repetido não surpreende (271–274). O sinal está na **retirada** (brando forte) ou na
**intensificação** (duro). Analistas monitoram ativamente a retirada (274, 275).

**P05 · Cláusula de retomada: "não hesitará em retomar / se necessário retomará o ciclo".** Manter
= duro (249, 254, 273, 275). Retirar = brando forte (pré-condição de corte, segundo Itaú na 274).

**P06 · Quem concorda.** "Unanimemente", "todos os membros" amplificam o sinal (262, 264, 266);
"alguns membros / um membro" revelam a ala minoritária e a direção dela antecipa o próximo passo
(236 duro, 255, 261). Dissidência por alta = duro (249).

**P07 · Juro neutro e taxa terminal.** Revisar o neutro para cima (4,50→4,75→5,00: 263, 267) ou
"taxa terminal superior" (247) = duro. Ligar o neutro ao fiscal/parafiscal = duro (258, 268, 273).

**P08 · Projeção x meta no horizonte relevante.** Projeção acima da meta, inclusive no cenário com
Selic constante = duro (264); "em torno da meta" exigido em vez de aceitar desvio = duro (247);
projeção na meta ou abaixo, ou horizonte que se alonga = brando (248, 279).

**P09 · Suficiência da taxa atual.** "Taxa corrente é suficiente", "maior convicção" = brando (274);
"não é suficiente / Focus insuficiente" = duro (247, 272). Atenção: "ritmo atual suficiente" num ciclo
de alta é brando no ritmo (241).

**P10 · Qualificadores e intensidade.** Trocas pequenas mudam o tom: "certa diminuição"→"diminuição"
e "alguma redução"→"a redução" = brando (275); "significativamente contracionista" = duro (241, 242);
"agora mais nítida" (expectativas caindo) = brando (274). Compare o diff palavra a palavra.

**P11 · Expectativas desancoradas.** Ênfase em desancoragem, novo horizonte citado (2028 na 278),
"desconforto comum a todos" = duro; reconhecer queda das expectativas = brando (273, 274);
retirar a ênfase = brando (275).

**P12 · Fiscal e parafiscal.** "Parafiscal", crédito direcionado, "execução das metas", "disciplina
fiscal", mudança de meta = duro (251, 253, 257, 258, 281). Movem pouco o preço na média; viram duro
de verdade quando ligados ao neutro (P07) ou ao tamanho do ciclo (242).

**P13 · Atividade e mercado de trabalho.** "Desaceleração incipiente / ganho de convicção na
desaceleração" = brando (268, 281); salários reais acima da produtividade, hiato positivo, ritmo de
desaceleração menor = duro (260, 261, 265).

**P14 · Ressalvas "não mecânicas".** "Não há relação mecânica", "não implica mecanicamente",
"seria um equívoco interpretar" = o BC empurra contra a leitura do mercado; a direção é a **oposta**
à leitura que ele quer conter (236, 253, 254, 261).

**P15 · Diagnóstico x ação.** Quando o diagnóstico é duro e a ação/orientação é branda, o mercado
segue a ação (279: "assimetria altista" + "momentos de pausa e retomada" → DI caiu). Pese a ação.

**P16 · Repetição do comunicado não é surpresa.** Frases já presentes no comunicado da decisão
são "em linha" (240, 266, 276). Surpresa = o que é novo em relação à ata anterior e ao comunicado.

**P17 · Choques de oferta.** "Não deve reagir aos efeitos primários" = brando; "reagir com firmeza
aos efeitos de segunda ordem" = duro (245, 280). Os dois juntos = neutro com viés duro.

**P18 · Serenidade/cautela/vigilância.** Vocabulário de estilo, muito repetido. Sozinho = 0 a +1;
não marca surpresa salvo quando aparece ou some (276: "serenidade" para conter apostas de corte).

## O que NÃO funcionou como sinal
- **Focus semanal** antes x depois da ata: a mediana para a próxima reunião praticamente não se move
  (passos de 0,25 p.p.); descartado como rótulo.
- **Ibovespa e dólar**: dominados por exterior, política e commodities; só ilustrativos.
- **Dias "contaminados"**: em 10 das 46 atas os analistas atribuíram o movimento a outro evento
  (IPCA no mesmo dia, eleição, Fed, fiscal). Esses dias têm peso zero no rótulo de mercado.
