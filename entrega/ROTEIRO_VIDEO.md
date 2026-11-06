# Roteiro do vídeo: CopomAI (meta 1:50)

Fala total: 254 palavras. Cabe em cerca de 1:45 a 1:50 com as pausas dos cliques.
Os números abaixo foram conferidos em `site/data/dados_site.json` em 06/11/2026, às 14:17. Antes de gravar, confira na tela: se algum número estiver diferente, vale o da tela.

## 1. Roteiro

| Tempo | Fala (palavra por palavra) | Tela |
|---|---|---|
| 0:00–0:14 | "A cada 45 dias, o Copom publica uma ata longa e técnica. Quem está em banco, gestora ou investe precisa saber rápido: o Banco Central ficou mais duro ou mais brando? O CopomAI responde." | **Site, aba 1**, capa parada no topo (manchete e cartão de Destaques). Não mexa o mouse. |
| 0:14–0:25 | "Na capa, a resposta: para 9 de dezembro, previsão de manutenção da Selic. E a ata 281, a mais recente, veio menos dura que a anterior." | **Site**, capa. Passe o mouse devagar sobre o cartão **Previsão** (manutenção, 09/12, 84%) e depois sobre a linha fina da manchete ("tom menos duro"). |
| 0:25–0:39 | "Abaixo, o Claude explica o que mudou e o efeito provável em juros, câmbio e inflação. Clico numa citação: parágrafo e trecho exato da ata, com link para o PDF oficial." | **Site**, role até **Relatório** (`#relatorio`). Em "O que mudou na comunicação do Copom", clique na **primeira marca §** (ata 281, § 5, PIB do 2º trimestre). Deixe o trecho aberto por 2 segundos. Não abra o PDF. |
| 0:39–0:54 | "São 46 atas desde 2021. Cada parágrafo ganha nota de menos 2, muito brando, a mais 2, muito duro, com o trecho que justifica. A média vira o índice de tom, ao lado da Selic." | **Site**, role até **O tom das atas e a Selic** (`#tom`). Mostre o termômetro da ata 281 e passe o mouse pelo gráfico da esquerda para a direita, parando nos últimos pontos. |
| 0:54–1:02 | "E dá para perguntar às atas: inflação de serviços. Vêm os trechos, com ata e parágrafo." | **Site**, role até **Ferramentas → Pergunte às atas** (`#perguntar`). Digite *inflação de serviços* enquanto fala e mostre os 2 ou 3 primeiros resultados. |
| 1:02–1:33 | "Como conferimos? Testamos cada método contra o que o Copom decidiu nas 45 reuniões seguintes. O tom sozinho acertou só 40%: o Copom quase sempre fala preocupado com inflação. Repetir a última decisão acertou 84%. Então publicamos esse método, e o tom explica o que mudou. O painel também confere a Selic com a tabela oficial e cada citação com o texto da ata: o código pegou uma que não era cópia exata." | **Painel, aba 2**, já logado. (a) **Modelos**: comparação dos métodos (84%, 64%, 40%) e matriz de confusão, enquanto fala dos 40% e 84%. (b) **Validação**: cartão **Conferência da Selic**, "sem divergências". (c) **Dados**: cartão **trechos inválidos = 1**, com o selo "citação que não é cópia exata da ata". |
| 1:33–1:50 | "Serve para analistas, gestoras e investidores. Código e dados estão abertos no GitHub. Quando sai ata nova, o fluxo roda sozinho. Com mais um dia, incluiríamos o modelo do nosso colega na comparação. Isto não é recomendação de investimento." | **Painel → Automação** (Fluxo automático) por 3 segundos. Depois volte à **aba 1 (site)**, na capa, e pare ali até o fim. |

**Frase da automação.** Só diga "Quando sai ata nova, o fluxo roda sozinho" se, em **Painel → Automação**, o **Token do Claude** aparecer como **presente** e houver uma execução recente com sucesso. Em 06/11, às 14:17, os dados indicavam token **ausente** (`token_no_ambiente: false`). Nesse caso, troque por:
> "Próximo passo: deixar a atualização automática rodando de ponta a ponta."

