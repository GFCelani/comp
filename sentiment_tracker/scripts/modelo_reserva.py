"""
Modelo reserva SEM IA: prevê o tom de cada parágrafo (−2..+2) a partir do texto, treinado nos
rótulos do Claude (dados/rotulos). Serve quando não há Claude disponível (ex.: GitHub Actions sem
token): dá uma nota provisória, marcada como "reserva".

    .venv/bin/python scripts/modelo_reserva.py           # treina, avalia (leave-one-ata-out) e salva
    from modelo_reserva import prever                    # prever(lista_de_textos) -> lista de notas

Modelo: TF-IDF de palavras (1–3 gramas) + caracteres (3–5) → regressão ridge, nota arredondada.
Avaliação: deixa uma ata inteira de fora por vez (evita vazar frases repetidas da mesma ata).
Saídas: dados/modelo_reserva.pkl, resultados/metricas_modelo.json (formato do CONTRATO.md),
comparando com os rótulos do Claude desta Skill e, à parte, com banco/rotulos.jsonl (Sonnet, régua simples).
"""
import json
import pickle
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline, make_union

RAIZ = Path(__file__).resolve().parents[1]
ROTULOS_DIR = __import__("os").environ.get("TOM_ROTULOS", "rotulos")
DADOS, RES = RAIZ / "dados", RAIZ / "resultados"
BANCO = RAIZ.parent / "banco"
ARQ_MODELO = DADOS / "modelo_reserva.pkl"
NOTAS = [-2, -1, 0, 1, 2]


def novo_modelo():
    return make_pipeline(
        make_union(TfidfVectorizer(ngram_range=(1, 3), min_df=2, sublinear_tf=True),
                   TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, sublinear_tf=True)),
        Ridge(alpha=1.0))


def arredondar(x):
    return np.clip(np.rint(x), -2, 2).astype(int)


def base() -> pd.DataFrame:
    linhas = []
    for f in (DADOS / "lotes").glob("ata_*.json"):
        lote = json.loads(f.read_text(encoding="utf-8"))
        rot = DADOS / ROTULOS_DIR / f.name
        if not rot.exists():
            continue
        notas = {p["paragrafo"]: p["tom"] for p in json.loads(rot.read_text(encoding="utf-8"))["paragrafos"]}
        for p in lote["paragrafos"]:
            if p["paragrafo"] in notas:
                linhas.append({"ata": lote["ata"], "paragrafo": p["paragrafo"],
                               "texto": f"{p['secao']} || {p['texto']}", "nota": notas[p["paragrafo"]]})
    return pd.DataFrame(linhas).sort_values(["ata", "paragrafo"]).reset_index(drop=True)


def metricas(real, prev) -> dict:
    real, prev = np.asarray(real), np.asarray(prev)
    mat = [[int(((real == i) & (prev == j)).sum()) for j in NOTAS] for i in NOTAS]
    return {"acuracia": round(float((real == prev).mean()), 3),
            "acuracia_1ponto": round(float((np.abs(real - prev) <= 1).mean()), 3),
            "erro_medio_abs": round(float(np.abs(real - prev).mean()), 3),
            "matriz_confusao": {"rotulos": NOTAS, "valores": mat}}


def prever(textos: list[str]) -> list[int]:
    modelo = pickle.loads(ARQ_MODELO.read_bytes())
    return arredondar(modelo.predict(textos)).tolist()


if __name__ == "__main__":
    df = base()
    print(f"{len(df)} parágrafos de {df['ata'].nunique()} atas")
    prev = np.zeros(len(df), int)
    por_ata = []
    for n in sorted(df["ata"].unique()):
        teste = df["ata"] == n
        m = novo_modelo().fit(df.loc[~teste, "texto"], df.loc[~teste, "nota"])
        prev[teste.to_numpy()] = arredondar(m.predict(df.loc[teste, "texto"]))
        r = metricas(df.loc[teste, "nota"], prev[teste.to_numpy()])
        por_ata.append({"ata": int(n), **{k: r[k] for k in ("acuracia", "acuracia_1ponto", "erro_medio_abs")}})
    geral = metricas(df["nota"], prev)
    base_zero = metricas(df["nota"], np.zeros(len(df), int))
    final = novo_modelo().fit(df["texto"], df["nota"])
    ARQ_MODELO.write_bytes(pickle.dumps(final))

    # comparação com os rótulos simples do pipeline (Sonnet, régua −2..+2 sem dimensões)
    sonnet = {}
    if (BANCO / "rotulos.jsonl").exists():
        s = pd.read_json(BANCO / "rotulos.jsonl", lines=True)[["ata", "paragrafo", "nota"]].rename(columns={"nota": "sonnet"})
        j = df.merge(s, on=["ata", "paragrafo"])
        sonnet = {"n": int(len(j)), "skill_vs_sonnet": metricas(j["sonnet"], j["nota"]),
                  "reserva_vs_sonnet": metricas(j["sonnet"], prev[df.merge(s, on=["ata", "paragrafo"], how="left")["sonnet"].notna().to_numpy()])}

    saida = {"metodo": "reserva_tfidf_ridge (sem IA) treinado nos rótulos da Skill tom-copom",
             "gerado_em": datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds"),
             "n_paragrafos": int(len(df)), **geral, "validacao_leave_one_out": por_ata,
             "base_sempre_zero": {k: base_zero[k] for k in ("acuracia", "acuracia_1ponto", "erro_medio_abs")},
             "comparacao_rotulos_pipeline": sonnet,
             "nota": "Métricas do modelo reserva contra os rótulos do Claude (Skill tom-copom), deixando uma ata "
                     "inteira de fora por vez. 'comparacao_rotulos_pipeline' compara com banco/rotulos.jsonl."}
    RES.mkdir(exist_ok=True)
    (RES / "metricas_modelo.json").write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: saida[k] for k in ("acuracia", "acuracia_1ponto", "erro_medio_abs", "base_sempre_zero")}, indent=1))
    if sonnet:
        print("Skill vs Sonnet:", {k: sonnet["skill_vs_sonnet"][k] for k in ("acuracia", "acuracia_1ponto", "erro_medio_abs")})
        print("Reserva vs Sonnet:", {k: sonnet["reserva_vs_sonnet"][k] for k in ("acuracia", "acuracia_1ponto", "erro_medio_abs")})
