"""Modelo v2: compara as 8 combinações fixadas em DECISOES.md (sem Claude).

Escolha nas atas 251–270 (janela crescente); confirmação 271–281 só do escolhido e do atual (A-log C=0,3).
Saída: modelo/v2_resultado.json.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent))
import treinar as T  # noqa: E402

RAIZ = T.RAIZ
NOVAS = ["p_nivel", "p_surpresa", "p_confianca", "lex_nivel", "lex_mudanca"]
CONJ = {"A": T.VARS, "B": T.VARS + NOVAS, "C": list(T.DEC) + NOVAS}
COMB = [("A", "log03"), ("B", "log03"), ("B", "log01"), ("B", "floresta"), ("B", "arvore"),
        ("C", "log03"), ("C", "log01"), ("C", "floresta")]
SIMPLES = {"arvore": 0, "log03": 1, "log01": 1, "floresta": 2}


def fabricar(nome):
    if nome == "log03":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=5000))
    if nome == "log01":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=5000))
    if nome == "floresta":
        return RandomForestClassifier(n_estimators=300, max_depth=3, min_samples_leaf=3, random_state=42)
    if nome == "arvore":
        return DecisionTreeClassifier(max_depth=2, random_state=42)
    raise ValueError(nome)


def base():
    df = pd.read_csv(RAIZ / "modelo" / "base_modelo.csv")
    lex = pd.read_csv(RAIZ / "modelo" / "parceiro" / "lexico.csv")[["ata", "lex_nivel", "lex_mudanca"]]
    p = json.loads((RAIZ / "modelo" / "parceiro" / "indice_modelo_parceiro.json").read_text(encoding="utf-8"))
    par = pd.DataFrame([{"ata": a["ata"], "p_nivel": a["indice"], "p_surpresa": a["surpresa"],
                         "p_confianca": a["confianca"]} for a in p["atas"]])
    df = df.merge(par, on="ata", how="left").merge(lex, on="ata", how="left")
    df[NOVAS] = df[NOVAS].fillna(0.0)
    return df


def matriz(df, vars_):
    X = pd.DataFrame({f"decisao_registrada_na_ata_{c}": (df["decisao_registrada_na_ata"] == c).astype(float)
                      for c in T.CLASSES})
    for v in list(T.NUM) + NOVAS:
        X[v] = df[v].astype(float)
    return X[vars_].values


def janela(X, y, nome, ini, fim):
    prev, probs = [], []
    for t in range(ini, fim):
        ytr = y[:t]
        if len(set(ytr)) == 1:
            q = np.array([1.0 if c == ytr[0] else 0.0 for c in T.CLASSES])
        else:
            q = T.proba3(fabricar(nome).fit(X[:t], ytr), X[t:t + 1])[0]
        prev.append(T.CLASSES[int(q.argmax())])
        probs.append(q)
    yy = list(y[ini:fim])
    return {"acuracia": round(float(np.mean([a == b for a, b in zip(yy, prev)])), 3),
            "acuracia_balanceada": round(float(balanced_accuracy_score(yy, prev)), 3),
            "acertos": int(sum(a == b for a, b in zip(yy, prev))), "n": len(yy), "previstos": prev}


def main():
    df = base()
    tr = df[df["proxima_decisao"].notna()].reset_index(drop=True)
    y = tr["proxima_decisao"].values
    atas = list(tr["ata"])
    i251, i271, i282 = atas.index(251), atas.index(271), len(atas)
    assert atas[i282 - 1] == 281
    esc = {}
    for c, m in COMB:
        r = janela(matriz(tr, CONJ[c]), y, m, i251, i271)
        esc[f"{c}-{m}"] = r
        print(f"ESCOLHA {c}-{m}: {r['acertos']}/{r['n']} acc {r['acuracia']} bal {r['acuracia_balanceada']}")
    chave = max(esc, key=lambda k: (esc[k]["acuracia"], esc[k]["acuracia_balanceada"],
                                    -SIMPLES[k.split('-')[1]], -"ACB".index(k[0]) if k[0] != "A" else 0))
    print("ESCOLHIDO:", chave)
    conf = {}
    for k in dict.fromkeys([chave, "A-log03"]):
        c, m = k.split("-")
        conf[k] = janela(matriz(tr, CONJ[c]), y, m, i271, i282)
        print(f"CONFIRMACAO {k}: {conf[k]['acertos']}/{conf[k]['n']} acc {conf[k]['acuracia']} "
              f"bal {conf[k]['acuracia_balanceada']}")
    out = {"escolha": {"atas": "251-270", "resultados": esc}, "escolhido": chave,
           "confirmacao": {"atas": "271-281", "resultados": conf}}
    (RAIZ / "modelo" / "v2_resultado.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
