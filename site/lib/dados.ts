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
  regra?: { aperto: string; afrouxamento: string; manutencao: string };
  fonte_indice?: string;
  gerado_em?: string;
  n_atas?: number;
  periodo?: { inicio: string; fim: string } | { inicio_ata: number; fim_ata: number; inicio: string; fim: string } | null;
  indice?: MetricasLado;
  ingenua?: MetricasLado;
  melhor?: "indice" | "ingenua" | "empate";
  escolhido?: string | null;
  criterio_escolha?: string | null;
  metodos?: Record<string, {
    acuracia_tempo?: number | null;
    acuracia_balanceada?: number | null;
    n_tempo?: number | null;
    viradas_tempo?: { acertos: number; total: number } | null;
    disponivel?: boolean;
  }>;
};

type Probs3 = { alta: number; manutencao: number; corte: number };

export type CandidatoModelo = {
  hiperparametros: string;
  acuracia: number;
  acuracia_balanceada: number;
  n: number;
  matriz_confusao: { rotulos: string[]; linhas: string; colunas: string; valores: number[][] };
  viradas: { acertos: number; total: number };
  previsoes_ata_a_ata: PrevisaoAtaModelo[];
};

export type PrevisaoAtaModelo = {
  ata: number;
  data_reuniao: string;
  previsto: string;
  realizado: string;
  acertou: boolean;
  probabilidades: Probs3;
};

export type MetricasModelo = {
  // campos antigos (modelo de notas), agora opcionais
  metodo?: string;
  n_paragrafos?: number;
  acuracia?: number;
  acuracia_1ponto?: number;
  erro_medio_abs?: number;
  validacao_leave_one_out?: {
    ata: number;
    acuracia: number;
    acuracia_1ponto: number;
    erro_medio_abs: number;
  }[];
  // modelo de nota de tom (modelo/treinar.py)
  gerado_em: string;
  tipo?: "logistica" | "floresta" | "arvore" | string;
  descricao?: string;
  hiperparametros?: string | Record<string, string>;
  variaveis?: { nome: string; descricao: string; importancia: number }[];
  coeficientes?: Record<string, Record<string, number>> | null;
  coeficientes_logistica?: Record<string, Record<string, number>>;
  regra_arvore_pt?: string;
  regra_arvore_texto?: string;
  metricas?: {
    acuracia: number;
    acuracia_balanceada: number;
    n: number;
    periodo: { inicio_ata: number; fim_ata: number; inicio: string; fim: string };
  };
  matriz_confusao?: Matriz<number> | { rotulos: string[]; linhas: string; colunas: string; valores: number[][] };
  viradas?: { acertos: number; total: number };
  previsoes_ata_a_ata?: PrevisaoAtaModelo[];
  previsao_atual?: {
    reuniao: number;
    data: string;
    ata_base?: number;
    observacao?: string;
    probabilidades: Probs3;
    previsto: string;
  };
  acuracia_previsao_decisao?: number;
  candidatos?: Record<string, CandidatoModelo>;
  criterio_escolha?: string;
  n_atas_treino?: number;
};

export type ChecagensAutomaticas = {
  trechos: { validos: number; invalidos: number; total: number };
  citacoes_relatorio: { verificadas: number; total: number; ok: boolean };
  portao_qualidade: { resultado: string | null; motivo: string | null; verificado_em: string | null } | null;
};

export type ValidacaoHumana = {
  n: number;
  concordancia_exata: number;
  concordancia_1ponto: number;
  itens?: { ata: number; paragrafo: number; nota_humana: number; nota_claude: number }[];
};

export type ConferenciaSelic = {
  verificado_em: string;
  fonte_url: string;
  n_comparadas: number;
  divergencias: Record<string, unknown>[];
};

export type DadosSite = {
  gerado_em: string;
  exemplo: boolean;
  ultima_verificacao?: string | null;
  textos_pendentes?: boolean;
  textos_origem?: string | null;
  mudancas_origem?: string | null;
  conferencia_selic?: ConferenciaSelic | null;
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
  impacto: { texto: string; data_selic: string; data_focus: string; origem?: string | null };
  atas: Ata[];
  como_medimos: { regua: string; agregacao: string; validacao: string };
  metricas_previsao: MetricasPrevisao | null;
  metricas_modelo: MetricasModelo | null;
  validacao_humana?: ValidacaoHumana | null;
  checagens_automaticas?: ChecagensAutomaticas | null;
  datas_dados: { selic: string; focus: string };
};

export const dados = bruto as unknown as DadosSite;
