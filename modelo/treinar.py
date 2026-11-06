"""Treina e valida os modelos de decisão (sem chamadas ao Claude).

Entrada: modelo/base_modelo.csv. Saídas: banco/metricas_modelo.json e banco/indice_modelo.json.
Validação principal: janela crescente (treina 0..t-1, prevê t, t >= 15). Secundária: leave-one-out.
Hiperparâmetros fixos (DECISOES.md).
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, export_text

RAIZ = Path(__file__).resolve().parents[1]
B = RAIZ / "banco"
CLASSES = ["alta", "manutencao", "corte"]
NUM = ["tom_nivel", "tom_variacao", "tom_orientacao", "saldo_duro_brando", "sinais_virada",
       "distancia_focus", "hiato_inflacao"]
VARS = [f"decisao_atual_{c}" for c in CLASSES] + NUM
INICIO = 15
ORDEM = ["ingenua", "arvore", "logistica", "floresta"]  # simplicidade entre os do modelo
NOMES_PT = {"decisao_atual_alta": "decisão atual = alta", "decisao_atual_manutencao": "decisão atual = manutenção",
            "decisao_atual_corte": "decisão atual = corte", "tom_nivel": "nível do tom",
            "tom_variacao": "variação do tom", "tom_orientacao": "tom da seção de decisão",
            "saldo_duro_brando": "saldo duro − brando", "sinais_virada": "termos de virada",
            "distancia_focus": "Selic − Focus fim de ano", "hiato_inflacao": "IPCA 12m − meta"}


def fabricar(nome):
    if nome == "logistica":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))
    if nome == "floresta":
        return RandomForestClassifier(n_estimators=300, max_depth=3, random_state=42)
    if nome == "arvore":
        return DecisionTreeClassifier(max_depth=2, random_state=42)
    raise ValueError(nome)


def matriz(df):
    X = pd.DataFrame({f"decisao_atual_{c}": (df["decisao_atual"] == c).astype(float) for c in CLASSES})
    for v in NUM:
        X[v] = df[v].astype(float)
    return X[VARS].values


def proba3(m, X):
    """predict_proba mapeado para as 3 classes (0 nas ausentes do treino)."""
    p = m.predict_proba(X)
    cl = list(m.classes_) if hasattr(m, "classes_") else list(m[-1].classes_)
    out = np.zeros((len(X), 3))
    for j, c in enumerate(cl):
        out[:, CLASSES.index(c)] = p[:, j]
    return out


def ajustar_prever(nome, Xtr, ytr, Xte, dte):
    if nome == "ingenua":
        dec = list(dte)
        return dec, np.array([[1.0 if d == c else 0.0 for c in CLASSES] for d in dec])
    if len(set(ytr)) == 1:
        p = np.array([[1.0 if c == ytr[0] else 0.0 for c in CLASSES]] * len(Xte))
    else:
        m = fabricar(nome).fit(Xtr, ytr)
        p = proba3(m, Xte)
    return [CLASSES[i] for i in p.argmax(1)], p


def resumo(y, prev, atual, atas, probs):
    y, prev, atual = list(y), list(prev), list(atual)
    vir = [i for i in range(len(y)) if y[i] != atual[i]]
    return {"acuracia": round(float(np.mean([a == b for a, b in zip(y, prev)])), 3),
            "acuracia_balanceada": round(float(balanced_accuracy_score(y, prev)), 3),
            "matriz_confusao": {"rotulos": CLASSES, "linhas": "realizado", "colunas": "previsto",
                                "valores": confusion_matrix(y, prev, labels=CLASSES).tolist()},
            "viradas": {"acertos": int(sum(prev[i] == y[i] for i in vir)), "total": len(vir)},
            "previsoes": [{"ata": int(a), "previsto": p, "realizado": r,
                           "probabilidades": {c: round(float(q[k]), 3) for k, c in enumerate(CLASSES)}}
                          for a, p, r, q in zip(atas, prev, y, probs)]}


def regra_pt(arv):
    """Traduz a árvore em frases 'Se ... e ..., prevê ...' a partir da estrutura (tree_)."""
    tr, txt = arv.tree_, export_text(arv, feature_names=VARS, decimals=2)
    rot = {"alta": "alta", "manutencao": "manutenção", "corte": "corte"}

    def cond(f, lim, esq):
        v = VARS[f]
        if v.startswith("decisao_atual_"):
            c = rot[v.split("_")[-1]]
            return f"a decisão atual não é {c}" if esq else f"a decisão atual é {c}"
        n = f"{lim:.2f}".replace(".", ",")
        return f"{NOMES_PT[v]} ≤ {n}" if esq else f"{NOMES_PT[v]} > {n}"

    frases = []

    def andar(no, conds):
        if tr.children_left[no] == -1:
            c = arv.classes_[int(np.argmax(tr.value[no][0]))]
            frases.append("Se " + " e ".join(conds) + f", prevê {rot[c]}.")
            return
        f, lim = tr.feature[no], tr.threshold[no]
        andar(tr.children_left[no], conds + [cond(f, lim, True)])
        andar(tr.children_right[no], conds + [cond(f, lim, False)])

    andar(0, [])
    return "\n".join(frases), txt


def main() -> int:
    df = pd.read_csv(RAIZ / "modelo" / "base_modelo.csv")
    treino = df[(df["prever"] == 0) & df["proxima_decisao"].notna()].reset_index(drop=True)
    linha_prev = df[df["prever"] == 1]
    X, y, atual, atas = matriz(treino), treino["proxima_decisao"].values, treino["decisao_atual"].values, treino["ata"].values

    vt, loo = {}, {}
    for nome in ORDEM:
        prev, probs = [], []
        for t in range(INICIO, len(treino)):
            p, q = ajustar_prever(nome, X[:t], y[:t], X[t:t + 1], atual[t:t + 1])
            prev += p; probs.append(q[0])
        vt[nome] = resumo(y[INICIO:], prev, atual[INICIO:], atas[INICIO:], probs)
        prev, probs = [], []
        for t in range(len(treino)):
            m = np.arange(len(treino)) != t
            p, q = ajustar_prever(nome, X[m], y[m], X[t:t + 1], atual[t:t + 1])
            prev += p; probs.append(q[0])
        loo[nome] = resumo(y, prev, atual, atas, probs)
        print(f"{nome:10s} tempo acc {vt[nome]['acuracia']} bal {vt[nome]['acuracia_balanceada']} "
              f"viradas {vt[nome]['viradas']['acertos']}/{vt[nome]['viradas']['total']} | LOO {loo[nome]['acuracia']}")

    # melhor por acurácia no tempo; empate -> mais simples
    melhor = max(ORDEM, key=lambda n: (vt[n]["acuracia"], -ORDEM.index(n)))
    melhor_nao_ing = max(ORDEM[1:], key=lambda n: (vt[n]["acuracia"], -ORDEM.index(n)))
    ing = vt["ingenua"]
    destaque = None
    for n in ORDEM[1:]:
        if vt[n]["acuracia"] == ing["acuracia"] and vt[n]["viradas"]["acertos"] > ing["viradas"]["acertos"]:
            destaque = {"metodo": n, "acuracia": vt[n]["acuracia"], "viradas": vt[n]["viradas"],
                        "viradas_ingenua": ing["viradas"]}

    # Interpretação com todas as atas que têm alvo
    log = fabricar("logistica").fit(X, y)
    lr = log[-1]
    coef = {c: {v: round(float(lr.coef_[i][j]), 3) for j, v in enumerate(VARS)} for i, c in enumerate(lr.classes_)}
    flo = fabricar("floresta").fit(X, y)
    pi = permutation_importance(flo, X, y, n_repeats=30, random_state=42)
    imp = sorted(({"variavel": v, "importancia": round(float(pi.importances_mean[j]), 4),
                   "desvio": round(float(pi.importances_std[j]), 4)} for j, v in enumerate(VARS)),
                 key=lambda d: -d["importancia"])
    arv = fabricar("arvore").fit(X, y)
    regra, regra_txt = regra_pt(arv)

    # Previsão atual
    por_modelo = {}
    if len(linha_prev):
        Xp, dp = matriz(linha_prev), linha_prev["decisao_atual"].values
        for nome in ORDEM:
            _, q = ajustar_prever(nome, X, y, Xp, dp)
            por_modelo[nome] = {c: round(float(q[0][k]), 3) for k, c in enumerate(CLASSES)}
    prox_num = int(linha_prev["ata"].iloc[0]) + 2 if len(linha_prev) else None
    previsao_atual = {"reuniao": prox_num, "data": "2026-12-09" if prox_num == 283 else None,
                      "linha_base": {"ata": int(linha_prev["ata"].iloc[0]),
                                     "decisao_atual": linha_prev["decisao_atual"].iloc[0]} if len(linha_prev) else None,
                      "modelo": melhor, "probabilidades": por_modelo.get(melhor), "por_modelo": por_modelo}

    # Índice do modelo por ata: P(alta) − P(corte) do melhor não ingênuo
    fora = {p["ata"]: p["probabilidades"] for p in vt[melhor_nao_ing]["previsoes"]}
    dentro = proba3(fabricar(melhor_nao_ing).fit(X[:INICIO], y[:INICIO]), X[:INICIO]) if len(set(y[:INICIO])) > 1 else None
    itens = []
    datas = dict(zip(df["ata"], df["data_reuniao"]))
    for i, a in enumerate(atas):
        if a in fora:
            pr, amostra = fora[a], "fora"
        else:
            pr, amostra = {c: round(float(dentro[i][k]), 3) for k, c in enumerate(CLASSES)}, "dentro"
        itens.append({"ata": int(a), "data_reuniao": datas[a], "indice": round(pr["alta"] - pr["corte"], 3),
                      "amostra": amostra, "probabilidades": pr})
    if len(linha_prev):
        pr = por_modelo[melhor_nao_ing]
        itens.append({"ata": int(linha_prev["ata"].iloc[0]), "data_reuniao": datas[int(linha_prev["ata"].iloc[0])],
                      "indice": round(pr["alta"] - pr["corte"], 3), "amostra": "previsao_283", "probabilidades": pr})
    agora = datetime.now().isoformat(timespec="seconds")
    idx = {"metodo": f"modelo_{melhor_nao_ing}: P(alta) − P(corte) da reunião seguinte; fora da amostra pela janela "
                     f"no tempo da ata {int(atas[INICIO])} em diante, dentro da amostra (treino nas 15 primeiras) antes",
           "gerado_em": agora, "atas": sorted(itens, key=lambda d: -d["ata"])}
    # remove duplicata da 281 (fica a versão de previsão, que usa a decisão da 282)
    vistos, unicos = set(), []
    for it in sorted(idx["atas"], key=lambda d: (-d["ata"], d["amostra"] != "previsao_283")):
        if it["ata"] not in vistos:
            vistos.add(it["ata"]); unicos.append(it)
    idx["atas"] = unicos
    (B / "indice_modelo.json").write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    met = {"metodo": "modelo de decisão por ata (modelo/treinar.py), sem IA no treino", "gerado_em": agora,
           "n_atas": int(len(treino)), "variaveis": VARS,
           "hiperparametros": {"logistica": "StandardScaler + LogisticRegression(C=0.5, max_iter=2000)",
                               "floresta": "RandomForestClassifier(n_estimators=300, max_depth=3, random_state=42)",
                               "arvore": "DecisionTreeClassifier(max_depth=2, random_state=42)"},
           "validacao_tempo": {"inicio_ata": int(atas[INICIO]), "fim_ata": int(atas[-1]), "n": int(len(treino) - INICIO),
                               "metodos": vt},
           "validacao_loo": {"n": int(len(treino)), "metodos": loo},
           "melhor": melhor, "melhor_nao_ingenuo": melhor_nao_ing, "destaque_viradas": destaque,
           "coeficientes_logistica": coef, "importancias_floresta": imp,
           "regra_arvore_pt": regra, "regra_arvore_texto": regra_txt,
           "previsao_atual": previsao_atual,
           "acuracia_previsao_decisao": vt[melhor]["acuracia"]}
    (B / "metricas_modelo.json").write_text(json.dumps(met, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"melhor: {melhor} | melhor não ingênuo: {melhor_nao_ing} | destaque: {destaque}")
    print("importâncias:", imp[:3])
    print("regra:\n" + regra)
    print("previsão:", previsao_atual)
    return 0


if __name__ == "__main__":
    sys.exit(main())
