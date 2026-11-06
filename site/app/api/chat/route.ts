import { NextResponse, type NextRequest } from "next/server";
import { buscar, buscarCompletos, tokenizar, type Resultado } from "@/lib/busca";
import faq from "@/data/faq.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat {pergunta, ata?} → uma resposta única com citações.
 * - Com ANTHROPIC_API_KEY (só no servidor): Claude Haiku responde só com os 8 parágrafos
 *   mais relevantes; toda ata e parágrafo citados são conferidos aqui antes de sair.
 * - Sem chave: resposta pronta de data/faq.json (gerada uma vez e conferida por código)
 *   para perguntas parecidas; senão, o trecho mais relevante da busca.
 */

type Citacao = { id: string; ata: number; paragrafo: number; trecho: string; url_pdf: string; data_reuniao: string };
type ItemFaq = { id: string; pergunta: string; variantes?: string[]; resposta: string; citacoes: Citacao[] };
type Resposta = {
  modo: "ia" | "faq" | "busca" | "vazio" | "fora";
  resposta: string;
  citacoes: Citacao[];
  fontes: Resultado[];
};

const MAX_PERGUNTA = 300;
const JANELA_MS = 10 * 60 * 1000;
const LIMITE_IA = 10;
const tentativas = new Map<string, number[]>();

function ip(req: NextRequest): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

/** 10 perguntas por IP a cada 10 minutos (em memória, por instância). */
function permitido(chave: string): boolean {
  const agora = Date.now();
  const lista = (tentativas.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= LIMITE_IA) {
    tentativas.set(chave, lista);
    return false;
  }
  lista.push(agora);
  tentativas.set(chave, lista);
  if (tentativas.size > 5000) tentativas.clear();
  return true;
}

function palavras(texto: string, max = 25): string {
  const p = texto.split(/\s+/).filter(Boolean);
  return p.length <= max ? texto : `${p.slice(0, max).join(" ")}…`;
}

/* ---------- respostas prontas ---------- */

const itensFaq = ((faq as { itens?: ItemFaq[] }).itens ?? []).filter((i) => i.resposta && i.citacoes?.length);
const indiceFaq = itensFaq.map((item) => ({
  item,
  formas: [item.pergunta, ...(item.variantes ?? [])].map((f) => new Set(tokenizar(f))).filter((s) => s.size > 0),
}));

function respostaPronta(pergunta: string): ItemFaq | null {
  const q = new Set(tokenizar(pergunta));
  if (q.size === 0) return null;
  let melhor: { item: ItemFaq; nota: number } | null = null;
  for (const { item, formas } of indiceFaq) {
    for (const f of formas) {
      let inter = 0;
      for (const t of q) if (f.has(t)) inter++;
      const nota = inter / (q.size + f.size - inter);
      if (!melhor || nota > melhor.nota) melhor = { item, nota };
    }
  }
  return melhor && melhor.nota >= 0.6 ? melhor.item : null;
}

/* ---------- busca como resposta única ---------- */

/** O melhor trecho precisa conter pelo menos metade dos termos da pergunta. */
function cobre(pergunta: string, ata: number | null): boolean {
  const termos = [...new Set(tokenizar(pergunta))];
  const melhor = buscarCompletos(pergunta, ata, 1)[0];
  if (!melhor || !termos.length) return false;
  const doc = new Set(tokenizar(melhor.completo));
  const achados = termos.filter((t) => doc.has(t)).length;
  return achados >= Math.max(1, Math.ceil(termos.length / 2));
}

function respostaDaBusca(pergunta: string, ata: number | null): Resposta {
  const fontes = cobre(pergunta, ata) ? buscar(pergunta, ata, 5) : [];
  if (!fontes.length) {
    return {
      modo: "vazio",
      resposta:
        "As atas do Copom não tratam desse assunto. Tente perguntar sobre inflação, juros, atividade, câmbio ou expectativas, ou use outras palavras.",
      citacoes: [],
      fontes: [],
    };
  }
  const r = fontes[0];
  const data = r.data_reuniao.split("-").reverse().join("/");
  return {
    modo: "busca",
    resposta: `O trecho mais próximo da sua pergunta está na ata ${r.ata}, de ${data}: “${r.texto.replace(/^…|…$/g, "").trim()}” [[c1]].`,
    citacoes: [{ id: "c1", ata: r.ata, paragrafo: r.paragrafo, trecho: palavras(r.texto.replace(/^…/, "")), url_pdf: r.url_pdf, data_reuniao: r.data_reuniao }],
    fontes,
  };
}

/* ---------- modo com IA ---------- */