E, na tela, em vez de Automação, mostre por 3 segundos o repositório no GitHub ou fique no site.

**Modelo do colega.** No painel, ele aparece como **não disponível**. Por isso a fala trata o modelo só como próximo passo. Não mostre o cartão "Modelo do parceiro" como se funcionasse.

**Se estourar o tempo**, corte nesta ordem: "com link para o PDF oficial" (5 palavras), "Código e dados estão abertos no GitHub." (7) e "A média vira o índice de tom, ao lado da Selic" (11).

## 2. Checagem antes de gravar

**Abas** (só duas, em uma janela do Chrome ou do Edge, sem outras abas e com a barra de favoritos oculta: Ctrl+Shift+B):
1. https://tradutor-copom.vercel.app, no topo da capa.
2. https://tradutor-copom.vercel.app/painel, **já logado** e na seção Modelos. A tela de senha nunca deve aparecer no vídeo.

**Janela:** maximizada, zoom de 110% a 125% (Ctrl + / Ctrl -), igual nas duas abas. Teste se o gráfico e a matriz cabem inteiros. Feche as notificações do Windows (modo Não incomodar), o Slack, o WhatsApp e o e-mail.

**Deixe pronto:**
- A caixa "Pergunte às atas" vazia. Faça uma busca de teste antes e apague.
- Nenhuma citação aberta no relatório. Recarregue a aba 1 (F5) e volte ao topo.
- Feche a seção de Evidência, se tiver aberto alguma.

**Números para conferir na tela** (risque cada um):
- [ ] Capa: previsão **manutenção**, reunião **09/12/2026**, método com **84%**, ata **281**, tom "menos duro" (variação de **0,28** para baixo).
- [ ] Relatório: a primeira citação abre ata **281, § 5**.
- [ ] Gráfico: **46 reuniões**, de jan/2021 a set/2026.
- [ ] "Quanto cada método acertou": ingênua **84%**, variação do tom **64%**, nível do tom **40%**, "acerto em **45** reuniões".
- [ ] Painel → Dados: **46** atas, **1.060** parágrafos, trechos inválidos = **1**. Se aparecer 0, troque o fim da fala por "e todas as citações conferem".
- [ ] Painel → Validação: Conferência da Selic **sem divergências** (46 comparadas).
- [ ] Painel → Automação: Token do Claude presente ou ausente (define a frase da automação).
- [ ] Busca "inflação de serviços" devolve resultados.

## 3. Dicas para gravar em uma tomada

**Gravar**
- Use a **Ferramenta de Captura** (Win+Shift+R ou Iniciar → Ferramenta de Captura → ícone de câmera). Selecione só a área da janela do navegador, ligue o **microfone** no botão da barra e clique em Iniciar. Ela salva em MP4.
- Opção: Xbox Game Bar (Win+Alt+R). Ela grava só a janela ativa, o que funciona aqui porque as duas abas ficam na mesma janela. Ligue o microfone no widget Captura antes.
- Faça um teste de 10 segundos, ouça o áudio e confira o volume. Use fone com microfone ou fale perto do notebook, em sala silenciosa.
- Leia o roteiro duas vezes em voz alta com cronômetro antes. Se passar de 1:50, aplique os cortes acima.
- Deixe o roteiro impresso ou em outro monitor, nunca na área gravada.
- Mova o mouse devagar e role com a roda em passos curtos. Pause meio segundo depois de cada clique antes de falar do resultado.
- Errou uma palavra? Siga em frente. Errou uma tela? Pare e recomece do zero: o vídeo é curto.

**Subir no YouTube**
1. studio.youtube.com → **Criar** → **Enviar vídeos** → escolha o MP4.
2. Título sugerido: "CopomAI: Tradutor do Copom (Claude Lab PUC-Rio, Case 2)". Na descrição, ponha os links do site e do GitHub e o aviso "Não é recomendação de investimento".
3. Marque "Não, não é conteúdo para crianças".
4. Em **Visibilidade**, escolha **Não listado** e clique em Salvar.
5. Espere terminar o processamento em HD. Abra o link numa janela anônima e assista até o fim para conferir o áudio e a duração (menos de 2:00).
