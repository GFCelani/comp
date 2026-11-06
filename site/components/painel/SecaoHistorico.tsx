"use client";

import { useEffect, useState } from "react";
import { useSecaoAtiva } from "./Aplicativo";
import css from "./painel.module.css";

type Edicao = {
  id: number;
  criado_em: string;
  campo: string;
  chave: string;
  valor_antigo: string | null;
  valor_novo: string;
  motivo: string | null;
};

type Estado = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "ok"; edicoes: Edicao[] };

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export const nomeCampo: Record<string, string> = {
  "mudanca.trecho": "trecho da mudança",
  "mudanca.explicacao": "explicação da mudança",
  "impacto.texto": "texto do impacto",
  nota: "nota do parágrafo",
  "config.fonte_indice": "fonte do índice",
};

function curto(s: string | null, n = 120) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

async function lerHistorico(): Promise<Estado> {
  try {
    const r = await fetch("/api/painel/edicoes", { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { edicoes?: Edicao[]; erro?: string };
    if (!r.ok) return { tipo: "erro", mensagem: j.erro ?? `O servidor respondeu ${r.status}.` };
    return { tipo: "ok", edicoes: j.edicoes ?? [] };
  } catch {
    return { tipo: "erro", mensagem: "Sem conexão com o servidor." };
  }
}

export function SecaoHistorico() {
  const ativa = useSecaoAtiva();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  // Busca ao abrir a seção (e de novo a cada vez que ela volta a abrir).
  useEffect(() => {
    if (ativa !== "historico") return;
    let vivo = true;
    lerHistorico().then((e) => {
      if (vivo) setEstado(e);
    });
    return () => {
      vivo = false;
    };
  }, [ativa]);

  async function atualizar() {
    setEstado({ tipo: "carregando" });
    setEstado(await lerHistorico());
  }

  return (
    <section className="cartao min-w-0 p-5 sm:p-6" aria-labelledby="hist-titulo">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="hist-titulo" className="text-[15px] font-semibold">
            Todas as edições do time
          </h3>
          <p className="mt-1 text-[13px] text-tinta-3">
            Cada edição guarda o valor antigo, o novo e o motivo. O JSON do pipeline não muda.
          </p>
        </div>
        <button type="button" className="botao" onClick={() => void atualizar()} disabled={estado.tipo === "carregando"}>
          atualizar
        </button>
      </header>

      <div aria-live="polite">
        {estado.tipo === "carregando" && <p className="text-sm text-tinta-3">carregando…</p>}
        {estado.tipo === "erro" && (
          <div className="rounded-[12px] bg-erro-suave px-4 py-3 text-sm text-erro" role="alert">
            Não foi possível carregar o histórico: {estado.mensagem}
          </div>
        )}
        {estado.tipo === "ok" && estado.edicoes.length === 0 && (
          <p className="rounded-[12px] border border-dashed border-linha-2 bg-papel-2 px-4 py-6 text-center text-sm text-tinta-2">
            Nenhuma edição ainda.
          </p>
        )}
        {estado.tipo === "ok" && estado.edicoes.length > 0 && (
          <div className="relative -mx-5 overflow-x-auto sm:-mx-6">
            <table className={`tabela min-w-[720px] ${css.compacta}`}>
              <thead>
                <tr>
                  <th scope="col">
                    quando
                  </th>
                  <th scope="col">campo</th>
                  <th scope="col">chave</th>
                  <th scope="col">antes → depois</th>
                  <th scope="col">
                    motivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {estado.edicoes.map((h) => (
                  <tr key={h.id}>
                    <td className="num whitespace-nowrap text-tinta-2">{fmtHora.format(new Date(h.criado_em))}</td>
                    <td className="whitespace-nowrap">{nomeCampo[h.campo] ?? h.campo}</td>
                    <td className="num whitespace-nowrap text-tinta-2">{h.chave}</td>
                    <td className="max-w-[420px] break-words">
                      <span className="text-tinta-3 line-through">{curto(h.valor_antigo)}</span>
                      <span className="text-tinta-3"> → </span>
                      <span>{curto(h.valor_novo)}</span>
                    </td>
                    <td className="text-tinta-2">{h.motivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
