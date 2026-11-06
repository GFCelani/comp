import type { DadosSite } from "@/lib/dados";

/**
 * Leitura defensiva do modelo único publicado (banco/metricas_modelo.json, ver CONTRATO.md).
 * nome = modelo_publicado ?? melhor_nao_ingenuo. Tudo que faltar volta como null (o painel mostra "aguardando").
 */

export type Classe = "alta" | "manutencao" | "corte";
export const CLASSES: Classe[] = ["alta", "manutencao", "corte"];
export const CLASSE_ROTULO: Record<string, string> = { alta: "alta", manutencao: "manutenção", corte: "corte" };

export type Probs = Partial<Record<Classe, number>>;

type PrevisaoAta = { ata: number; previsto: string; realizado: string; probabilidades?: Probs | null };

type MetodoTempo = {
  acuracia?: number | null;
  acuracia_balanceada?: number | null;
  matriz_confusao?: { rotulos?: string[]; linhas?: string; colunas?: string; valores?: number[][] } | null;
  viradas?: { acertos?: number; total?: number } | null;
  previsoes?: PrevisaoAta[] | null;
};

type MetricasModeloNovo = {
  modelo_publicado?: string | null;
  melhor_nao_ingenuo?: string | null;
  gerado_em?: string | null;
  n_atas?: number | null;
  variaveis?: string[] | null;
  hiperparametros?: Record<string, string> | null;
  validacao_tempo?: { inicio_ata?: number; fim_ata?: number; n?: number; metodos?: Record<string, MetodoTempo> } | null;
  validacao_loo?: { n?: number; metodos?: Record<string, MetodoTempo> } | null;
  coeficientes_logistica?: Record<string, Record<string, number>> | null;
  importancias?: { variavel: string; importancia: number }[] | null;
  importancias_floresta?: { variavel: string; importancia: number }[] | null;
  descricoes_variaveis?: Record<string, string> | null;
  regra_pt?: string | null;
  regra_arvore_pt?: string | null;
  previsao_atual?: {
    reuniao?: number | null;
    data?: string | null;
    linha_base?: { ata?: number; decisao_atual?: string } | null;
    por_modelo?: Record<string, Probs> | null;
  } | null;
};

export const TIPO_MODELO: Record<string, string> = {
  logistica: "regressão logística multinomial",
  floresta: "floresta aleatória",
  arvore: "árvore de decisão",
};

/** Descrições curtas e fiéis a modelo/variaveis.py (sem números). */
const DESCRICOES: Record<string, string> = {
  decisao_atual_alta: "A decisão da reunião atual foi alta (0 ou 1).",
  decisao_atual_manutencao: "A decisão da reunião atual foi manutenção (0 ou 1).",
  decisao_atual_corte: "A decisão da reunião atual foi corte (0 ou 1).",
  tom_nivel: "Índice de tom da ata (média das notas dos parágrafos).",
  tom_variacao: "Variação do índice de tom em relação à ata anterior.",
  tom_orientacao: "Nota média dos parágrafos da seção da decisão (orientação futura).",
  saldo_duro_brando: "Parágrafos duros menos parágrafos brandos, dividido pelo total de parágrafos.",
  sinais_virada: "Contagem de termos de virada de ciclo (pausa, interrupção, ritmo…) na seção da decisão.",
  distancia_focus: "Selic após a decisão menos a mediana do Focus para a Selic do fim do ano.",
  hiato_inflacao: "IPCA acumulado em 12 meses menos a meta de inflação do ano.",
};

