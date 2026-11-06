# Pedidos para a página pública

Quando o pipeline ou o painel precisarem de uma mudança em `app/page.tsx`, `components/` da página pública ou nos estilos globais, o pedido entra aqui em vez de a mudança ser feita direto. Os dados chegam sempre no formato do `CONTRATO.md`.

Formato: data e hora · o que mudar · por quê · campo do `dados_site.json` envolvido · status (aberto / feito).

## Abertos

(nenhum)

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
