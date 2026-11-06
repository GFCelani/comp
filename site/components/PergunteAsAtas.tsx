"use client";

import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { dataCurta } from "@/lib/formato";
import { SimboloCopomAI } from "@/components/Logo";

/** Formato de cada item devolvido por GET /api/busca (lib/busca.ts). A API não muda. */
type Resultado = {
  ata: number;
  data_reuniao: string;
  paragrafo: number;
  texto: string;
  url_pdf: string;
  score: number;
};

const SUGESTOES = ["inflação de serviços", "mercado de trabalho", "expectativas desancoradas", "câmbio"];

// Mesmas palavras que a busca ignora no servidor (lib/busca.ts), para não destacar o que não contou.
const IGNORADAS = new Set(
  `a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre
   e ou mas que se nao ao aos e esta estao este estes estas isso isto aquele aquela aquilo ele ela eles elas eu tu nos vos
   seu sua seus suas meu minha dele dela deles delas lhe lhes me te
   como quando onde qual quais quem quanto quanta porque pois
   ja ainda tambem muito muita muitos muitas mais menos tao bem mal
   ha tem tinha ter sido sendo foram eram sera seriam
   disse diz dizem falou fala falam acerca respeito
   copom comite ata atas exemplo`
    .split(/\s+/)
    .filter(Boolean),
);

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function termosDa(pergunta: string): Set<string> {
  return new Set(
    normalizar(pergunta)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !IGNORADAS.has(t)),
  );
}

function destacar(texto: string, termos: Set<string>): ReactNode[] {
  if (termos.size === 0) return [texto];
  return texto.split(/([\p{L}\p{N}]+)/u).map((pedaco, i) =>
    i % 2 === 1 && termos.has(normalizar(pedaco)) ? (
      <mark key={i} className="rounded-[3px] bg-acento-suave px-[0.1em] text-tinta">
        {pedaco}
      </mark>
    ) : (
      <Fragment key={i}>{pedaco}</Fragment>
    ),
  );
}

type Mensagem =
  | { id: number; de: "usuario"; texto: string; ata: string }
  | { id: number; de: "copom"; estado: "carregando" }
  | { id: number; de: "copom"; estado: "erro" }
  | { id: number; de: "copom"; estado: "pronto"; q: string; resultados: Resultado[] };

function Citacao({ r, termos }: { r: Resultado; termos: Set<string> }) {
  return (
    <li className="rounded-[12px] border border-linha bg-papel px-4 py-3">
      <p className="text-xs text-tinta-3 num">
        Ata {r.ata} · {dataCurta(r.data_reuniao)} · §{r.paragrafo}
      </p>
      <p className="mt-1.5 font-serif text-[0.9875rem] leading-[1.55] text-tinta">“{destacar(r.texto, termos)}”</p>
      <a href={r.url_pdf} target="_blank" rel="noopener noreferrer" className="link mt-1.5 inline-block text-[0.8125rem]">
        abrir a ata em PDF
      </a>
    </li>
  );
}

function Resposta({ m }: { m: Extract<Mensagem, { de: "copom" }> }) {
  const [todos, setTodos] = useState(false);
  let corpo: ReactNode;
  if (m.estado === "carregando") {
    corpo = (
      <span className="digitando inline-flex items-center gap-1 py-2" role="status" aria-label="Buscando nas atas">
        <span />
        <span />
        <span />
      </span>
    );
  } else if (m.estado === "erro") {
    corpo = <p className="text-[0.9375rem] text-tinta-2">A busca não respondeu agora. Tente de novo em instantes.</p>;
  } else if (m.resultados.length === 0) {
    corpo = (
      <p className="text-[0.9375rem] text-tinta-2">
        Não encontrei trechos com essas palavras. Tente termos que aparecem nas atas, como “inflação”, “atividade” ou
        “expectativas”, ou busque em todas as atas.
      </p>
    );
  } else {
    const termos = termosDa(m.q);
    const visiveis = todos ? m.resultados : m.resultados.slice(0, 3);
    corpo = (
      <>
        <p className="text-[0.9375rem] text-tinta">Encontrei estes trechos nas atas:</p>
        <ul className="mt-2.5 grid gap-2">
          {visiveis.map((r) => (
            <Citacao key={`${r.ata}-${r.paragrafo}`} r={r} termos={termos} />
          ))}
        </ul>
        {!todos && m.resultados.length > 3 && (
          <button type="button" onClick={() => setTodos(true)} className="link mt-2 text-[0.8125rem] cursor-pointer">
            ver mais trechos ({m.resultados.length - 3})
          </button>
        )}
      </>
    );
  }
  return (
    <div className="flex gap-3 items-start">
      <SimboloCopomAI className="h-7 w-7 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">{corpo}</div>
    </div>
  );
}

