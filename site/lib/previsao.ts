import type { DadosSite, Previsao } from "./dados";

/**
 * Campos novos do dados_site.json (manchete, previsao, relatorio), gerados pelo pipeline.
 * Enquanto o pipeline não os gera, a página usa mudancas/impacto/metricas_previsao.
 *
 * EXEMPLO_PREVISAO só entra com USAR_EXEMPLO_PREVISAO=1 no servidor (teste local) e
 * liga a faixa EXEMPLO. Nunca é usado em produção sem essa variável.
 */

export type Citacao = {
  id: string;
  ata: number;
  paragrafo: number;
  trecho: string;
  url_pdf: string;
  data_reuniao?: string;
};

export type ParagrafoRelatorio = { texto: string; citacoes: Citacao[] };
export type SecaoRelatorio = { id: string; titulo: string; paragrafos: ParagrafoRelatorio[] };

export type Relatorio = {
  origem?: string | null;
  gerado_em?: string;
  secoes: SecaoRelatorio[];
};

export type Manchete = { texto: string; linha_fina?: string | null; origem?: string | null };

export type PrevisaoProxima = {
  base_ata: number;
  fonte_indice: string;
  indice: number | null;
  regra?: unknown;
  previsto: Previsao;
  proxima_reuniao?: { numero?: number | null; data?: string | null; fonte?: string | null } | null;
  ultima_decisao_conhecida?: {
    data: string;
    selic: number;
    decisao_pp: number;
    decisao: "alta" | "manutencao" | "corte";
    ata_publicada: boolean;
  } | null;
  acerto?: {
    indice?: { acuracia: number; acerto_sinal: number | null; n: number } | null;
    ingenua?: { acuracia: number; acerto_sinal: number | null; n: number; previsto?: Previsao } | null;
  } | null;
  focus_selic?: { mediana: number; ano_referencia: number; data: string } | null;
  // modelo de nota de tom (único método publicado)
  metodo_escolhido?: string | null;
  acuracia_escolhido?: number | null;
  probabilidades?: { alta: number; manutencao: number; corte: number } | null;
  texto_publico?: string | null;
  observacao?: string | null;
  metodos?: {
    nome: string;
    rotulo_pt?: string | null;
    acuracia_tempo?: number | null;
    acuracia_balanceada?: number | null;
    n_tempo?: number | null;
    n?: number | null;
    viradas_tempo?: { acertos: number; total: number } | null;
    probabilidades?: { alta: number; manutencao: number; corte: number } | null;
    previsto_proxima?: Previsao | null;
    disponivel: boolean;
  }[];
};

export type CamposNovos = {
  manchete?: Manchete | null;
  previsao?: PrevisaoProxima | null;
  relatorio?: Relatorio | null;
};

const PDF_281 = "https://www.bcb.gov.br/content/copom/atascopom/Copom281-not20260916281.pdf";

