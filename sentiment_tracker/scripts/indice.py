"""
Índice de tom das atas do Copom: agrega os rótulos do Claude, calibra contra o gabarito
(analistas + mercado limpo) e calcula confiança. Tudo determinístico a partir dos arquivos.

    .venv/bin/python scripts/indice.py

Entradas: dados/rotulos/ata_<n>.json (Skill tom-copom), dados/lexico.csv, dados/reacao.csv,
          ../banco/atas.json (datas e decisões)
Saídas:   resultados/indice.json            formato completo (este modelo)
          resultados/indice_modelo.json     formato do CONTRATO.md do time (banco/indice_modelo.json)
          resultados/calibracao.json        pesos, métricas leave-one-out, intervalo de previsão

Dois números por ata, separados de propósito (cuidado nº 2 do case: tom ≠ decisão):
  NÍVEL     quão duro é o texto (−2..+2 e −100..+100). Média ponderada dos parágrafos:
            peso = peso_do_tipo_de_sinal × peso_da_dimensão × confiança do rotulador,
            combinada (média) com o tom geral que o Claude atribuiu à ata.
  SURPRESA  quanto a ata endureceu (+) ou suavizou (−) em relação ao esperado. Combinação linear de
            4 sinais do texto, com pesos ajustados (ridge) para prever o rótulo de surpresa
            (analistas + reação do DI, sem dias contaminados). Avaliada fora da amostra (leave-one-out).
  CONFIANÇA 0–100 por ata: concordância entre os sinais independentes (Claude parágrafo a parágrafo,
            Claude resumo, léxico), precisão do nível (bootstrap) e confiança do rotulador.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import Ridge

RAIZ = Path(__file__).resolve().parents[1]
ROTULOS_DIR = __import__("os").environ.get("TOM_ROTULOS", "rotulos")
DADOS, RES = RAIZ / "dados", RAIZ / "resultados"
BANCO = RAIZ.parent / "banco"
BRT = timezone(timedelta(hours=-3))

W_SINAL = {0: 0.2, 1: 1.0, 2: 2.5}
W_DIM = {"orientacao_futura": 2.0, "balanco_riscos": 1.5, "decisao_votacao": 1.5, "expectativas": 1.2,
         "inflacao_corrente": 1.0, "atividade_trabalho": 0.8, "fiscal_credito": 0.8, "externo": 0.6, "outro": 0.3}
FEATURES = ["claude_surpresa", "mudancas", "delta_nivel", "lex_delta_z"]
SEMENTE = 42


def nivel_ponderado(df: pd.DataFrame) -> float:
    w = df["sinal"].map(W_SINAL) * df["dimensao"].map(W_DIM).fillna(0.3) * df["confianca"].clip(0.1, 1)
    return float((w * df["tom"]).sum() / w.sum()) if w.sum() else 0.0


def bootstrap_ic(df: pd.DataFrame, n: int = 1000) -> tuple[float, float]:
    rng = np.random.default_rng(SEMENTE)
    vals = [nivel_ponderado(df.iloc[rng.integers(0, len(df), len(df))]) for _ in range(n)]
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def carregar_rotulos() -> list[dict]:
    out = []
    for f in sorted((DADOS / ROTULOS_DIR).glob("ata_*.json"), key=lambda f: int(f.stem.split("_")[1])):
        out.append(json.loads(f.read_text(encoding="utf-8")))
    return out


def por_ata(r: dict) -> dict:
    df = pd.DataFrame(r["paragrafos"])
    df["confianca"] = pd.to_numeric(df.get("confianca", 0.7), errors="coerce").fillna(0.7)
    lo, hi = bootstrap_ic(df)
    mud = r.get("mudancas", [])
    soma = sum(m.get("direcao", 0) for m in mud)
    dims = df.groupby("dimensao")["tom"].mean().round(2).to_dict()
    sinal = df[df["sinal"] >= 1]
    return {
        "ata": r["ata"], "reserva": r.get("rotulador") == "modelo_reserva", "n_paragrafos": len(df), "n_nao_zero": int((df["tom"] != 0).sum()),
        "nivel_ponderado": nivel_ponderado(df), "ic_lo": lo, "ic_hi": hi,
        "media_simples": float(df["tom"].mean()),
        "media_sem_zeros": float(df.loc[df["tom"] != 0, "tom"].mean()) if (df["tom"] != 0).any() else None,
        "claude_nivel": float(r["resumo"]["tom_nivel"]), "claude_surpresa": float(r["resumo"]["surpresa"]),
        "explicacao": r["resumo"].get("explicacao", ""),
        "mudancas": float(2 * np.tanh(soma / 4)), "n_mudancas": len(mud),
        "conf_rotulador": float(sinal["confianca"].mean()) if len(sinal) else float(df["confianca"].mean()),
        "dimensoes": dims,
        "top_mudancas": sorted(mud, key=lambda m: -abs(m.get("direcao", 0)))[:3],
        "top_paragrafos": sorted(
            [p for p in r["paragrafos"] if p["tom"] != 0],
            key=lambda p: -abs(p["tom"]) * W_SINAL.get(p["sinal"], 1) * W_DIM.get(p["dimensao"], 0.3))[:5],
    }


def concordancia(vals: list[float]) -> float:
    """1 = todos iguais; 0 = espalhados por toda a régua (−2..+2)."""
    v = np.array([x for x in vals if x is not None and not np.isnan(x)])
    return float(np.clip(1 - v.std() / 1.0, 0, 1)) if len(v) > 1 else 0.5


def main():
    rot = carregar_rotulos()
    if not rot:
        raise SystemExit("Sem rótulos em dados/rotulos/")
    a = pd.DataFrame([por_ata(r) for r in rot]).sort_values("ata").reset_index(drop=True)
    lex = pd.read_csv(DADOS / "lexico.csv")
    reac = pd.read_csv(DADOS / "reacao.csv")
    a = a.merge(lex, on="ata", how="left").merge(
        reac[["ata", "data_publicacao", "surpresa_analistas", "rotulo_surpresa", "d_pre2", "z_pre2", "z_mercado", "peso_mercado",
              "veredito"]], on="ata", how="left")

    # --- nível -------------------------------------------------------------------------------
    a["nivel"] = (a["nivel_ponderado"] + a["claude_nivel"]) / 2
    a["delta_nivel"] = a["nivel"].diff().fillna(0)
    # léxico padronizado para a escala −2..+2 (z-score, 1 dp = 1 ponto)
    a["lex_nivel_z"] = ((a["lex_nivel"] - a["lex_nivel"].mean()) / a["lex_nivel"].std()).clip(-2, 2)
    a["lex_delta_z"] = (a["lex_delta"].fillna(0) / a["lex_delta"].std()).clip(-2, 2)

    # --- surpresa: calibração com leave-one-out ----------------------------------------------
    # Três candidatos competem fora da amostra (leave-one-out). Os dois primeiros não têm parâmetro
    # ajustado (a previsão de cada ata não usa o gabarito de nenhuma ata). Regra: vence a maior
    # correlação LOO; a ridge só vence se superar o melhor candidato sem ajuste por mais de 0,03.
    # melhoria B: encolhe a surpresa do Claude quando os sinais independentes discordam
    a["concord_surp"] = [concordancia([r.claude_surpresa, r.mudancas, r.lex_delta_z]) for r in a.itertuples()]
    a["claude_encolhida"] = a["claude_surpresa"] * (0.5 + 0.5 * a["concord_surp"])
    a["claude_mudancas"] = (a["claude_surpresa"] + a["mudancas"]) / 2
    treino = a.dropna(subset=["rotulo_surpresa"]).copy()
    X, y = treino[FEATURES].to_numpy(), treino["rotulo_surpresa"].to_numpy()
    loo_ridge = np.empty(len(y))
    for i in range(len(y)):
        m = np.ones(len(y), bool); m[i] = False
        loo_ridge[i] = Ridge(alpha=2.0).fit(X[m], y[m]).predict(X[i:i + 1])[0]
    ridge = Ridge(alpha=2.0).fit(X, y)
    cand = {"media_sinais": (X.mean(axis=1), 1, lambda df: df[FEATURES].mean(axis=1)),
            "claude_surpresa": (treino["claude_surpresa"].to_numpy(), 1, lambda df: df["claude_surpresa"]),
            "claude_encolhida": (treino["claude_encolhida"].to_numpy(), 1, lambda df: df["claude_encolhida"]),
            "claude_mudancas": (treino["claude_mudancas"].to_numpy(), 1, lambda df: df["claude_mudancas"]),
            "ridge": (loo_ridge, len(FEATURES) + 1, lambda df: pd.Series(ridge.predict(df[FEATURES].to_numpy()), index=df.index))}
    corr = {k: float(np.corrcoef(v[0], y)[0, 1]) for k, v in cand.items()}
    sem_ajuste = max((k for k in cand if k != "ridge"), key=lambda k: corr[k])
    escolhido = "ridge" if corr["ridge"] > corr[sem_ajuste] + 0.03 else sem_ajuste
    loo, k, prever_fn = cand[escolhido]
    treino["surpresa_loo"] = loo
    resid = y - loo
    rmse = float(np.sqrt((resid ** 2).sum() / max(len(y) - k, 1)))
    meia_banda = stats.t.ppf(0.975, len(y) - k) * rmse * np.sqrt(1 + 1 / len(y))
    a["surpresa"] = prever_fn(a).clip(-2, 2)
    a = a.merge(treino[["ata", "surpresa_loo"]], on="ata", how="left")
    final = ridge

    def metricas(pred, alvo):
        p, t = np.asarray(pred, float), np.asarray(alvo, float)
        ok = ~(np.isnan(p) | np.isnan(t))
        p, t = p[ok], t[ok]
        dirig = np.abs(t) >= 0.5
        return {"n": int(ok.sum()), "correlacao": round(float(np.corrcoef(p, t)[0, 1]), 3) if ok.sum() > 2 else None,
                "acerto_direcao": round(float((np.sign(p[dirig]) == np.sign(t[dirig])).mean()), 3) if dirig.any() else None,
                "n_direcionais": int(dirig.sum()), "erro_medio_abs": round(float(np.abs(p - t).mean()), 3)}

    limpo = treino[(treino["peso_mercado"] > 0) & treino["d_pre2"].notna()]
    calib = {
        "gerado_em": datetime.now(BRT).isoformat(timespec="seconds"),
        "alvo": "rotulo_surpresa = média de surpresa dos analistas (peso 1) e z da variação do prefixado 2 anos "
                "no dia da ata (peso 0 a 0,5 conforme contaminação por outros eventos)",
        "features": FEATURES,
        "estimador_escolhido": escolhido,
        "correlacao_loo_candidatos": {k: round(v, 3) for k, v in corr.items()},
        "regra_escolha": "maior correlação leave-one-out; ridge só se superar o melhor sem ajuste por > 0,03",
        "candidatos_vs_rotulo": {k: metricas(v[0], y) for k, v in cand.items()},
        "pesos_ridge": dict(zip(FEATURES, np.round(final.coef_, 3).tolist())), "intercepto_ridge": round(float(final.intercept_), 3),
        "loo_vs_rotulo": metricas(loo, y),
        "loo_vs_analistas": metricas(loo, treino["surpresa_analistas"]),
        "loo_vs_di_dias_limpos": {**metricas(limpo["surpresa_loo"] if "surpresa_loo" in limpo else
                                             loo[treino.index.isin(limpo.index)], limpo["d_pre2"] / 10),
                                  "nota": "d_pre2 em dezenas de pb; só atas com peso_mercado > 0"},
        "loo_vs_mercado_z_dias_limpos": {**metricas(treino.loc[limpo.index, "surpresa_loo"] if False else
                                                    loo[treino.index.isin(limpo.index)], limpo["z_mercado"].clip(-2, 2)),
                                         "nota": "z médio do prefixado 1a/2a em 1 e 2 dias (melhoria A); peso_mercado > 0"},
        "sinais_isolados_vs_rotulo": {f: metricas(treino[f], y) for f in FEATURES + ["claude_nivel", "nivel"]},
        "base_ingenua_zero": {"erro_medio_abs": round(float(np.abs(y).mean()), 3),
                              "nota": "prever sempre 'em linha' (0)"},
        "intervalo_previsao_95": round(float(meia_banda), 3),
        "n_atas_treino": int(len(y)),
        "aviso": "Amostra curta (atas desde 2021, n≈45): intervalos largos. Os padrões da Skill foram "
                 "extraídos das mesmas atas; o leave-one-out cobre os pesos, não os padrões.",
    }

    # --- confiança por ata -------------------------------------------------------------------
    conf = []
    for _, r in a.iterrows():
        c_nivel = concordancia([r["nivel_ponderado"], r["claude_nivel"], r["lex_nivel_z"]])
        c_surp = concordancia([r["claude_surpresa"], r["mudancas"], r["lex_delta_z"]])
        c_prec = float(np.clip(1 - (r["ic_hi"] - r["ic_lo"]) / 2, 0, 1))
        conf.append(round(100 * (0.3 * c_nivel + 0.3 * c_surp + 0.2 * c_prec + 0.2 * r["conf_rotulador"]), 0))
    a["confianca"] = conf
    # melhoria C: a confiança prevê o acerto? acerto de direção e erro por terço de confiança (fora da amostra)
    t = a.dropna(subset=["rotulo_surpresa", "surpresa_loo"]).copy()
    t["faixa"] = pd.qcut(t["confianca"], 3, labels=["baixa", "media", "alta"], duplicates="drop")
    faixas = {}
    for f, g in t.groupby("faixa", observed=True):
        d = g[g["rotulo_surpresa"].abs() >= 0.5]
        faixas[str(f)] = {"n": int(len(g)), "conf_min": int(g["confianca"].min()), "conf_max": int(g["confianca"].max()),
                          "acerto_direcao": round(float((np.sign(d["surpresa_loo"]) == np.sign(d["rotulo_surpresa"])).mean()), 3) if len(d) else None,
                          "n_direcionais": int(len(d)),
                          "erro_medio_abs": round(float((g["surpresa_loo"] - g["rotulo_surpresa"]).abs().mean()), 3)}
    calib["confianca_por_faixa"] = faixas
    cortes = sorted((v["conf_min"], v["acerto_direcao"]) for v in faixas.values())
    def calibrar(c):
        ac = None
        for cmin, acc in cortes:
            if c >= cmin and acc is not None:
                ac = acc
        return None if ac is None else int(round(100 * ac))
    a["confianca_calibrada"] = a["confianca"].map(calibrar)
    # nota do modelo reserva (sem IA, sem leitura de surpresa): confiança limitada e sem calibração
    a.loc[a["reserva"], "confianca"] = a.loc[a["reserva"], "confianca"].clip(upper=30)
    a.loc[a["reserva"], "confianca_calibrada"] = np.nan
    calib["congelado"] = {"estimador": escolhido, "lex_nivel_media": float(lex["lex_nivel"].mean()),
                          "lex_nivel_dp": float(a["lex_nivel"].std()), "lex_delta_dp": float(a["lex_delta"].std()),
                          "pesos_ridge": final.coef_.tolist(), "intercepto_ridge": float(final.intercept_),
                          "intervalo_previsao_95": float(meia_banda), "cortes_confianca": cortes}

    # --- saídas ------------------------------------------------------------------------------
    atas_meta = {x["numero"]: x for x in json.loads((BANCO / "atas.json").read_text(encoding="utf-8"))} \
        if (BANCO / "atas.json").exists() else {}
    agora = datetime.now(BRT).isoformat(timespec="seconds")
    itens = []
    for _, r in a.iterrows():
        meta = atas_meta.get(int(r["ata"]), {})
        itens.append({
            "ata": int(r["ata"]), "data_reuniao": meta.get("data_reuniao"),
            "data_publicacao": r["data_publicacao"] if isinstance(r["data_publicacao"], str) else meta.get("data_publicacao"),
            "decisao": meta.get("decisao"), "selic_apos": meta.get("selic_apos"),
            "nivel": round(float(r["nivel"]), 2), "nivel_100": int(round(50 * r["nivel"])),
            "nivel_ic95": [round(float((r["ic_lo"] + r["claude_nivel"]) / 2), 2),
                           round(float((r["ic_hi"] + r["claude_nivel"]) / 2), 2)],
            "surpresa": round(float(r["surpresa"]), 2), "surpresa_100": int(round(50 * r["surpresa"])),
            "surpresa_ip95": [round(float(r["surpresa"] - meia_banda), 2), round(float(r["surpresa"] + meia_banda), 2)],
            "confianca": int(r["confianca"]),
            "confianca_calibrada": None if pd.isna(r["confianca_calibrada"]) else int(r["confianca_calibrada"]),
            "componentes": {k: round(float(r[k]), 2) for k in
                            ["nivel_ponderado", "claude_nivel", "lex_nivel_z", "claude_surpresa", "mudancas",
                             "delta_nivel", "lex_delta_z"]},
            "dimensoes": r["dimensoes"], "explicacao": r["explicacao"],
            "mudancas": [{k: m.get(k) for k in ("tipo", "paragrafo", "paragrafo_anterior", "direcao", "trecho",
                                                "padroes", "explicacao")} for m in r["top_mudancas"]],
            "paragrafos_chave": [{k: p.get(k) for k in ("paragrafo", "dimensao", "tom", "trecho", "padroes")}
                                 for p in r["top_paragrafos"]],
            "gabarito": {"veredito_analistas": r.get("veredito"), "surpresa_analistas": None if pd.isna(r["surpresa_analistas"]) else r["surpresa_analistas"],
                         "d_pre2_pb": None if pd.isna(r["d_pre2"]) else r["d_pre2"],
                         "peso_mercado": None if pd.isna(r["peso_mercado"]) else r["peso_mercado"]},
        })
    RES.mkdir(exist_ok=True)
    (RES / "indice.json").write_text(json.dumps(
        {"metodo": "tom_copom_multidimensional_v1", "gerado_em": agora, "escala": {
            "nivel": "−2 (muito brando) a +2 (muito duro); nivel_100 = 50×nivel",
            "surpresa": "−2 (bem mais brando que o esperado) a +2 (bem mais duro); calibrada",
            "confianca": "0–100, concordância entre sinais independentes + precisão + rotulador"},
         "calibracao": calib, "atas": itens}, ensure_ascii=False, indent=1), encoding="utf-8")
    # formato do contrato (banco/indice_modelo.json)
    contrato = {"metodo": "tom_copom_multidimensional_v1", "gerado_em": agora, "atas": [
        {"ata": i["ata"], "data_reuniao": i["data_reuniao"], "indice": i["nivel"],
         "indice_media_simples": round(float(r["media_simples"]), 2), "n_paragrafos": int(r["n_paragrafos"]),
         "n_nao_zero": int(r["n_nao_zero"]), "indice_100": i["nivel_100"], "surpresa": i["surpresa"],
         "confianca": i["confianca"], "ic95": i["nivel_ic95"], "dimensoes": i["dimensoes"],
         "mudancas": i["mudancas"], "explicacao": i["explicacao"]}
        for i, (_, r) in zip(itens, a.iterrows())]}
    (RES / "indice_modelo.json").write_text(json.dumps(contrato, ensure_ascii=False, indent=1), encoding="utf-8")
    (RES / "calibracao.json").write_text(json.dumps(calib, ensure_ascii=False, indent=1), encoding="utf-8")
    return a, calib


if __name__ == "__main__":
    a, c = main()
    cols = ["ata", "nivel", "ic_lo", "ic_hi", "surpresa", "surpresa_loo", "rotulo_surpresa", "veredito", "d_pre2", "confianca"]
    print(a[cols].round(2).to_string(index=False))
    print(json.dumps({k: c[k] for k in ("estimador_escolhido", "correlacao_loo_candidatos", "loo_vs_rotulo", "loo_vs_analistas", "loo_vs_di_dias_limpos",
                                        "base_ingenua_zero", "intervalo_previsao_95")}, ensure_ascii=False, indent=1))
    print("sinais isolados:", {k: v["correlacao"] for k, v in c["sinais_isolados_vs_rotulo"].items()})
