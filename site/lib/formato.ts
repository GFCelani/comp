import type { Decisao, Previsao } from "./dados";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const fmtNum2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtPct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function data(iso: string | null | undefined): string {
  if (!iso) return "aguardando";
  return fmtData.format(new Date(`${iso}T00:00:00Z`)).replace(/\./g, "");
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "aguardando";
  return fmtDataCurta.format(new Date(`${iso}T00:00:00Z`));
}

export function indice(v: number | null | undefined): string {
  if (v === null || v === undefined) return "aguardando";
  const s = fmtNum2.format(Math.abs(v));
  if (v > 0) return `+${s}`;
  if (v < 0) return `−${s}`;
  return s;
}

export function selic(v: number | null | undefined): string {
  if (v === null || v === undefined) return "aguardando";
  return `${fmtNum2.format(v)}%`;
}

export function pontos(pp: number | null | undefined): string {
  if (pp === null || pp === undefined) return "aguardando";
  if (pp === 0) return "sem mudança";
  const s = fmtNum2.format(Math.abs(pp));
  return `${pp > 0 ? "+" : "−"}${s} p.p.`;
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "aguardando";
  return fmtPct.format(v);
}

export function decisao(d: Decisao, pp?: number): string {
  if (d === "alta") return pp !== undefined ? `subiu ${pontos(pp)}` : "subiu";
  if (d === "corte") return pp !== undefined ? `cortou ${pontos(pp)}` : "cortou";
  return "manteve";
}

export const previsaoRotulo: Record<Previsao, string> = {
  afrouxamento: "corte",
  manutencao: "manutenção",
  aperto: "alta",
};

export function tomRotulo(v: number | null | undefined): string {
  if (v === null || v === undefined) return "sem leitura";
  if (v >= 1.25) return "muito duro";
  if (v > 0.25) return "duro";
  if (v >= -0.25) return "neutro";
  if (v > -1.25) return "brando";
  return "muito brando";
}
