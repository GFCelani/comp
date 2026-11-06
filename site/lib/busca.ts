import "server-only";
import paragrafos from "@/data/busca.json";

type Paragrafo = {
  ata: number;
  data_reuniao: string;
  paragrafo: number;
  texto: string;
  url_pdf: string;
};

export type Resultado = {
  ata: number;
  data_reuniao: string;
  paragrafo: number;
  texto: string;
  url_pdf: string;
  score: number;
};

const STOPWORDS = new Set(
  `a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre
   e ou mas que se nao não ao aos à às a e é era foi são sao ser esta está estao estão
   este esta estes estas isso isto aquele aquela aquilo ele ela eles elas eu tu nos vos
   seu sua seus suas meu minha dele dela deles delas lhe lhes me te
   como quando onde qual quais quem quanto quanta o que porque porquê pois
   ja já ainda tambem também muito muita muitos muitas mais menos tao tão bem mal
   ha há tem têm tinha ter sido sendo foram eram sera será seriam
   disse diz dizem falou fala falam sobre acerca respeito
   copom comite comitê ata atas exemplo`
    .split(/\s+/)
    .filter(Boolean),
);

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function tokenizar(s: string): string[] {
  return normalizar(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

type Doc = { p: Paragrafo; termos: string[]; tf: Map<string, number> };

const K1 = 1.2;
const B = 0.75;

const docs: Doc[] = (paragrafos as Paragrafo[]).map((p) => {
  const termos = tokenizar(p.texto);
  const tf = new Map<string, number>();
  for (const t of termos) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { p, termos, tf };
});

const df = new Map<string, number>();
for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
const N = docs.length;
const avgdl = N ? docs.reduce((s, d) => s + d.termos.length, 0) / N : 1;

function idf(t: string): number {
  const n = df.get(t) ?? 0;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

function recorte(texto: string, termos: string[], max = 40): string {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (palavras.length <= max) return texto;
  const alvo = new Set(termos);
  let inicio = 0;
  for (let i = 0; i < palavras.length; i++) {
    const tok = tokenizar(palavras[i])[0];
    if (tok && alvo.has(tok)) {
      inicio = Math.max(0, i - 6);
      break;
    }
  }
  inicio = Math.min(inicio, palavras.length - max);
  const fim = inicio + max;
  const corpo = palavras.slice(inicio, fim).join(" ");
  return `${inicio > 0 ? "…" : ""}${corpo}…`;
}

/** Texto completo de um parágrafo, só no servidor (validação de trechos editados). */
export function textoDoParagrafo(ata: number, paragrafo: number): string | null {
  const p = (paragrafos as Paragrafo[]).find((x) => x.ata === ata && x.paragrafo === paragrafo);
  return p ? p.texto : null;
}

export function buscar(q: string, ata?: number | null, limite = 5): Resultado[] {
  const termos = Array.from(new Set(tokenizar(q)));
  if (termos.length === 0) return [];

  const pontuados: { d: Doc; score: number }[] = [];
  for (const d of docs) {
    if (ata && d.p.ata !== ata) continue;
    let score = 0;
    const dl = d.termos.length;
    for (const t of termos) {
      const f = d.tf.get(t);
      if (!f) continue;
      score += idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * dl) / avgdl)));
    }
    if (score > 0) pontuados.push({ d, score });
  }

  pontuados.sort((a, b) => b.score - a.score || b.d.p.ata - a.d.p.ata);
  return pontuados.slice(0, limite).map(({ d, score }) => ({
    ata: d.p.ata,
    data_reuniao: d.p.data_reuniao,
    paragrafo: d.p.paragrafo,
    texto: recorte(d.p.texto, termos),
    url_pdf: d.p.url_pdf,
    score: Math.round(score * 100) / 100,
  }));
}
