"""Treina e valida o modelo de nota de tom (sem chamadas ao Claude).

Entrada: modelo/base_modelo.csv. Saídas: banco/metricas_modelo.json e banco/indice_modelo.json.
Candidatos: logística, floresta, árvore (hiperparâmetros fixos, DECISOES.md). Validação: janela crescente no
tempo a partir da 16ª ata. Escolha: maior acurácia, depois maior acurácia balanceada, depois o mais simples.
A previsão ingênua e a sensibilidade sem decisao_registrada_na_ata saem só no print (DECISOES.md).
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
NUM = {
    "tom_nivel": "índice de tom da ata", "tom_variacao": "variação do tom contra a ata anterior",
    "tom_media_3_atas": "média do tom nas últimas 3 atas",
    "tom_cenario_externo": "tom da seção de cenário externo (sem seção própria: 0)",
    "tom_cenario_domestico": "tom da seção de conjuntura",
    "tom_expectativas_projecoes": "tom da seção de expectativas (sem seção própria: 0)",
    "tom_balanco_riscos": "tom da seção de riscos", "tom_decisao_orientacao": "tom das seções de condução e decisão",
    "saldo_duro_brando": "saldo de parágrafos duros menos brandos", "proporcao_muito_duro": "parágrafos com nota +2",
    "proporcao_muito_brando": "parágrafos com nota −2", "dispersao_notas": "desvio-padrão das notas",
    "sinais_virada": "termos de virada na seção de decisão",
    "termos_inflacao": "termos de inflação por mil palavras",
    "termos_expectativas": "termos de expectativas por mil palavras",
    "termos_atividade": "termos de atividade por mil palavras",
    "termos_mercado_trabalho": "termos de mercado de trabalho por mil palavras",
    "termos_cambio": "termos de câmbio por mil palavras", "termos_fiscal": "termos fiscais por mil palavras",
    "termos_cenario_externo": "termos de cenário externo por mil palavras",
    "n_paragrafos": "número de parágrafos", "var_n_paragrafos": "variação do número de parágrafos",
}
DEC = {f"decisao_registrada_na_ata_{c}": f"decisão registrada na ata = {c}" for c in CLASSES}
DESC = {**DEC, **NUM}
VARS = list(DEC) + list(NUM)
INICIO = 15
ORDEM = ["arvore", "logistica", "floresta"]  # do mais simples ao mais complexo
HIPER = {"logistica": "StandardScaler + LogisticRegression(C=0.3, max_iter=5000)",
         "floresta": "RandomForestClassifier(n_estimators=300, max_depth=3, min_samples_leaf=3, random_state=42)",
         "arvore": "DecisionTreeClassifier(max_depth=2, random_state=42)"}
ROT = {"alta": "alta", "manutencao": "manutenção", "corte": "corte"}


def fabricar(nome):
    if nome == "logistica":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=5000))
    if nome == "floresta":
        return RandomForestClassifier(n_estimators=300, max_depth=3, min_samples_leaf=3, random_state=42)
    if nome == "arvore":
        return DecisionTreeClassifier(max_depth=2, random_state=42)
    raise ValueError(nome)


def matriz(df, vars_=VARS):
    X = pd.DataFrame({f"decisao_registrada_na_ata_{c}": (df["decisao_registrada_na_ata"] == c).astype(float)
                      for c in CLASSES})
    for v in NUM:
        X[v] = df[v].astype(float)
    return X[vars_].values


def proba3(m, X):
    p = m.predict_proba(X)
    cl = list(m.classes_) if hasattr(m, "classes_") else list(m[-1].classes_)
    out = np.zeros((len(X), 3))
    for j, c in enumerate(cl):
        out[:, CLASSES.index(c)] = p[:, j]
    return out


def ajustar_prever(nome, Xtr, ytr, Xte):
    if len(set(ytr)) == 1:
        p = np.array([[1.0 if c == ytr[0] else 0.0 for c in CLASSES]] * len(Xte))
    else:
        p = proba3(fabricar(nome).fit(Xtr, ytr), Xte)
    return [CLASSES[i] for i in p.argmax(1)], p


def resumo(y, prev, atual, atas, datas, probs):
    vir = [i for i in range(len(y)) if y[i] != atual[i]]
    return {"acuracia": round(float(np.mean([a == b for a, b in zip(y, prev)])), 3),
            "acuracia_balanceada": round(float(balanced_accuracy_score(y, prev)), 3),
            "n": len(y),
            "matriz_confusao": {"rotulos": CLASSES, "linhas": "realizado", "colunas": "previsto",
                                "valores": confusion_matrix(y, prev, labels=CLASSES).tolist()},
            "viradas": {"acertos": int(sum(prev[i] == y[i] for i in vir)), "total": len(vir)},
            "previsoes_ata_a_ata": [{"ata": int(a), "data_reuniao": str(d), "previsto": p, "realizado": r,
                                     "acertou": bool(p == r),
                                     "probabilidades": {c: round(float(q[k]), 3) for k, c in enumerate(CLASSES)}}
                                    for a, d, p, r, q in zip(atas, datas, prev, y, probs)]}


def validar(X, y, atual, atas, datas, nome):
    prev, probs = [], []
    for t in range(INICIO, len(y)):
        p, q = ajustar_prever(nome, X[:t], y[:t], X[t:t + 1])
        prev += p
        probs.append(q[0])
    return resumo(list(y[INICIO:]), prev, list(atual[INICIO:]), atas[INICIO:], datas[INICIO:], probs)


def regra_pt(arv):
    tr = arv.tree_

    def cond(f, lim, esq):
        v = VARS[f]
        if v.startswith("decisao_registrada_na_ata_"):
            c = ROT[v[len("decisao_registrada_na_ata_"):]]
            return f"a decisão registrada na ata não é {c}" if esq else f"a decisão registrada na ata é {c}"
        n = f"{lim:.2f}".replace(".", ",")
        return f"{DESC[v]} ≤ {n}" if esq else f"{DESC[v]} > {n}"

    frases = []

    def andar(no, conds):
        if tr.children_left[no] == -1:
            c = arv.classes_[int(np.argmax(tr.value[no][0]))]
            frases.append("Se " + " e ".join(conds) + f", prevê {ROT[c]}.")
            return
        andar(tr.children_left[no], conds + [cond(tr.feature[no], tr.threshold[no], True)])
        andar(tr.children_right[no], conds + [cond(tr.feature[no], tr.threshold[no], False)])

    andar(0, [])
    return "\n".join(frases)


def main() -> int:
    df = pd.read_csv(RAIZ / "modelo" / "base_modelo.csv")
    treino = df[df["proxima_decisao"].notna()].reset_index(drop=True)
    X, y = matriz(treino), treino["proxima_decisao"].values
    atual, atas, datas = treino["decisao_registrada_na_ata"].values, treino["ata"].values, treino["data_reuniao"].values

    vt = {n: validar(X, y, atual, atas, datas, n) for n in ORDEM}
    for n in ORDEM:
        print(f"{n:10s} acc {vt[n]['acuracia']} bal {vt[n]['acuracia_balanceada']} viradas "
              f"{vt[n]['viradas']['acertos']}/{vt[n]['viradas']['total']}")
    melhor = max(ORDEM, key=lambda n: (vt[n]["acuracia"], vt[n]["acuracia_balanceada"], -ORDEM.index(n)))

    sem = [v for v in VARS if v not in DEC]
    Xs = matriz(treino, sem)
    for n in ORDEM:
        r = validar(Xs, y, atual, atas, datas, n)
        print(f"SENSIBILIDADE sem decisao_registrada_na_ata: {n} acc {r['acuracia']} bal {r['acuracia_balanceada']} "
              f"viradas {r['viradas']['acertos']}/{r['viradas']['total']}")
    ing = resumo(list(y[INICIO:]), list(atual[INICIO:]), list(atual[INICIO:]), atas[INICIO:], datas[INICIO:],
                 [[1.0 if d == c else 0.0 for c in CLASSES] for d in atual[INICIO:]])
    print(f"INGENUA (só DECISOES.md): acc {ing['acuracia']} bal {ing['acuracia_balanceada']} viradas "
          f"{ing['viradas']['acertos']}/{ing['viradas']['total']}")

    modelo = fabricar(melhor).fit(X, y)
    pi = permutation_importance(modelo, X, y, n_repeats=30, random_state=42)
    variaveis = sorted(({"nome": v, "descricao": DESC[v], "importancia": round(float(pi.importances_mean[j]), 4)}
                        for j, v in enumerate(VARS)), key=lambda d: -d["importancia"])
    lr = fabricar("logistica").fit(X, y)[-1]
    coef = {c: {v: round(float(lr.coef_[i][j]), 3) for j, v in enumerate(VARS)} for i, c in enumerate(lr.classes_)}
    arv = fabricar("arvore").fit(X, y)
    regra = regra_pt(arv)

    lp = treino.iloc[[-1]]
    q = proba3(modelo, matriz(lp))[0]
    probs = {c: round(float(q[k]), 3) for k, c in enumerate(CLASSES)}
    previsao_atual = {"reuniao": int(lp["ata"].iloc[0]) + 2, "data": "2026-12-09", "ata_base": int(lp["ata"].iloc[0]),
                      "observacao": "a ata da reunião 282 ainda não saiu; a previsão usa a última ata publicada (281)",
                      "probabilidades": probs, "previsto": max(probs, key=probs.get)}

    agora = datetime.now().isoformat(timespec="seconds")
    v = vt[melhor]
    met = {"tipo": melhor, "gerado_em": agora,
           "descricao": "modelo de nota de tom: todas as variáveis vêm das atas e das notas dos parágrafos",
           "hiperparametros": {n: HIPER[n] for n in ORDEM}, "variaveis": variaveis,
           "coeficientes": coef if melhor == "logistica" else None,
           "coeficientes_logistica": coef, "regra_arvore_pt": regra,
           "regra_arvore_texto": export_text(arv, feature_names=VARS, decimals=2),
           "metricas": {"acuracia": v["acuracia"], "acuracia_balanceada": v["acuracia_balanceada"], "n": v["n"],
                        "periodo": {"inicio_ata": int(atas[INICIO]), "fim_ata": int(atas[-1]),
                                    "inicio": str(datas[INICIO]), "fim": str(datas[-1])}},
           "matriz_confusao": v["matriz_confusao"], "viradas": v["viradas"],
           "previsoes_ata_a_ata": v["previsoes_ata_a_ata"], "previsao_atual": previsao_atual,
           "acuracia_previsao_decisao": v["acuracia"],
           "candidatos": {n: {"hiperparametros": HIPER[n], "acuracia": vt[n]["acuracia"],
                              "acuracia_balanceada": vt[n]["acuracia_balanceada"], "n": vt[n]["n"],
                              "matriz_confusao": vt[n]["matriz_confusao"], "viradas": vt[n]["viradas"],
                              "previsoes_ata_a_ata": vt[n]["previsoes_ata_a_ata"]} for n in ORDEM},
           "criterio_escolha": "maior acurácia na validação no tempo; empate: maior acurácia balanceada, "
                               "depois o mais simples (árvore, logística, floresta)",
           "n_atas_treino": int(len(treino)),
           # compatibilidade com o painel atual (site/components/painel/modelo.ts)
           "modelo_publicado": melhor,
           "importancias": [{"variavel": d["nome"], "importancia": d["importancia"]} for d in variaveis],
           "descricoes_variaveis": DESC,
           "validacao_tempo": {"inicio_ata": int(atas[INICIO]), "fim_ata": int(atas[-1]), "n": v["n"],
                               "metodos": {n: {**{k: vt[n][k] for k in ("acuracia", "acuracia_balanceada",
                                                                        "matriz_confusao", "viradas")},
                                               "previsoes": vt[n]["previsoes_ata_a_ata"]} for n in ORDEM}}}
    # Validação deixando uma ata de fora por vez, com o modelo publicado, em todas as atas com alvo
    loo_prev = []
    for i in range(len(y)):
        fica = np.arange(len(y)) != i
        loo_prev += ajustar_prever(melhor, X[fica], y[fica], X[i:i + 1])[0]
    met["validacao_loo"] = {"n": int(len(y)), "metodos": {melhor: {
        "acuracia": round(float(np.mean([a == b for a, b in zip(y, loo_prev)])), 3),
        "acuracia_balanceada": round(float(balanced_accuracy_score(list(y), loo_prev)), 3), "n": int(len(y))}}}
    print("LOO:", met["validacao_loo"])
    previsao_atual["por_modelo"] = {melhor: probs}
    (B / "metricas_modelo.json").write_text(json.dumps(met, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fora = {p["ata"]: p["probabilidades"] for p in v["previsoes_ata_a_ata"]}
    dentro = proba3(fabricar(melhor).fit(X[:INICIO], y[:INICIO]), X[:INICIO])
    itens = []
    for i, a in enumerate(atas):
        if a in fora:
            pr, am = fora[a], "fora"
        else:
            pr, am = {c: round(float(dentro[i][k]), 3) for k, c in enumerate(CLASSES)}, "dentro"
        itens.append({"ata": int(a), "data_reuniao": str(datas[i]), "indice": round(pr["alta"] - pr["corte"], 3),
                      "amostra": am, "probabilidades": pr})
    idx = {"metodo": f"modelo {melhor}: P(alta) − P(corte) da reunião seguinte; fora da amostra (janela no tempo) "
                     f"da ata {int(atas[INICIO])} em diante, dentro da amostra antes",
           "gerado_em": agora, "previsao_283": previsao_atual, "atas": sorted(itens, key=lambda d: -d["ata"])}
    (B / "indice_modelo.json").write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ESCOLHIDO: {melhor}")
    print("TOP5:", [(d["nome"], d["importancia"]) for d in variaveis[:5]])
    print("REGRA:\n" + regra)
    print("PREVISAO:", previsao_atual)
    return 0


if __name__ == "__main__":
    sys.exit(main())