export function PergunteAsAtas({
  atas,
  sugestoes = SUGESTOES,
}: {
  atas: { numero: number; data_reuniao: string }[];
  sugestoes?: string[];
}) {
  const base = useId();
  const campoId = `${base}-msg`;
  const ataId = `${base}-ata`;
  const [texto, setTexto] = useState("");
  const [ata, setAta] = useState("");
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const seq = useRef(0);
  const rolagem = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function perguntar(q: string) {
    const pergunta = q.trim();
    if (!pergunta || ocupado) return;
    const idU = ++seq.current;
    const idR = ++seq.current;
    setMsgs((m) => [...m, { id: idU, de: "usuario", texto: pergunta, ata }, { id: idR, de: "copom", estado: "carregando" }]);
    setTexto("");
    setOcupado(true);
    // indicador de digitação por pelo menos meio segundo
    const meioSegundo = new Promise((ok) => setTimeout(ok, 500));
    let nova: Mensagem;
    try {
      const params = new URLSearchParams({ q: pergunta });
      if (ata) params.set("ata", ata);
      const r = await fetch(`/api/busca?${params}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { resultados?: Resultado[] };
      nova = { id: idR, de: "copom", estado: "pronto", q: pergunta, resultados: j.resultados ?? [] };
    } catch {
      nova = { id: idR, de: "copom", estado: "erro" };
    }
    await meioSegundo;
    setMsgs((m) => m.map((x) => (x.id === idR ? nova : x)));
    setOcupado(false);
    campo.current?.focus();
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    perguntar(texto);
  }

  function tecla(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      perguntar(texto);
    }
  }

  const vazio = msgs.length === 0;
  const ataRotulo = ata ? `ata ${ata}` : "todas as atas";

  return (
    <div>
      <div className="relative flex h-[min(520px,78svh)] flex-col overflow-hidden rounded-[18px] border border-linha bg-papel shadow-[var(--sombra-2)]">
        {!vazio && (
          <button
            type="button"
            onClick={() => setMsgs([])}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-linha bg-papel/90 px-3 py-1 text-xs text-tinta-2 backdrop-blur hover:text-tinta hover:border-linha-2"
          >
            <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            nova conversa
          </button>
        )}

        <div ref={rolagem} className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 pt-5 pb-4" aria-live="polite">
          {vazio ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <SimboloCopomAI className="h-10 w-10" />
              <p className="titulo-serifa mt-4 text-[1.375rem] leading-tight">Pergunte qualquer coisa sobre as atas do Copom</p>
              <div className="mt-6 grid w-full max-w-[520px] gap-2 sm:grid-cols-2">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => perguntar(s)}
                    className="rounded-[12px] border border-linha bg-papel px-4 py-2.5 text-left text-sm text-tinta-2 transition-colors hover:border-linha-2 hover:bg-papel-2 hover:text-tinta cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="grid gap-5">
              {msgs.map((m) =>
                m.de === "usuario" ? (
                  <li key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-[16px] rounded-br-[6px] bg-papel-3 px-4 py-2.5 text-[0.9375rem] text-tinta">
                      {m.texto}
                      {m.ata && <span className="ml-2 text-xs text-tinta-3 num">· ata {m.ata}</span>}
                    </div>
                  </li>
                ) : (
                  <li key={m.id}>
                    <Resposta m={m} />
                  </li>
                ),
              )}
            </ol>
          )}
        </div>

        <form onSubmit={enviar} role="search" className="border-t border-linha bg-papel px-3 py-3 sm:px-4">
          <div className="flex items-end gap-2 rounded-[16px] border border-linha-2 bg-papel px-3 py-2 focus-within:border-acento focus-within:shadow-[0_0_0_3px_var(--acento-suave)]">
            <label htmlFor={campoId} className="sr-only">
              Sua pergunta
            </label>
            <textarea
              ref={campo}
              id={campoId}
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={tecla}
              maxLength={300}
              placeholder="Pergunte às atas…"
              className="min-h-[36px] max-h-28 flex-1 resize-none bg-transparent py-1.5 text-base text-tinta outline-none placeholder:text-tinta-3 [field-sizing:content]"
            />
            <label htmlFor={ataId} className="sr-only">
              Onde buscar
            </label>
            <span className="relative mb-0.5 shrink-0">
              <select
                id={ataId}
                value={ata}
                onChange={(e) => setAta(e.target.value)}
                className="h-8 max-w-[8.5rem] cursor-pointer appearance-none truncate rounded-full border border-linha bg-papel-2 pl-3 pr-7 text-xs text-tinta-2 hover:border-linha-2 focus:outline-none focus-visible:border-acento"
                title={ataRotulo}
              >
                <option value="">todas as atas</option>
                {[...atas].reverse().map((a) => (
                  <option key={a.numero} value={a.numero}>
                    ata {a.numero} · {dataCurta(a.data_reuniao)}
                  </option>
                ))}
              </select>
              <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta-3">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            <button
              type="submit"
              disabled={!texto.trim() || ocupado}
              aria-label="Enviar pergunta"
              className="mb-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-acento text-papel transition-colors hover:bg-acento-2 disabled:cursor-not-allowed disabled:bg-linha-2"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </div>
      <p className="mt-3 text-xs text-tinta-3">As respostas são trechos exatos das atas, não interpretação.</p>
    </div>
  );
}
