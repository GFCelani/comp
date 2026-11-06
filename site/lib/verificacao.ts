import "server-only";
import { dados } from "./dados";
import { dataHora } from "./formato";

const URL_RUNS =
  "https://api.github.com/repos/GFCelani/comp/actions/workflows/atualizar_atas.yml/runs?per_page=1&status=completed";

const fmtBrasilia = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Frase pronta com a última verificação automática. Nunca inventa data. */
export async function fraseUltimaVerificacao(): Promise<string> {
  try {
    const r = await fetch(URL_RUNS, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const j = (await r.json()) as { workflow_runs?: { updated_at?: string }[] };
      const em = j.workflow_runs?.[0]?.updated_at;
      const d = em ? new Date(em) : null;
      if (d && !Number.isNaN(d.getTime())) {
        return `Última verificação automática: ${fmtBrasilia.format(d)} (horário de Brasília).`;
      }
    }
  } catch {
    // cai para o JSON
  }
  const doJson = dataHora(dados.ultima_verificacao);
  return doJson ? `Última verificação automática: ${doJson}.` : "Verificação automática ainda não rodou.";
}
