import type { DadosSite } from "./dados";
import type { CamposNovos, Relatorio } from "./previsao";

/**
 * Edições de manchete e relatório, em funções puras (sem banco, sem "server-only"),
 * para serem testadas com `node lib/__testes__/edicoesTextos.test.mjs`.
 *
 * Campos e chaves:
 *  - "manchete.texto" / "manchete.linha_fina"  chave "<ata>"
 *  - "relatorio.paragrafo"                      chave "<ata>.<secao>.<i>" (secao ∈ mudou|efeito|observar, i base 0)
 * <ata> é a ata-base do relatório (relatorio.base_ata, senão previsao.base_ata, senão a última ata).
 * Quando o relatório é regenerado para outra ata, as edições antigas deixam de valer.
 */

export const SECOES_EDITAVEIS = ["mudou", "efeito", "observar"] as const;
export const LIMITE_MANCHETE = 300;
export const LIMITE_PARAGRAFO_MIN = 300;
export const LIMITE_PARAGRAFO_MAX = 1500;

/** Limite do parágrafo editado: 1,5 vez o original, entre 300 e 1500 caracteres. */
export function limiteParagrafo(tamanhoOriginal: number): number {
  return Math.min(LIMITE_PARAGRAFO_MAX, Math.max(LIMITE_PARAGRAFO_MIN, Math.round(tamanhoOriginal * 1.5)));
}

type EdicaoMinima = { campo: string; chave: string; valor_novo: string };
type ComCampos = DadosSite & CamposNovos & { relatorio?: (Relatorio & { base_ata?: number | null }) | null };

export type RevisadosTextos = { manchete: boolean; linhaFina: boolean; relatorioParagrafos: Set<string> };

/** Número da ata a que manchete e relatório se referem. */
export function ataDosTextos(d: DadosSite): number {
  const c = d as ComCampos;
  return c.relatorio?.base_ata ?? c.previsao?.base_ata ?? d.resumo.ultima_ata.numero;
}

/** Lê "<ata>.<secao>.<i>". Devolve null se a chave estiver malformada. */
export function lerChaveParagrafo(chave: string): { ata: number; secao: string; i: number } | null {
  const m = /^(\d+)\.([a-z_]+)\.(\d+)$/.exec(chave);
  if (!m) return null;
  return { ata: Number(m[1]), secao: m[2], i: Number(m[3]) };
}

export function marcadores(texto: string): string[] {
  return [...texto.matchAll(/\[\[([^\[\]]+)\]\]/g)].map((x) => x[1].trim());
}

/** Todo [[cN]] do texto novo tem de existir nas citações do parágrafo original; ao menos um marcador. */
export function validarParagrafo(
  texto: string,
  idsOriginais: string[],
  tamanhoOriginal = 0,
): { ok: true } | { ok: false; motivo: string } {
  const t = texto.trim();
  if (!t) return { ok: false, motivo: "O parágrafo não pode ficar vazio." };
  const limite = limiteParagrafo(tamanhoOriginal);
  if (t.length > limite) return { ok: false, motivo: `Parágrafo longo demais (máximo ${limite} caracteres, 1,5 vez o original).` };
  const usados = marcadores(t);
  if (usados.length === 0) {
    return {
      ok: false,
      motivo: `O parágrafo precisa de pelo menos um marcador de citação. Use os do original: ${idsOriginais.map((x) => `[[${x}]]`).join(", ") || "(nenhum)"}.`,
    };
  }
  const validos = new Set(idsOriginais);
  const inventados = [...new Set(usados.filter((u) => !validos.has(u)))];
  if (inventados.length > 0) {
    return {
      ok: false,
      motivo: `Citação que não existe neste parágrafo: ${inventados.map((x) => `[[${x}]]`).join(", ")}. Só valem as citações do original: ${idsOriginais.map((x) => `[[${x}]]`).join(", ") || "(nenhuma)"}. Não é possível criar citação nova pelo painel.`,
    };
  }
  return { ok: true };
}

/** Valida texto livre de manchete ou linha fina. */
export function validarManchete(texto: string): { ok: true } | { ok: false; motivo: string } {
  const t = texto.trim();
  if (!t) return { ok: false, motivo: "O texto não pode ficar vazio." };
  if (t.length > LIMITE_MANCHETE) return { ok: false, motivo: `Texto longo demais (máximo ${LIMITE_MANCHETE} caracteres).` };
  return { ok: true };
}

/** Parágrafo do relatório apontado pela chave, se ela for da ata atual. */
export function paragrafoDaChave(d: DadosSite, chave: string) {
  const k = lerChaveParagrafo(chave);
  const rel = (d as ComCampos).relatorio;
  if (!k || !rel || k.ata !== ataDosTextos(d)) return null;
  if (!(SECOES_EDITAVEIS as readonly string[]).includes(k.secao)) return null;
  return rel.secoes.find((s) => s.id === k.secao)?.paragrafos[k.i] ?? null;
}

/**
 * Aplica, sobre uma cópia já clonada `d`, as edições de manchete e relatório.
 * Espera a edição mais recente de cada campo+chave (como `estadoAtual()` devolve);
 * se vierem várias, vale a última da lista. Muda `d` no lugar.
 */
export function aplicarEdicoesTextos(d: DadosSite, edicoes: EdicaoMinima[]): RevisadosTextos {
  const r: RevisadosTextos = { manchete: false, linhaFina: false, relatorioParagrafos: new Set() };
  const c = d as ComCampos;
  const ata = ataDosTextos(d);

  for (const e of edicoes) {
    if (e.campo === "manchete.texto" || e.campo === "manchete.linha_fina") {
      if (Number(e.chave) !== ata || !c.manchete || !validarManchete(e.valor_novo).ok) continue;
      if (e.campo === "manchete.texto") {
        c.manchete.texto = e.valor_novo;
        r.manchete = true;
      } else {
        c.manchete.linha_fina = e.valor_novo;
        r.linhaFina = true;
      }
    } else if (e.campo === "relatorio.paragrafo") {
      const p = paragrafoDaChave(d, e.chave);
      if (!p) continue;
      if (!validarParagrafo(e.valor_novo, p.citacoes.map((x) => x.id)).ok) continue;
      p.texto = e.valor_novo;
      r.relatorioParagrafos.add(e.chave);
    }
  }
  return r;
}
