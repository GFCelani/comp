import type { DadosSite, MetricasLado, Previsao } from "@/lib/dados";
import type { PrevisaoProxima } from "@/lib/previsao";
import { pct } from "@/lib/formato";

/** Tipos locais para os campos novos do contrato (escolha do método publicado). Leitura defensiva. */
export type MetodoNome = "ingenua" | "variacao_tom" | "nivel_tom" | "modelo_parceiro";
export const ORDEM: MetodoNome[] = ["ingenua", "variacao_tom", "nivel_tom", "modelo_parceiro"];

export const NOME_CURTO: Record<MetodoNome, string> = {
  ingenua: "Repetir a última decisão",
  variacao_tom: "Variação do tom",
  nivel_tom: "Nível do tom",
  modelo_parceiro: "Modelo do parceiro",
};

export const DESCRICAO: Record<MetodoNome, string> = {
  ingenua: "Aposta que o Copom repete a decisão que acabou de tomar. Não lê a ata.",
  variacao_tom: "Compara o índice da ata com o da ata anterior: subiu mais de 0,25 prevê alta, caiu mais de 0,25 prevê corte.",
  nivel_tom: "Usa o índice da ata: acima de +0,25 prevê alta, abaixo de −0,25 prevê corte, entre os dois manutenção.",
  modelo_parceiro: "Mesma regra do nível, aplicada ao índice calculado pelo modelo do parceiro.",
};

export type AtaAcerto = MetricasLado["atas"][number];

export type MetodoMetricas = {
  disponivel?: boolean;
  rotulo_pt?: string;
  acuracia_loo?: number | null;
  acerto_sinal?: number | null;
  n?: number | null;
  n_previsoes_direcionais?: number | null;
  matriz_confusao?: { rotulos: string[]; valores: number[][] } | null;
  atas?: AtaAcerto[] | null;
  motivo?: string | null;
};

export type MetodoPrevisao = {
  nome: string;
  rotulo_pt?: string;
  acuracia_loo?: number | null;
  acerto_sinal?: number | null;
  n?: number | null;
  previsto_proxima?: Previsao | null;
  disponivel?: boolean;
};

export type PrevisaoNova = PrevisaoProxima & {
  metodo_escolhido?: string | null;
  acuracia_escolhido?: number | null;
  previsto_nivel_tom?: Previsao | null;
  variacao_tom?: { delta?: number | null; ata?: number | null; ata_anterior?: number | null } | null;
  metodos?: MetodoPrevisao[] | null;
};

type MetricasNovas = { metodos?: Partial<Record<MetodoNome, MetodoMetricas>> | null; escolhido?: string | null };

/** Junta as métricas (metricas_previsao.metodos) com a previsão de cada método (previsao.metodos). */
export function lerMetodos(dados: DadosSite, previsao: PrevisaoProxima | null) {
  const mp = (dados.metricas_previsao ?? null) as (MetricasNovas & object) | null;
  const pv = (previsao ?? null) as PrevisaoNova | null;
  const metricas = mp?.metodos ?? {};
  const daPrev = new Map((pv?.metodos ?? []).map((m) => [m.nome, m]));
  const escolhido = (pv?.metodo_escolhido ?? mp?.escolhido ?? null) as MetodoNome | null;

  const lista = ORDEM.map((nome) => {
    const m = metricas[nome] ?? null;
    const p = daPrev.get(nome) ?? null;
    return {
      nome,
      rotulo: m?.rotulo_pt ?? p?.rotulo_pt ?? NOME_CURTO[nome],
      disponivel: Boolean(m?.disponivel ?? p?.disponivel),
      acuracia: m?.acuracia_loo ?? p?.acuracia_loo ?? null,
      acertoSinal: m?.acerto_sinal ?? p?.acerto_sinal ?? null,
      n: m?.n ?? p?.n ?? null,
      direcionais: m?.n_previsoes_direcionais ?? null,
      matriz: m?.matriz_confusao ?? null,
      atas: m?.atas ?? [],
      motivo: m?.motivo ?? null,
      proxima: p?.previsto_proxima ?? null,
      escolhido: nome === escolhido,
      temDados: m !== null || p !== null,
    };
  });
  const doEscolhido = lista.find((m) => m.escolhido) ?? null;
  return {
    lista,
    escolhido: doEscolhido,
    acuraciaEscolhido: pv?.acuracia_escolhido ?? doEscolhido?.acuracia ?? null,
    previsao: pv,
  };
}

export type Metodo = ReturnType<typeof lerMetodos>["lista"][number];

/** Frase honesta sobre o tom contra repetir a última decisão. Sem números além dos medidos. */
export function fraseTom(lista: Metodo[]): string | null {
  const acc = (n: MetodoNome) => lista.find((m) => m.nome === n && m.disponivel)?.acuracia ?? null;
  const ing = acc("ingenua");
  const vt = acc("variacao_tom");
  const nt = acc("nivel_tom");
  if (ing === null || (vt === null && nt === null)) return null;
  const tons = [vt, nt].filter((x): x is number => x !== null);
  if (tons.every((x) => x < ing)) {
    return `O tom ainda não bate repetir a última decisão: a ingênua acertou ${pct(ing)}${vt !== null ? `, a variação do tom ${pct(vt)}` : ""}${nt !== null ? ` e o nível do tom ${pct(nt)}` : ""}.`;
  }
  if (tons.some((x) => x > ing)) return "Ao menos um método baseado no tom acertou mais vezes do que repetir a última decisão.";
  return "O melhor método baseado no tom empatou com repetir a última decisão.";
}
