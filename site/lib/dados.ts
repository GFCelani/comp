import bruto from "@/data/dados_site.json";

export type Decisao = "alta" | "manutencao" | "corte";
export type Efeito = "endureceu" | "suavizou";
export type Previsao = "afrouxamento" | "manutencao" | "aperto";

export type PontoSerie = {
  ata: number;
  data_reuniao: string;
  indice: number | null;
  selic_apos: number;
  decisao: Decisao;
  decisao_pp: number;
};

export type Mudanca = {
  paragrafo: number;
  trecho: string;
  efeito: Efeito;
  explicacao: string;
  tipo: "novo" | "alterado" | "removido";
};

export type ParagrafoAta = { paragrafo: number; nota: number; trecho: string };

export type Ata = {
  numero: number;
  data_reuniao: string;
  url_pdf: string;
  indice: number | null;
  n_paragrafos: number;
  n_nao_zero: number;
  paragrafos: ParagrafoAta[];
};

export type Matriz<R> = { rotulos: R[]; valores: number[][] };

export type MetricasLado = {
  acuracia: number;
  acerto_sinal: number | null;
  matriz_confusao: Matriz<Previsao>;
  atas: {
    ata: number;
    data_reuniao: string;
    indice?: number | null;
    previsto: Previsao;
    realizado: Previsao;
    variacao_pp?: number;
    acertou: boolean;
  }[];
};

export type MetricasPrevisao = {
  regra: { aperto: string; afrouxamento: string; manutencao: string };
  fonte_indice: string;
  gerado_em: string;
  n_atas: number;
  periodo: { inicio: string; fim: string };
  indice: MetricasLado;
  ingenua: MetricasLado;
  melhor: "indice" | "ingenua" | "empate";
};

export type MetricasModelo = {
  metodo: string;
  gerado_em: string;
  n_paragrafos: number;
  acuracia: number;
  acuracia_1ponto: number;
  erro_medio_abs: number;
  matriz_confusao: Matriz<number>;
  validacao_leave_one_out?: {
    ata: number;
    acuracia: number;
    acuracia_1ponto: number;
    erro_medio_abs: number;
  }[];
};

export type ValidacaoHumana = {
  n: number;
  concordancia_exata: number;
  concordancia_1ponto: number;
  itens?: { ata: number; paragrafo: number; nota_humana: number; nota_claude: number }[];
};

export type DadosSite = {
  gerado_em: string;
  exemplo: boolean;
  fonte_indice: "simples" | "modelo";
  resumo: {
    ultima_ata: {
      numero: number;
      data_reuniao: string;
      decisao: Decisao;
      decisao_pp: number;
      selic_apos: number;
      indice: number | null;
      url_pdf: string;
    };
    n_atas: number;
    n_paragrafos: number;
    n_trechos_invalidos: number;
    periodo: { inicio: string; fim: string };
  };
  serie: PontoSerie[];
  mudancas: Mudanca[];
  impacto: { texto: string; data_selic: string; data_focus: string };
  atas: Ata[];
  como_medimos: { regua: string; agregacao: string; validacao: string };
  metricas_previsao: MetricasPrevisao | null;
  metricas_modelo: MetricasModelo | null;
  validacao_humana: ValidacaoHumana | null;
  datas_dados: { selic: string; focus: string };
};

export const dados = bruto as unknown as DadosSite;
