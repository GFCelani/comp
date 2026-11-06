"""Modelo v4: histórico + interações + 2 variáveis contra erros (DECISOES.md). Sem Claude. Saída: modelo/v4_resultado.json."""
import json
import sys
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
import treinar as T  # noqa: E402
import v2_comparar as V  # noqa: E402
import v3_comparar as V3  # noqa: E402

RAIZ = T.RAIZ
INT = [f"int_tomvar_x_decisao_{c}" for c in T.CLASSES] + ["int_virada_x_sequencia"]
ERROS = ["var_termos_cambio", "var_sinais_virada"]
CONJ = {"A": T.VARS, "F": T.VARS + V3.NOVAS + INT, "G": T.VARS + V3.NOVAS + INT + ERROS}
COMB = [("A", "log03"), ("F", "log03"), ("F", "log10"), ("F", "floresta"),
        ("G", "log03"), ("G", "log10"), ("G", "floresta")]
SIMPLES = {"log03": 1, "log10": 1, "floresta": 2}


def fabricar(nome):
    if nome == "log10":
        return make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=5000))
    if nome == "log03":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=5000))
    if nome == "floresta":
        return RandomForestClassifier(n_estimators=300, max_depth=3, min_samples_leaf=3, random_state=42)
    raise ValueError(nome)


V.fabricar = fabricar


def base():
    df = T_base = None
    import pandas as pd
    df = pd.read_csv(RAIZ / "modelo" / "base_modelo.csv").sort_values("ata").merge(V3.historico(), on="ata", how="left")
    for c in T.CLASSES:
        df[f"int_tomvar_x_decisao_{c}"] = df["tom_variacao"] * (df["decisao_registrada_na_ata"] == c).astype(float)
    df["int_virada_x_sequencia"] = df["sinais_virada"] * df["reunioes_na_mesma_direcao"]
    df["var_termos_cambio"] = df["termos_cambio"].diff().fillna(0.0)
    df["var_sinais_virada"] = df["sinais_virada"].diff().fillna(0.0)
    return df.reset_index(drop=True)


def matriz(df, vars_):
    import pandas as pd
    X = pd.DataFrame({f"decisao_registrada_na_ata_{c}": (df["decisao_registrada_na_ata"] == c).astype(float)
                      for c in T.CLASSES})
    for v in list(T.NUM) + V3.NOVAS + INT + ERROS:
        X[v] = df[v].astype(float).values
    return X[vars_].values


def main():
    df = base()
    tr = df[df["proxima_decisao"].notna()].reset_index(drop=True)
    y = tr["proxima_decisao"].values
    atas = list(tr["ata"])
    i251, i271, i282 = atas.index(251), atas.index(271), len(atas)
    assert atas[i282 - 1] == 281
    esc = {}
    for c, m in COMB:
        r = V.janela(matriz(tr, CONJ[c]), y, m, i251, i271)
        esc[f"{c}-{m}"] = r
        print(f"ESCOLHA {c}-{m}: {r['acertos']}/{r['n']} acc {r['acuracia']} bal {r['acuracia_balanceada']}")
    chave = max(esc, key=lambda k: (esc[k]["acuracia"], esc[k]["acuracia_balanceada"],
                                    -"AFG".index(k[0]), -SIMPLES[k.split('-')[1]], -int(k.endswith("log10"))))
    print("ESCOLHIDO:", chave)
    conf = {}
    for k in dict.fromkeys([chave, "A-log03"]):
        c, m = k.split("-")
        conf[k] = V.janela(matriz(tr, CONJ[c]), y, m, i271, i282)
        print(f"CONFIRMACAO {k}: {conf[k]['acertos']}/{conf[k]['n']} acc {conf[k]['acuracia']} "
              f"bal {conf[k]['acuracia_balanceada']}")
    out = {"escolha": {"atas": "251-270", "resultados": esc}, "escolhido": chave,
           "confirmacao": {"atas": "271-281", "resultados": conf}}
    (RAIZ / "modelo" / "v4_resultado.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
