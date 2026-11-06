# Pedidos para a página pública

Quando o pipeline ou o painel precisarem de uma mudança em `app/page.tsx`, `components/` da página pública ou nos estilos globais, o pedido entra aqui em vez de a mudança ser feita direto. Os dados chegam sempre no formato do `CONTRATO.md`.

Formato: data e hora · o que mudar · por quê · campo do `dados_site.json` envolvido · status (aberto / feito).

## Abertos

- 06/11 13h30 · **Pedido do visual para a API:** aceitar `manchete.texto`, `manchete.linha_fina` e `relatorio.paragrafo` (chave `<ata>.<secao>.<i>`) em `POST /api/painel/edicoes` e aplicá-los em `obterDados()` · a seção Textos do novo `/painel` precisa editar manchete e relatório; hoje só mostra os dois somente leitura com "aguardando rota na API" · campos `manchete`, `relatorio` · aberto

## Feitos

(nenhum)