const SISTEMA = `Você responde perguntas sobre as atas do Copom (Banco Central do Brasil), em português do Brasil.
Regras:
- Responda em 2 a 4 frases curtas e claras, só com base nos trechos fornecidos.
- Termine cada frase com a fonte no formato [ata N §P], usando exatamente os números dos trechos.
- Não use conhecimento externo, não faça recomendação de investimento e não invente números.
- Se os trechos não respondem à pergunta, responda apenas: "As atas não tratam disso."`;

async function respostaComIA(pergunta: string, ata: number | null, chave: string): Promise<Resposta> {
  const trechos = buscarCompletos(pergunta, ata, 8);
  if (!trechos.length) return respostaDaBusca(pergunta, ata);
  const contexto = trechos.map((t) => `[ata ${t.ata} §${t.paragrafo}] (reunião de ${t.data_reuniao})\n${t.completo}`).join("\n\n");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 400,
      system: SISTEMA,
      messages: [{ role: "user", content: `Trechos das atas:\n\n${contexto}\n\nPergunta: ${pergunta}` }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const j = (await r.json()) as { content?: { type: string; text?: string }[] };
  const texto = (j.content ?? []).map((c) => c.text ?? "").join(" ").trim();

  if (/as atas não tratam disso/i.test(texto) && !/\[ata\s*\d+/i.test(texto)) {
    return { modo: "fora", resposta: "As atas não tratam disso.", citacoes: [], fontes: [] };
  }

  // confere cada frase: toda fonte citada tem de estar entre os trechos enviados
  const enviados = new Map(trechos.map((t) => [`${t.ata}.${t.paragrafo}`, t]));
  const citacoes: Citacao[] = [];
  const idDe = new Map<string, string>();
  const frases = texto.match(/[^.!?]+(?:\[[^\]]*\]\s*)*[.!?]?(?:\s*\[[^\]]*\])*/g) ?? [];
  const aprovadas: string[] = [];
  for (const frase of frases) {
    const marcas = [...frase.matchAll(/\[ata\s*(\d+)\s*§\s*(\d+)\]/gi)];
    if (!marcas.length) continue;
    if (!marcas.every((m) => enviados.has(`${m[1]}.${m[2]}`))) continue;
    let limpa = frase.replace(/\s*\[ata\s*\d+\s*§\s*\d+\]/gi, "").trim().replace(/[.!?]$/, "");
    const ids = marcas.map((m) => {
      const k = `${m[1]}.${m[2]}`;
      if (!idDe.has(k)) {
        const t = enviados.get(k)!;
        const id = `c${idDe.size + 1}`;
        idDe.set(k, id);
        citacoes.push({ id, ata: t.ata, paragrafo: t.paragrafo, trecho: palavras(t.texto.replace(/^…/, ""), 40), url_pdf: t.url_pdf, data_reuniao: t.data_reuniao });
      }
      return `[[${idDe.get(k)}]]`;
    });
    limpa = `${limpa} ${[...new Set(ids)].join("")}.`;
    aprovadas.push(limpa);
  }
  if (!aprovadas.length) return respostaDaBusca(pergunta, ata);
  return { modo: "ia", resposta: aprovadas.join(" "), citacoes, fontes: buscar(pergunta, ata, 5) };
}

export async function POST(req: NextRequest) {
  let corpo: { pergunta?: unknown; ata?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const pergunta = typeof corpo.pergunta === "string" ? corpo.pergunta.trim() : "";
  if (!pergunta) return NextResponse.json({ erro: "Escreva uma pergunta." }, { status: 400 });
  if (pergunta.length > MAX_PERGUNTA) {
    return NextResponse.json({ erro: `A pergunta pode ter até ${MAX_PERGUNTA} caracteres.` }, { status: 400 });
  }
  const ata = typeof corpo.ata === "number" || (typeof corpo.ata === "string" && /^\d+$/.test(corpo.ata)) ? Number(corpo.ata) : null;

  const chave = process.env.ANTHROPIC_API_KEY;
  if (chave) {
    if (!permitido(ip(req))) {
      return NextResponse.json({ erro: "Muitas perguntas seguidas. Espere alguns minutos e tente de novo." }, { status: 429 });
    }
    try {
      return NextResponse.json(await respostaComIA(pergunta, ata, chave));
    } catch (e) {
      console.error("[chat] IA indisponível, usando a busca:", e);
    }
  }

  if (!ata) {
    const item = respostaPronta(pergunta);
    if (item) {
      return NextResponse.json({ modo: "faq", resposta: item.resposta, citacoes: item.citacoes, fontes: buscar(pergunta, null, 5) } satisfies Resposta);
    }
  }
  return NextResponse.json(respostaDaBusca(pergunta, ata));
}
