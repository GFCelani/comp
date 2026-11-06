# Site — guia rápido para desenvolver

Next.js 16 (App Router), TypeScript, Tailwind v4, Recharts. Produção: https://tradutor-copom.vercel.app (projeto Vercel `tradutor-copom`, raiz `site/`). Cada push na `main` publica sozinho.

## Rodar local

```bash
cd site
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # conferir antes de dar push
```

Sem variáveis de ambiente o site funciona inteiro com os JSON; só `/painel/editar` fica desativado. Para testar a edição: `npx vercel env pull .env.local` (nunca commitar).
`USAR_EXEMPLO_PREVISAO=1 pnpm dev` liga os dados de exemplo de `lib/previsao.ts` (aparece a faixa EXEMPLO).

## De onde vem cada dado

Tudo vem de `site/data/dados_site.json`, gerado por `pipeline/gerar_dados_site.py` no formato do `CONTRATO.md` (raiz). Não edite esse arquivo à mão: rode `python pipeline/rodar.py`.

| Na página | Campo de `dados_site.json` |
|---|---|
| Manchete e linha fina | `manchete.texto`, `manchete.linha_fina`, `manchete.origem` |
| Próxima reunião, previsão, última decisão sem ata | `previsao.proxima_reuniao`, `previsao.previsto`, `previsao.ultima_decisao_conhecida` |
| Quanto o sinal acertou × previsão ingênua | `previsao.acerto.indice`, `previsao.acerto.ingenua` |
| O que o Focus espera | `previsao.focus_selic` |
| Relatório com citações `[[cN]]` | `relatorio.secoes[].paragrafos[].texto` e `.citacoes[]` |
| Faixa do índice e gráfico | `resumo.ultima_ata.indice`, `serie[]` |
| Mudanças parágrafo a parágrafo (recolhido) | `mudancas[]`, `impacto` |
| Régua e agregação (recolhido) | `como_medimos` |
| Explorar as atas | `atas[]` (só trechos de até 25 palavras) |
| Pergunte às atas | rota `GET /api/busca?q=&ata=`, que lê `site/data/busca.json` só no servidor (parágrafos completos; nunca importar no cliente nem pôr em `public/`) |
| Rodapé: datas e última verificação | `datas_dados`, `ultima_verificacao`; a última verificação vem primeiro da API do GitHub Actions (`lib/verificacao.ts`) |
| Edições do time ("revisado pelo time") | Postgres via `lib/edicoes.ts` → `obterDados()`, aplicadas por cima do JSON; se o banco cair, vale o JSON |

A página deve ler os dados sempre por `obterDados()` (`lib/edicoes.ts`), que já devolve o JSON com as edições aplicadas, e por `camposNovos()` / `relatorioDeReserva()` (`lib/previsao.ts`), que tratam campos ausentes.

## Componentes

| Arquivo | O que é |
|---|---|
| `app/page.tsx` | página pública (manchete → relatório → faixa do índice → evidência recolhida → ferramentas → rodapé) |
| `components/Cabecalho.tsx` | cabeçalho com data e edição |
| `components/ParagrafoCitado.tsx` | parágrafo do relatório; transforma `[[cN]]` em marca "§N · ata X" que abre o trecho e o link do PDF |
| `components/Termometro.tsx` | régua −2 a +2 do índice |
| `components/GraficoIndice.tsx` | índice por reunião com Selic no eixo direito (`compacto` para a faixa) |
| `components/PergunteAsAtas.tsx` | busca (cliente; chama `/api/busca`) |
| `components/ExplorarAtas.tsx` | lista de atas e parágrafos com nota ≠ 0 |
| `components/Rodape.tsx` | fontes, datas, aviso, última verificação, link para `/painel` |
| `components/Matriz.tsx` | matriz de confusão (usada no `/painel`) |
| `lib/formato.ts` | formatação pt-BR de datas, %, índice, decisão |

## O que ainda é rascunho ou depende de algo

- **Índice do modelo do parceiro:** ainda não existe (`banco/indice_modelo.json`). Hoje `previsao.fonte_indice = "simples"`. Quando existir, o pipeline troca sozinho.
- **Métricas do modelo do parceiro e validação humana:** `metricas_modelo` e `validacao_humana` são `null`; o `/painel` mostra "aguardando".
- **Relatório:** gerado pelo Claude e verificado por código (`relatorio.origem = "claude"`). Se o Claude falhar, o pipeline publica a versão automática sem IA (`origem = "automatico"`), e a página mostra a etiqueta.
- **Edição (`/painel/editar`):** código pronto, desativado até `DATABASE_URL` e `ADMIN_PASSWORD` serem cadastradas na Vercel.
- **Ata 282:** reunião de 04/11 já decidida (Selic mantida em 13,75%), ata ainda não publicada; o workflow a incorpora sozinho quando sair.

## Divisão de trabalho

- Página pública e visual (`app/page.tsx`, `components/` da página pública, `app/globals.css`, `app/layout.tsx`): outra janela.
- `/painel/**`, `app/api/**`, `lib/**`, `data/**`, `public/**` e o pipeline: Claude Code desta janela.
- Pedidos de mudança na página pública para encaixar dados novos: em `site/PEDIDOS.md`.