export const NOME_VARIAVEL: Record<string, string> = {
  decisao_atual_alta: "decisão atual: alta",
  decisao_atual_manutencao: "decisão atual: manutenção",
  decisao_atual_corte: "decisão atual: corte",
  tom_nivel: "nível do tom",
  tom_variacao: "variação do tom",
  tom_orientacao: "tom da seção da decisão",
  saldo_duro_brando: "saldo duro − brando",
  sinais_virada: "sinais de virada",
  distancia_focus: "distância para o Focus",
  hiato_inflacao: "hiato da inflação",
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Classe de maior probabilidade, ou null. */
export function classePrevista(p: Probs | null | undefined): Classe | null {
  if (!p) return null;
  let melhor: Classe | null = null;
  for (const c of CLASSES) {
    const v = num(p[c]);
    if (v !== null && (melhor === null || v > (num(p[melhor]) ?? -1))) melhor = c;
  }
  return melhor;
}

function sinal(v: number | undefined, classe: string): string | null {
  if (v === undefined || v === 0) return null;
  return `${v > 0 ? "favorece" : "reduz"} ${CLASSE_ROTULO[classe]}`;
}

export function lerModelo(dados: DadosSite) {
  const mm = (dados.metricas_modelo ?? null) as unknown as MetricasModeloNovo | null;
  const nome = mm?.modelo_publicado ?? mm?.melhor_nao_ingenuo ?? null;
  const vt = mm?.validacao_tempo ?? null;
  const m = nome ? (vt?.metodos?.[nome] ?? null) : null;
  const loo = nome ? (mm?.validacao_loo?.metodos?.[nome] ?? null) : null;

  // Importância das variáveis
  let importancias: { variavel: string; valor: number }[] | null = null;
  let rotuloImportancia = "importância";
  const imp = mm?.importancias ?? (nome === "floresta" ? mm?.importancias_floresta : null) ?? null;
  const coef = mm?.coeficientes_logistica ?? null;
  if (imp && imp.length > 0) {
    importancias = imp.map((i) => ({ variavel: i.variavel, valor: i.importancia }));
  } else if (nome === "logistica" && coef) {
    const classes = Object.keys(coef);
    const vars = Array.from(new Set(classes.flatMap((c) => Object.keys(coef[c] ?? {}))));
    importancias = vars.map((v) => {
      const vals = classes.map((c) => num(coef[c]?.[v])).filter((x): x is number => x !== null);
      return { variavel: v, valor: vals.length ? vals.reduce((s, x) => s + Math.abs(x), 0) / vals.length : 0 };
    });
    rotuloImportancia = "peso médio (|coeficiente| padronizado)";
  }
  if (importancias) importancias = [...importancias].sort((a, b) => b.valor - a.valor);

  // Regra em português
  let regra: string | null = mm?.regra_pt ?? (nome === "arvore" ? (mm?.regra_arvore_pt ?? null) : null);
  if (!regra && nome === "logistica" && coef && importancias && importancias.length > 0) {
    const partes = importancias.slice(0, 3).map((i) => {
      const efeitos = [sinal(coef.alta?.[i.variavel], "alta"), sinal(coef.corte?.[i.variavel], "corte")].filter(Boolean);
      const nomeVar = NOME_VARIAVEL[i.variavel] ?? i.variavel;
      return efeitos.length ? `${nomeVar} (valor mais alto ${efeitos.join(" e ")})` : nomeVar;
    });
    regra = `As variáveis que mais pesam são ${partes.slice(0, -1).join(", ")}${partes.length > 1 ? " e " : ""}${partes[partes.length - 1]}.`;
  }

  const pa = mm?.previsao_atual ?? null;
  const probsAtual = nome ? (pa?.por_modelo?.[nome] ?? null) : null;

  return {
    existe: Boolean(mm && nome && m),
    nome,
    tipo: nome ? (TIPO_MODELO[nome] ?? nome) : null,
    hiperparametros: nome ? (mm?.hiperparametros?.[nome] ?? null) : null,
    acuracia: num(m?.acuracia),
    balanceada: num(m?.acuracia_balanceada),
    viradas: m?.viradas && num(m.viradas.acertos) !== null && num(m.viradas.total) !== null
      ? { acertos: m.viradas.acertos as number, total: m.viradas.total as number }
      : null,
    matriz: m?.matriz_confusao?.valores && m.matriz_confusao.rotulos ? m.matriz_confusao : null,
    previsoes: [...(m?.previsoes ?? [])].sort((a, b) => a.ata - b.ata),
    n: num(vt?.n),
    inicio: num(vt?.inicio_ata),
    fim: num(vt?.fim_ata),
    loo: loo ? { acuracia: num(loo.acuracia), n: num(mm?.validacao_loo?.n) } : null,
    importancias,
    rotuloImportancia,
    descricoes: { ...DESCRICOES, ...(mm?.descricoes_variaveis ?? {}) } as Record<string, string>,
    regra,
    atual: {
      reuniao: pa?.reuniao ?? null,
      data: pa?.data ?? null,
      probs: probsAtual,
      prevista: classePrevista(probsAtual),
    },
  };
}

export type Modelo = ReturnType<typeof lerModelo>;
