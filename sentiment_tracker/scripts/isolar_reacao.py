"""
Mede a reação do mercado a cada ata e separa o que é da ata do que é ruído/evento externo.

    .venv/bin/python scripts/isolar_reacao.py

Entradas: dados/mercado.csv, dados/focus_selic.csv, dados/analistas/*.jsonl
Saída:    dados/reacao.csv (uma linha por ata) e impressão de um resumo.

Método (por ata, D = dia de publicação, 8h, antes da abertura):
  d_pre1/d_pre2   variação em pontos-base da taxa prefixada de 1 e 2 anos, de D-1 a D
                  (taxa "manhã" do Tesouro Direto, fixada depois da ata); d_pre2_2d = D-1 a D+1
  z_pre2          d_pre2 dividido pelo desvio-padrão robusto das variações diárias dos 250 dias úteis
                  anteriores (|z| < 1 = indistinguível de um dia comum)
  d_dolar, d_ibov variação % no dia (secundárias: muito expostas ao exterior)
  d_focus_prox    mudança da mediana Focus para a Selic da próxima reunião: último Focus antes da ata
                  → primeiro Focus depois (semanal, também contaminado por outros dados da semana)
  peso_mercado    quanto confiar no movimento de mercado como reação À ATA:
                    atribuída pelos analistas "sim" = 1, "parcial" = 0.5, "nao" = 0, "nd" = 0.25;
                    × 0.5 se houve ≥ 2 fatores externos relevantes no dia
  surpresa_analistas  -2..+2 (+ = mais dura que o esperado), dos analistas
  rotulo_surpresa     consenso: combina analistas (sempre) e mercado (só se peso>0 e |z|≥1)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DADOS = RAIZ / "dados"


def carregar_analistas() -> pd.DataFrame:
    linhas = []
    for f in sorted((DADOS / "analistas").glob("*.jsonl")):
        for l in f.read_text(encoding="utf-8").splitlines():
            if l.strip():
                r = json.loads(l)
                linhas.append({
                    "ata": r["reuniao"], "data_reuniao": r["data_reuniao"],
                    "data_publicacao": r["data_publicacao_ata"],
                    "veredito": r["veredito_vs_esperado"], "surpresa_analistas": r["surpresa"],
                    "tom_absoluto_analistas": r["tom_absoluto"],
                    "atribuida_a_ata": r["reacao_mercado"]["atribuida_a_ata"],
                    "di_analistas": r["reacao_mercado"]["di"],
                    "n_fatores_externos": len(r.get("fatores_externos_no_dia") or []),
                    "fatores_externos": " | ".join(r.get("fatores_externos_no_dia") or []),
                    "n_gatilhos": len(r["gatilhos"]), "confianca_fonte": r["confianca_fonte"],
                })
    return pd.DataFrame(linhas).sort_values("ata")


def mudanca_focus(focus: pd.DataFrame, data_pub: pd.Timestamp, data_reuniao: pd.Timestamp) -> float:
    """Mediana Focus para a próxima reunião: último dado antes da ata vs primeiro depois."""
    antes = focus[focus["Data"] < data_pub]
    depois = focus[focus["Data"] > data_pub]
    if antes.empty or depois.empty:
        return np.nan
    d0, d1 = antes["Data"].max(), depois["Data"].min()
    a, b = antes[antes["Data"] == d0], depois[depois["Data"] == d1]
    # próxima reunião = a mais próxima de 'R<k>/<ano>' presente nos dois cortes; escolhe a 1ª em comum
    comuns = [r for r in a.sort_values("Reuniao")["Reuniao"] if r in set(b["Reuniao"])]
    def ordem(r):
        k, ano = r[1:].split("/")
        return int(ano) * 10 + int(k)
    comuns = sorted(comuns, key=ordem)
    if not comuns:
        return np.nan
    prox = comuns[0]
    return float(b.loc[b["Reuniao"] == prox, "Mediana"].iloc[0] - a.loc[a["Reuniao"] == prox, "Mediana"].iloc[0])


def main() -> pd.DataFrame:
    an = carregar_analistas()
    m = pd.read_csv(DADOS / "mercado.csv", parse_dates=["data"]).sort_values("data").reset_index(drop=True)
    for c in ("pre_1a", "pre_2a"):
        m["d_" + c] = m[c].diff() * 100                      # pontos-base
    m["d_dolar"] = m["dolar"].pct_change() * 100
    m["d_ibov"] = m["ibov"].pct_change() * 100
    # desvio robusto (MAD) das variações diárias nos 250 dias úteis anteriores
    m["sd_pre2"] = (m["d_pre_2a"].abs().rolling(250, min_periods=60).median().shift(1)) * 1.4826
    focus = pd.read_csv(DADOS / "focus_selic.csv", parse_dates=["Data"])

    linhas = []
    for _, a in an.iterrows():
        out = a.to_dict()
        if not a["data_publicacao"]:
            linhas.append(out); continue
        d = pd.Timestamp(a["data_publicacao"])
        idx = m.index[m["data"] >= d]
        if len(idx) == 0:
            linhas.append(out); continue
        i = idx[0]
        out["data_mercado"] = m.loc[i, "data"].strftime("%Y-%m-%d")
        out["d_pre1"] = round(m.loc[i, "d_pre_1a"], 1)
        out["d_pre2"] = round(m.loc[i, "d_pre_2a"], 1)
        out["d_pre2_2d"] = round((m.loc[min(i + 1, len(m) - 1), "pre_2a"] - m.loc[i - 1, "pre_2a"]) * 100, 1)
        out["z_pre2"] = round(m.loc[i, "d_pre_2a"] / m.loc[i, "sd_pre2"], 2) if m.loc[i, "sd_pre2"] else np.nan
        out["d_dolar"] = round(m.loc[i, "d_dolar"], 2)
        out["d_ibov"] = round(m.loc[i, "d_ibov"], 2)
        out["d_focus_prox"] = mudanca_focus(focus, d, pd.Timestamp(a["data_reuniao"]))
        linhas.append(out)
    r = pd.DataFrame(linhas)

    base = r["atribuida_a_ata"].map({"sim": 1.0, "parcial": 0.5, "nao": 0.0, "nd": 0.25}).fillna(0.25)
    r["peso_mercado"] = np.where(r["n_fatores_externos"] >= 2, base * 0.5, base)
    sinal_mercado = np.sign(r["d_pre2"]).where(r["z_pre2"].abs() >= 1, 0).fillna(0)
    r["sinal_mercado_limpo"] = np.where(r["peso_mercado"] > 0, sinal_mercado, 0)
    r["concorda_mercado_analistas"] = np.where(
        (r["sinal_mercado_limpo"] != 0) & (r["surpresa_analistas"].fillna(0) != 0),
        np.sign(r["surpresa_analistas"].fillna(0)) == r["sinal_mercado_limpo"], np.nan)
    # rótulo de surpresa consolidado (−2..+2, contínuo): analistas com peso 1, mercado com peso_mercado
    s_an = r["surpresa_analistas"].astype(float)
    s_mk = (r["z_pre2"].clip(-2, 2)).where(r["z_pre2"].abs() >= 1, 0)
    w_mk = r["peso_mercado"].where(r["z_pre2"].notna(), 0)
    r["rotulo_surpresa"] = ((s_an.fillna(0) + w_mk * s_mk.fillna(0)) / (s_an.notna().astype(float) + w_mk)).round(2)
    r.to_csv(DADOS / "reacao.csv", index=False)
    return r


if __name__ == "__main__":
    r = main()
    cols = ["ata", "data_publicacao", "veredito", "surpresa_analistas", "atribuida_a_ata", "n_fatores_externos",
            "d_pre2", "z_pre2", "d_focus_prox", "peso_mercado", "rotulo_surpresa"]
    print(r[cols].to_string(index=False))
    v = r.dropna(subset=["z_pre2"])
    print(f"\natas com dado de mercado: {len(v)}")
    print(f"|z| ≥ 1 (movimento acima de um dia comum): {(v['z_pre2'].abs() >= 1).sum()}")
    lim = v[(v["peso_mercado"] > 0) & (v["z_pre2"].abs() >= 1)]
    print(f"movimentos fortes e atribuíveis à ata (peso>0): {len(lim)}")
    c = r["concorda_mercado_analistas"].dropna()
    print(f"concordância de direção mercado × analistas (onde ambos têm sinal): {c.mean():.0%} em {len(c)} atas"
          if len(c) else "sem casos para concordância")
    vv = v[v["peso_mercado"] > 0]
    print("correlação surpresa_analistas × d_pre2 (peso>0):",
          round(vv["surpresa_analistas"].astype(float).corr(vv["d_pre2"]), 2), f"(n={len(vv)})")
    print("correlação surpresa_analistas × d_pre2 (todas):",
          round(v["surpresa_analistas"].astype(float).corr(v["d_pre2"]), 2), f"(n={len(v)})")
