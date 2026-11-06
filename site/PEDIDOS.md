# Pedidos para a página pública

Quando o pipeline ou o painel precisarem de uma mudança em `app/page.tsx`, `components/` da página pública ou nos estilos globais, o pedido entra aqui em vez de a mudança ser feita direto. Os dados chegam sempre no formato do `CONTRATO.md`.

Formato: data e hora · o que mudar · por quê · campo do `dados_site.json` envolvido · status (aberto / feito).

## Abertos

- 06/11 14h20 · **Capa e /painel: previsão pelo método de maior acurácia.**
  - **Capa:** a manchete já vem coerente com o método escolhido. Ao lado, mostre o método (`previsao.metodos[nome == previsao.metodo_escolhido].rotulo_pt`) e a acurácia dele (`previsao.acuracia_escolhido`).
  - **/painel:** todos os métodos lado a lado (`previsao.metodos[]`), mostrando para cada um `rotulo_pt`, `acuracia_loo`, `acerto_sinal`, `n` e `previsto_proxima`. Marque o escolhido. Quando `disponivel == false`, mostre "aguardando modelo do parceiro". Se `nivel_tom` ou `variacao_tom` tiverem acurácia menor que `ingenua`, mostre a frase clara: "O índice de tom, sozinho, acertou menos do que repetir a última decisão." As matrizes 3×3 e a lista por ata de cada método estão em `metricas_previsao.metodos.<nome>`.
  - **Por quê:** credibilidade. O nível do tom acertou 40% e a previsão ingênua, 84%. A regra está em `DECISOES.md`.
  - **Campos:** `previsao.metodo_escolhido`, `previsao.acuracia_escolhido`, `previsao.metodos`, `previsao.previsto`, `previsao.variacao_tom`, `metricas_previsao.metodos`.
  - **Status:** aberto.
- 06/11 14h20 · **Selo "revisado pelo time" na manchete e no relatório.** Use `revisados.manchete`, `revisados.linhaFina` e `revisados.relatorioParagrafos` (chaves `<ata>.<secao>.<i>`), que vêm de `obterDados()`. Por quê: as edições do painel já são aplicadas, mas a página ainda não marca o que foi revisado. Status: aberto.

## Feitos

- 06/11 13h30 · **Pedido do visual para a API:** aceitar `manchete.texto`, `manchete.linha_fina` e `relatorio.paragrafo` (chave `<ata>.<secao>.<i>`) em `POST /api/painel/edicoes` e aplicá-los em `obterDados()` · a seção Textos do novo `/painel` precisa editar manchete e relatório; hoje só mostra os dois somente leitura com "aguardando rota na API" · campos `manchete`, `relatorio` · **feito 06/11 14h15**
  - Rota: `POST /api/painel/edicoes` (sessão do painel; 503 sem `DATABASE_URL` ou `ADMIN_PASSWORD`). Corpo JSON:
    - Manchete: `{"campo":"manchete.texto","valor":"<até 300 caracteres>","motivo":"<obrigatório>"}`. Chave gravada: `"<ata>"`.
    - Linha fina: `{"campo":"manchete.linha_fina","valor":"<até 300 caracteres>","motivo":"<obrigatório>"}`. Chave gravada: `"<ata>"`.
    - Parágrafo do relatório: `{"campo":"relatorio.paragrafo","chave":"281.mudou.0","valor":"Texto com [[c1]]…","motivo":"<obrigatório>"}`. `secao` ∈ `mudou`, `efeito`, `observar`; `i` começa em 0.
  - Respostas: `200 {"ok":true}`; `400 {"erro"}` (motivo ausente, chave malformada, "Nada mudou."); `422 {"erro"}` (texto vazio, longo demais, sem marcador `[[cN]]` ou com citação que não existe no parágrafo original); `409` se a chave for de outra ata; `404` se o parágrafo ou a manchete não existirem.
  - `GET /api/painel/edicoes` lista essas edições no mesmo histórico (`campo`, `chave`, `valor_antigo`, `valor_novo`, `motivo`).
  - `obterDados()` aplica a edição mais recente sobre `dados.manchete` e `dados.relatorio` (as citações nunca mudam). `revisados` ganhou campos opcionais: `manchete?: boolean` (texto), `linhaFina?: boolean` e `relatorioParagrafos?: Set<string>` (chaves `<ata>.<secao>.<i>`). Edição de outra ata não é aplicada.
  - A ata da chave é `relatorio.base_ata`, senão `previsao.base_ata`, senão `resumo.ultima_ata.numero` (`ataDosTextos()` em `lib/edicoesTextos.ts`).

## Modelo de nota de tom (06/11, ~14h55) — mudanças no JSON

- `previsao`: agora sempre o modelo (`metodo_escolhido` = "logistica"). Novos: `probabilidades {alta, manutencao, corte}`, `texto_publico`, `observacao`. `metodos` tem UMA entrada. Saíram `acerto`, `destaque_viradas`, `previsto_nivel_tom`, `variacao_tom`, `regra` (page.tsx usa `variacao_tom` com `?.`, então só some o trecho).
- `metricas_previsao`: só o modelo publicado (`escolhido`, `metodos.{logistica}`, `periodo` com `inicio_ata`/`fim_ata`).
- `metricas_modelo`: novo formato (`tipo`, `metricas`, `variaveis` como lista de objetos, `candidatos`, `previsoes_ata_a_ata`). Mantidos para o painel: `modelo_publicado`, `importancias`, `validacao_tempo.metodos`, `previsao_atual.por_modelo`. **Ajuste pedido:** `hiperparametros` agora é string (antes Record por modelo); `lerModelo` em components/painel/modelo.ts lê `mm.hiperparametros[nome]` e mostra "aguardando". Usar `typeof mm.hiperparametros === "string"`.
- `validacao_humana` saiu; entrou `checagens_automaticas {trechos, citacoes_relatorio, portao_qualidade}`.
- `pnpm exec tsc --noEmit` passou após ajustar só site/lib (dados.ts, previsao.ts).
