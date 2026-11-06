"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { Decisao, PontoSerie } from "@/lib/dados";
import {
  dataCurta,
  decisao as fmtDecisao,
  indice as fmtIndice,
  selic as fmtSelic,
  tomRotulo,
} from "@/lib/formato";

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const fmtEscala = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function mesAno(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${fmtMes.format(d).replace(".", "")} ${String(d.getUTCFullYear()).slice(2)}`;
}

function rotuloEscala(v: number): string {
  if (v === 0) return "neutro";
  const s = fmtEscala.format(Math.abs(v));
  return v > 0 ? `+${s}` : `−${s}`;
}

const ROTULO_VIRADA: Record<Decisao, string> = {
  alta: "início das altas",
  manutencao: "pausa",
  corte: "início dos cortes",
};

/** mudança de ciclo: começo de altas, começo de cortes ou pausa depois de um movimento */
function ehVirada(antes: Decisao, agora: Decisao): boolean {
  if (agora === "alta") return antes !== "alta";
  if (agora === "corte") return antes !== "corte";
  return antes === "alta" || antes === "corte";
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** largura aproximada de um texto de 12px em Geist (com folga) */
const larguraTexto = (t: string) => t.length * 6.6;

const LIMITE_CURTO = 520;
const REUNIOES_NO_CURTO = 16;
const TIP_W = 212;
const TIP_H = 104;

/** quente = duro (alta), frio = brando (corte); perto do neutro fica no acento */
const LIMIAR_COR = 0.25;
function corPonto(v: number): string {
  if (v > LIMIAR_COR) return "var(--duro-forte)";
  if (v < -LIMIAR_COR) return "var(--brando-forte)";
  return "var(--acento)";
}
function corTextoTom(v: number): string {
  if (v > LIMIAR_COR) return "var(--duro)";
  if (v < -LIMIAR_COR) return "var(--brando)";
  return "var(--acento)";
}
function classeTextoTom(v: number): string {
  if (v > 0) return "text-duro";
  if (v < 0) return "text-brando";
  return "text-tinta-2";
}
const COR_VIRADA: Record<Decisao, string> = {
  alta: "var(--duro)",
  corte: "var(--brando)",
  manutencao: "var(--tinta-2)",
};

const halo: CSSProperties = {
  paintOrder: "stroke",
  stroke: "var(--papel)",
  strokeWidth: 4,
  strokeLinejoin: "round",
};

type Virada = { i: number; x: number; rotulo: string; cor: string; esq: number; larg: number; linha: 0 | 1 };

function montar(dados: PontoSerie[], serie: PontoSerie[], W: number, H: number, curto: boolean) {
  const n = dados.length;
  const ML = curto ? 46 : 54;
  const MR = curto ? 50 : 54;
  const PAD = 6;
  const AH = 36; // faixa das anotações (duas linhas)
  const T1 = 26; // linha do título do painel de tom
  const G = 34; // espaço entre os painéis
  const XB = 26; // eixo x
  const tomTop = AH + T1;
  const util = Math.max(120, H - tomTop - G - XB);
  const hTom = Math.round(util * 0.62);
  const tomBot = tomTop + hTom;
  const selicTop = tomBot + G;
  const selicBot = H - XB;

  const x0 = ML + PAD;
  const x1 = W - MR - PAD;
  const passo = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const xs = dados.map((_, i) => (n > 1 ? x0 + i * passo : (x0 + x1) / 2));

  // escala do tom: ajustada aos dados, sempre com o 0 e dentro de −2..+2
  const vals = dados.map((p) => p.indice).filter((v): v is number => v !== null);
  const vMax = vals.length ? Math.max(...vals) : 0;
  const vMin = vals.length ? Math.min(...vals) : 0;
  const hi = clamp(Math.max(0.25, Math.ceil(vMax * 2) / 2), 0.25, 2);
  const lo = clamp(Math.min(-0.25, Math.floor(vMin * 2) / 2), -2, -0.25);
  const yT = (v: number) => tomBot - ((v - lo) / (hi - lo)) * hTom;
  let passoEscala = hi - lo <= 2 ? 0.5 : 1;
  const marcasDe = (p: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / p) * p; v <= hi + 1e-9; v += p) out.push(Math.round(v * 100) / 100);
    return out;
  };
  let marcas = marcasDe(passoEscala);
  if (marcas.length > 5) {
    passoEscala = 1;
    marcas = marcasDe(passoEscala);
  }

  // linha do tom: quebra onde não há leitura
  // e área entre a linha e o zero, um trecho por sequência contínua
  const y0 = yT(0);
  let caminhoTom = "";
  let areaTom = "";
  let aberto = false;
  let ultimoX = 0;
  const fecharArea = () => {
    if (aberto) areaTom += `L${ultimoX.toFixed(1)},${y0.toFixed(1)}Z`;
  };
  dados.forEach((p, i) => {
    if (p.indice === null) {
      fecharArea();
      aberto = false;
      return;
    }
    const px = xs[i].toFixed(1);
    const py = yT(p.indice).toFixed(1);
    caminhoTom += `${aberto ? "L" : "M"}${px},${py}`;
    areaTom += aberto ? `L${px},${py}` : `M${px},${y0.toFixed(1)}L${px},${py}`;
    ultimoX = xs[i];
    aberto = true;
  });
  fecharArea();
  let ultimoTom = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (dados[i].indice !== null) {
      ultimoTom = i;
      break;
    }
  }

  // Selic em degrau (vale da reunião até a próxima)
  const selics = dados.map((p) => p.selic_apos);
  const sMax = Math.max(...selics);
  const sMin = Math.min(...selics);
  const folga = Math.max(0.25, (sMax - sMin) * 0.14);
  const sHi = sMax + folga;
  const sLo = sMin - folga;
  const yS = (v: number) => selicBot - ((v - sLo) / (sHi - sLo)) * (selicBot - selicTop);
  let caminhoSelic = `M${xs[0].toFixed(1)},${yS(selics[0]).toFixed(1)}`;
  for (let i = 1; i < n; i++) caminhoSelic += `H${xs[i].toFixed(1)}V${yS(selics[i]).toFixed(1)}`;
  const areaSelic = `${caminhoSelic}V${selicBot}H${xs[0].toFixed(1)}Z`;
  // degraus de mudança: o salto e o patamar seguinte, quente na alta e frio no corte
  const degraus: { d: string; cor: string }[] = [];
  for (let i = 1; i < n; i++) {
    if (selics[i] === selics[i - 1]) continue;
    const fim = i + 1 < n ? `H${xs[i + 1].toFixed(1)}` : "";
    degraus.push({
      d: `M${xs[i].toFixed(1)},${yS(selics[i - 1]).toFixed(1)}V${yS(selics[i]).toFixed(1)}${fim}`,
      cor: selics[i] > selics[i - 1] ? "var(--duro-forte)" : "var(--brando-forte)",
    });
  }

  // viradas de ciclo, calculadas na série inteira (o primeiro ponto visível também tem anterior)
  const deslocamento = serie.length - n;
  let viradas: { i: number; rotulo: string; cor: string }[] = [];
  for (let i = 0; i < n; i++) {
    const j = deslocamento + i;
    if (j >= 1 && ehVirada(serie[j - 1].decisao, serie[j].decisao)) {
      viradas.push({ i, rotulo: ROTULO_VIRADA[serie[j].decisao], cor: COR_VIRADA[serie[j].decisao] });
    }
  }
  // fica com as mais espaçadas
  const maxViradas = curto ? 3 : 5;
  while (viradas.length > maxViradas) {
    let k = 0;
    let menor = Infinity;
    for (let a = 0; a < viradas.length - 1; a++) {
      const d = viradas[a + 1].i - viradas[a].i;
      if (d < menor) {
        menor = d;
        k = a;
      }
    }
    const gapAntes = k > 0 ? viradas[k].i - viradas[k - 1].i : Infinity;
    const gapDepois = k + 2 < viradas.length ? viradas[k + 2].i - viradas[k + 1].i : Infinity;
    // remove a do par que está mais apertada do outro lado; empate tira a mais antiga
    const remover = gapDepois < gapAntes ? k + 1 : k;
    viradas = viradas.filter((_, idx) => idx !== remover);
  }
  // duas alturas de rótulo; o que não couber é omitido
  const fimLinha = [-Infinity, -Infinity];
  const posicionadas: Virada[] = [];
  const xsViradas = viradas.map((v) => xs[v.i]);
  for (const v of viradas) {
    const x = xs[v.i];
    const larg = larguraTexto(v.rotulo) + 10;
    const esq = clamp(x - larg / 2, 0, W - larg);
    let linha: 0 | 1 | null = null;
    if (esq >= fimLinha[0] + 8) linha = 0;
    else if (
      esq >= fimLinha[1] + 8 &&
      !xsViradas.some((ox) => ox !== x && ox >= esq - 3 && ox <= esq + larg + 3)
    )
      linha = 1;
    if (linha === null) continue;
    fimLinha[linha] = esq + larg;
    posicionadas.push({ i: v.i, x, rotulo: v.rotulo, cor: v.cor, esq, larg, linha });
  }

  // eixo x: poucas datas, sempre a última
  const maxRotulos = Math.max(2, Math.floor((x1 - x0) / 60));
  const passoRotulo = Math.ceil(n / maxRotulos);
  const rotulosX = dados.map((_, i) => i).filter((i) => (n - 1 - i) % passoRotulo === 0);

  return {
    ML,
    MR,
    AH,
    tomTop,
    tomBot,
    selicTop,
    selicBot,
    x0,
    x1,
    passo,
    xs,
    yT,
    yS,
    marcas,
    y0,
    caminhoTom,
    areaTom,
    degraus,
    ultimoTom,
    caminhoSelic,
    areaSelic,
    viradas: posicionadas,
    rotulosX,
  };
}

export function GraficoTomSelic({ serie, altura = 360 }: { serie: PontoSerie[]; altura?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const idBase = useId().replace(/:/g, "");
  const clipAcima = `${idBase}-acima`;
  const clipAbaixo = `${idBase}-abaixo`;
  const [largura, setLargura] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null); // número da ata selecionada

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver((entradas) => {
      const w = Math.floor(entradas[0].contentRect.width);
      setLargura((atual) => (atual === w ? atual : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const curto = largura !== null && largura < LIMITE_CURTO;
  const dados = useMemo(() => (curto ? serie.slice(-REUNIOES_NO_CURTO) : serie), [serie, curto]);
  const g = useMemo(
    () => (largura === null || dados.length === 0 ? null : montar(dados, serie, largura, altura, curto)),
    [dados, serie, largura, altura, curto],
  );

  if (serie.length === 0) return <span className="aguardando">aguardando</span>;

  const n = dados.length;
  const idxSel = sel === null ? -1 : dados.findIndex((p) => p.ata === sel);
  const pSel = idxSel >= 0 ? dados[idxSel] : null;

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  const resumo =
    `Índice de tom e Selic meta em ${serie.length} reuniões do Copom, de ${dataCurta(primeiro.data_reuniao)} a ${dataCurta(ultimo.data_reuniao)}. ` +
    `Na última, tom ${fmtIndice(ultimo.indice)} (${tomRotulo(ultimo.indice)}) e Selic ${fmtSelic(ultimo.selic_apos)}. ` +
    `Use as setas para percorrer as reuniões.`;

  function irPara(clientX: number) {
    const el = caixa.current;
    if (!el || !g || n === 0) return;
    const x = clientX - el.getBoundingClientRect().left;
    const i = g.passo > 0 ? clamp(Math.round((x - g.x0) / g.passo), 0, n - 1) : 0;
    setSel(dados[i].ata);
  }

  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    if (n === 0) return;
    const atual = idxSel < 0 ? n - 1 : idxSel;
    let i: number;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") i = idxSel < 0 ? n - 1 : Math.max(0, atual - 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") i = idxSel < 0 ? n - 1 : Math.min(n - 1, atual + 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "Escape") {
      setSel(null);
      return;
    } else return;
    e.preventDefault();
    setSel(dados[i].ata);
  }

  // posição do cartão: ao lado da mira, sem sair da área
  let dica: CSSProperties | null = null;
  if (g && largura !== null && pSel) {
    const x = g.xs[idxSel];
    const w = Math.min(TIP_W, largura);
    let esq = x + 14 + w <= largura ? x + 14 : x - 14 - w;
    esq = clamp(esq, 0, Math.max(0, largura - w));
    const topo = clamp(g.tomTop - 4, 0, Math.max(0, altura - TIP_H));
    dica = { left: esq, top: topo, width: w };
  }

  return (
    <figure className="w-full">
      <div
        ref={caixa}
        role="img"
        aria-label={resumo}
        tabIndex={0}
        className="relative w-full touch-pan-y select-none rounded-[4px]"
        style={{ height: altura }}
        onPointerMove={(e) => irPara(e.clientX)}
        onPointerDown={(e) => irPara(e.clientX)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setSel(null);
        }}
        onFocus={(e) => {
          if (sel === null && e.currentTarget.matches(":focus-visible")) setSel(dados[n - 1]?.ata ?? null);
        }}
        onBlur={() => setSel(null)}
        onKeyDown={teclas}
      >
        {g && largura !== null && (
          <svg
            width={largura}
            height={altura}
            viewBox={`0 0 ${largura} ${altura}`}
            className="absolute inset-0 block overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <clipPath id={clipAcima}>
                <rect x={0} y={0} width={largura} height={Math.max(0, g.y0)} />
              </clipPath>
              <clipPath id={clipAbaixo}>
                <rect x={0} y={g.y0} width={largura} height={Math.max(0, altura - g.y0)} />
              </clipPath>
            </defs>

            {/* área entre o tom e o zero: quente acima, fria abaixo */}
            <path d={g.areaTom} fill="var(--duro-suave)" fillOpacity={0.85} clipPath={`url(#${clipAcima})`} />
            <path d={g.areaTom} fill="var(--brando-suave)" fillOpacity={0.85} clipPath={`url(#${clipAbaixo})`} />

            {/* grade leve do painel de tom */}
            {g.marcas.map((v) => (
              <g key={`m${v}`}>
                <line
                  x1={g.ML}
                  x2={largura - g.MR}
                  y1={g.yT(v)}
                  y2={g.yT(v)}
                  stroke={v === 0 ? "var(--tinta-3)" : "var(--linha)"}
                  strokeOpacity={v === 0 ? 0.55 : 1}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={g.ML - 8}
                  y={g.yT(v) + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill={v === 0 ? "var(--tinta-2)" : "var(--tinta-3)"}
                  className="num"
                >
                  {rotuloEscala(v)}
                </text>
              </g>
            ))}

            {/* linhas das viradas de ciclo, atravessando os dois painéis */}
            {g.viradas.map((v) => (
              <line
                key={`vl${v.i}`}
                x1={v.x}
                x2={v.x}
                y1={2 + v.linha * 17 + 16}
                y2={g.selicBot}
                stroke="var(--linha-2)"
                strokeWidth={1}
                strokeDasharray="3 3"
                shapeRendering="crispEdges"
              />
            ))}

            {/* títulos e sentido da escala */}
            <text x={0} y={g.AH + 12} fontSize={12} fontWeight={500} fill="var(--tinta-2)" style={halo}>
              índice de tom
            </text>
            <text x={largura} y={g.AH + 12} fontSize={12} textAnchor="end" fill="var(--duro)" style={halo}>
              ↑ mais duro
            </text>
            <text x={largura} y={g.tomBot + 17} fontSize={12} textAnchor="end" fill="var(--brando)" style={halo}>
              ↓ mais brando
            </text>
            <text x={0} y={g.selicTop - 10} fontSize={12} fontWeight={500} fill="var(--tinta-2)" style={halo}>
              Selic meta
            </text>

            {/* painel da Selic */}
            <path d={g.areaSelic} fill="var(--papel-2)" />
            <path
              d={g.caminhoSelic}
              fill="none"
              stroke="var(--tinta-2)"
              strokeWidth={1.5}
              strokeLinejoin="miter"
            />
            {g.degraus.map((d, k) => (
              <path
                key={`dg${k}`}
                d={d.d}
                fill="none"
                stroke={d.cor}
                strokeWidth={2}
                strokeLinejoin="miter"
                strokeLinecap="square"
              />
            ))}
            <line
              x1={g.ML}
              x2={largura - g.MR}
              y1={g.selicBot}
              y2={g.selicBot}
              stroke="var(--linha-2)"
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <text
              x={g.ML - 8}
              y={g.yS(dados[0].selic_apos) + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--tinta-2)"
              className="num"
            >
              {fmtSelic(dados[0].selic_apos)}
            </text>
            <text
              x={g.xs[n - 1] + 8}
              y={g.yS(dados[n - 1].selic_apos) + 4}
              fontSize={12}
              fontWeight={500}
              fill="var(--tinta)"
              className="num"
            >
              {fmtSelic(dados[n - 1].selic_apos)}
            </text>

            {/* painel do tom */}
            <path
              d={g.caminhoTom}
              fill="none"
              stroke="var(--acento)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {dados.map((p, i) =>
              p.indice === null || i === g.ultimoTom ? null : (
                <circle key={`p${p.ata}`} cx={g.xs[i]} cy={g.yT(p.indice)} r={2.5} fill={corPonto(p.indice)} />
              ),
            )}
            {g.ultimoTom >= 0 && dados[g.ultimoTom].indice !== null && (
              <g>
                <circle
                  cx={g.xs[g.ultimoTom]}
                  cy={g.yT(dados[g.ultimoTom].indice as number)}
                  r={5.5}
                  fill={corPonto(dados[g.ultimoTom].indice as number)}
                  stroke="var(--papel)"
                  strokeWidth={3}
                />
                <text
                  x={g.xs[g.ultimoTom] + 11}
                  y={g.yT(dados[g.ultimoTom].indice as number) + 4.5}
                  fontSize={13}
                  fontWeight={600}
                  fill={corTextoTom(dados[g.ultimoTom].indice as number)}
                  className="num"
                  style={halo}
                >
                  {fmtIndice(dados[g.ultimoTom].indice)}
                </text>
              </g>
            )}

            {/* eixo x */}
            {g.rotulosX.map((i) => (
              <g key={`x${i}`}>
                <line
                  x1={g.xs[i]}
                  x2={g.xs[i]}
                  y1={g.selicBot}
                  y2={g.selicBot + 4}
                  stroke="var(--linha-2)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={g.xs[i]}
                  y={g.selicBot + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--tinta-3)"
                  className="num"
                >
                  {mesAno(dados[i].data_reuniao)}
                </text>
              </g>
            ))}

            {/* rótulos das viradas, por cima de tudo */}
            {g.viradas.map((v) => (
              <g key={`vr${v.i}`}>
                <rect x={v.esq} y={2 + v.linha * 17} width={v.larg} height={16} rx={3} fill="var(--papel)" />
                <text
                  x={v.esq + v.larg / 2}
                  y={2 + v.linha * 17 + 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill={v.cor}
                >
                  {v.rotulo}
                </text>
              </g>
            ))}

            {/* mira */}
            {pSel && (
              <g>
                <line
                  x1={g.xs[idxSel]}
                  x2={g.xs[idxSel]}
                  y1={g.tomTop - 4}
                  y2={g.selicBot}
                  stroke="var(--tinta-3)"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                {pSel.indice !== null && (
                  <circle
                    cx={g.xs[idxSel]}
                    cy={g.yT(pSel.indice)}
                    r={5}
                    fill={corPonto(pSel.indice)}
                    stroke="var(--papel)"
                    strokeWidth={2.5}
                  />
                )}
                <circle
                  cx={g.xs[idxSel]}
                  cy={g.yS(pSel.selic_apos)}
                  r={3.5}
                  fill="var(--tinta-2)"
                  stroke="var(--papel)"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
        )}

        {pSel && dica && (
          <div
            className="pointer-events-none absolute z-10 rounded-[10px] border border-linha bg-papel px-3 py-2.5"
            style={{ ...dica, boxShadow: "var(--sombra-2)" }}
            aria-hidden="true"
          >
            <p className="num text-[13px] font-medium leading-snug text-tinta">
              Reunião {pSel.ata} · {dataCurta(pSel.data_reuniao)}
            </p>
            <dl className="num mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] leading-snug">
              <dt className="text-tinta-3">tom</dt>
              <dd className="text-tinta">
                {pSel.indice === null ? (
                  <span className="text-tinta-3">sem leitura</span>
                ) : (
                  <>
                    <span className={`font-medium ${classeTextoTom(pSel.indice)}`}>{fmtIndice(pSel.indice)}</span>{" "}
                    <span className="text-tinta-2">({tomRotulo(pSel.indice)})</span>
                  </>
                )}
              </dd>
              <dt className="text-tinta-3">Selic</dt>
              <dd className="text-tinta">{fmtSelic(pSel.selic_apos)}</dd>
              <dt className="text-tinta-3">decisão</dt>
              <dd className="text-tinta">{fmtDecisao(pSel.decisao, pSel.decisao_pp)}</dd>
            </dl>
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {pSel
          ? `Reunião ${pSel.ata}, ${dataCurta(pSel.data_reuniao)}: tom ${
              pSel.indice === null ? "sem leitura" : `${fmtIndice(pSel.indice)} (${tomRotulo(pSel.indice)})`
            }, Selic ${fmtSelic(pSel.selic_apos)}, ${fmtDecisao(pSel.decisao, pSel.decisao_pp)}.`
          : ""}
      </p>

      <div className="sr-only"><table>
        <caption>Índice de tom e Selic meta por reunião do Copom</caption>
        <thead>
          <tr>
            <th scope="col">Reunião</th>
            <th scope="col">Data</th>
            <th scope="col">Tom</th>
            <th scope="col">Selic meta</th>
            <th scope="col">Decisão</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((p) => (
            <tr key={p.ata}>
              <td>{p.ata}</td>
              <td>{dataCurta(p.data_reuniao)}</td>
              <td>{p.indice === null ? "sem leitura" : `${fmtIndice(p.indice)} (${tomRotulo(p.indice)})`}</td>
              <td>{fmtSelic(p.selic_apos)}</td>
              <td>{fmtDecisao(p.decisao, p.decisao_pp)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}