export const EXEMPLO_PREVISAO: Required<CamposNovos> = {
  manchete: {
    texto: "[exemplo] Copom deve cortar a Selic de novo na próxima reunião",
    linha_fina: "[exemplo] A ata mais recente manteve a porta aberta para cortes graduais, com cautela sobre preços ao produtor.",
    origem: "automatico",
  },
  previsao: {
    base_ata: 281,
    fonte_indice: "simples",
    indice: -0.3,
    previsto: "afrouxamento",
    proxima_reuniao: { numero: 282, data: "2026-11-04", fonte: "calendário do BC (exemplo)" },
    ultima_decisao_conhecida: { data: "2026-11-04", selic: 13.5, decisao_pp: -0.25, decisao: "corte", ata_publicada: false },
    acerto: {
      indice: { acuracia: 0.4, acerto_sinal: 0.43, n: 45 },
      ingenua: { acuracia: 0.84, acerto_sinal: 0.9, n: 45, previsto: "afrouxamento" },
    },
    focus_selic: { mediana: 13.25, ano_referencia: 2026, data: "2026-10-30" },
  },
  relatorio: {
    origem: "automatico",
    gerado_em: "2026-11-06T13:00:00",
    secoes: [
      {
        id: "comunicacao",
        titulo: "O que mudou na comunicação do Copom",
        paragrafos: [
          {
            texto:
              "[exemplo] O Copom registrou que a inflação em 12 meses voltou para dentro do intervalo de tolerância [[c1]], mas chamou atenção para a aceleração dos preços ao produtor [[c2]].",
            citacoes: [
              { id: "c1", ata: 281, paragrafo: 9, trecho: "Pelas duas métricas, o índice acumulado em 12 meses situa-se abaixo do limite superior do intervalo de tolerância, porém ainda acima da meta.", url_pdf: PDF_281, data_reuniao: "2026-09-16" },
              { id: "c2", ata: 281, paragrafo: 9, trecho: "nas divulgações mais recentes as variações de preços aos produtores aceleraram, tanto em bens intermediários quanto em bens de consumo.", url_pdf: PDF_281, data_reuniao: "2026-09-16" },
            ],
          },
        ],
      },
      {
        id: "mercado",
        titulo: "O efeito provável no mercado",
        paragrafos: [
          {
            texto:
              "[exemplo] Com a atividade desacelerando nos setores mais sensíveis a juros [[c3]], a leitura favorece a continuidade dos cortes, sem aceleração do ritmo.",
            citacoes: [
              { id: "c3", ata: 281, paragrafo: 5, trecho: "revelou que o movimento foi mais intenso nas atividades econômicas e nos componentes da demanda mais sensíveis ao ciclo econômico.", url_pdf: PDF_281, data_reuniao: "2026-09-16" },
            ],
          },
        ],
      },
      {
        id: "observar",
        titulo: "O que observar até a próxima reunião",
        paragrafos: [
          {
            texto: "[exemplo] As expectativas do Focus seguem acima da meta [[c4]]; uma nova alta nelas pode levar o Copom a pausar.",
            citacoes: [
              { id: "c4", ata: 281, paragrafo: 3, trecho: "As expectativas de inflação para 2026 e 2027 apuradas pela pesquisa Focus permanecem em valores acima da meta, situando-se em 4,9% e 4,3%, respectivamente.", url_pdf: PDF_281, data_reuniao: "2026-09-16" },
            ],
          },
        ],
      },
    ],
  },
};

export function camposNovos(d: DadosSite): { campos: CamposNovos; exemplo: boolean } {
  const bruto = d as DadosSite & CamposNovos;
  if (process.env.USAR_EXEMPLO_PREVISAO === "1") {
    return {
      campos: {
        manchete: bruto.manchete ?? EXEMPLO_PREVISAO.manchete,
        previsao: bruto.previsao ?? EXEMPLO_PREVISAO.previsao,
        relatorio: bruto.relatorio ?? EXEMPLO_PREVISAO.relatorio,
      },
      exemplo: !(bruto.manchete && bruto.previsao && bruto.relatorio),
    };
  }
  return {
    campos: { manchete: bruto.manchete ?? null, previsao: bruto.previsao ?? null, relatorio: bruto.relatorio ?? null },
    exemplo: false,
  };
}

/** Relatório montado a partir de mudancas/impacto quando o pipeline ainda não gera `relatorio`. */
export function relatorioDeReserva(d: DadosSite): Relatorio | null {
  const ata = d.resumo.ultima_ata;
  const secoes: SecaoRelatorio[] = [];
  if (d.mudancas.length) {
    secoes.push({
      id: "comunicacao",
      titulo: "O que mudou na comunicação do Copom",
      paragrafos: d.mudancas.map((m, i) => ({
        texto: `${m.explicacao} [[m${i}]]`,
        citacoes: [{ id: `m${i}`, ata: ata.numero, paragrafo: m.paragrafo, trecho: m.trecho, url_pdf: ata.url_pdf, data_reuniao: ata.data_reuniao }],
      })),
    });
  }
  if (d.impacto?.texto) {
    secoes.push({ id: "mercado", titulo: "O efeito provável no mercado", paragrafos: [{ texto: d.impacto.texto, citacoes: [] }] });
  }
  return secoes.length ? { origem: d.textos_origem ?? d.mudancas_origem ?? null, secoes } : null;
}
