"""Modelo v3: histórico recente de decisões (DECISOES.md). Sem Claude. Saída: modelo/v3_resultado.json."""
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import treinar as T  # noqa: E402
import v2_comparar as V  # noqa: E402

RAIZ = T.RAIZ
ANT = [f"decisao_anterior_{c}" for c in T.CLASSES]
NOVAS = ["variacao_taxa_atual"] + ANT + ["variacao_taxa_anterior", "reunioes_na_mesma_direcao"]
CONJ = {"A": T.VARS, "D": T.VARS + NOVAS,
        "E": list(T.DEC) + NOVAS + ["tom_nivel", "tom_variacao"]}
COMB = [("A", "log03"), ("D", "log03"), ("D", "log01"), ("D", "floresta"),
        ("E", "log03"), ("E", "log01"), ("E", "floresta")]


def historico():
    atas = sorted(json.loads((RAIZ / "banco" / "atas.json").read_text(encoding="utf-8")), key=lambda a: a["numero"])
    linhas, prev_d, prev_pp, seq = [], "manutencao", 0.0, 1  # 235: manutenção, 0, 1 (DECISOES.md)
    for a in atas:
        d = {"baixa": "corte"}.get(a["decisao"], a["decisao"])
        seq = seq + 1 if d == prev_d else 1
        r = {"ata": a["numero"], "variacao_taxa_atual": float(a["decisao_pp"]),
             "variacao_taxa_anterior": prev_pp, "reunioes_na_mesma_direcao": float(seq)}
        for c in T.CLASSES:
            r[f"decisao_anterior_{c}"] = float(prev_d == c)
        linhas.append(r)
        prev_d, prev_pp = d, float(a["decisao_pp"])
    return pd.DataFrame(linhas)


def matriz(df, vars_):
    X = pd.DataFrame({f"decisao_registrada_na_ata_{c}": (df["decisao_registrada_na_ata"] == c).astype(float)
                      for c in T.CLASSES})
    for v in list(T.NUM) + NOVAS:
        X[v] = df[v].astype(float)
    return X[vars_].values


def main():
    df = pd.read_csv(RAIZ / "modelo" / "base_modelo.csv").merge(historico(), on="ata", how="left")
    tr = df[df["proxima_decisao"].notna()].reset_index(drop=True)
    y = tr["proxima_decisao"].values
    atas = list(tr["ata"])
    i251, i271, i282 = atas.index(251), atas.index(271), len(atas)
    esc = {}
    for c, m in COMB:
        r = V.janela(matriz(tr, CONJ[c]), y, m, i251, i271)
        esc[f"{c}-{m}"] = r
        print(f"ESCOLHA {c}-{m}: {r['acertos']}/{r['n']} acc {r['acuracia']} bal {r['acuracia_balanceada']}")
    chave = max(esc, key=lambda k: (esc[k]["acuracia"], esc[k]["acuracia_balanceada"],
                                    -V.SIMPLES[k.split('-')[1]], -"AED".index(k[0])))
    print("ESCOLHIDO:", chave)
    conf = {}
    for k in dict.fromkeys([chave, "A-log03"]):
        c, m = k.split("-")
        conf[k] = V.janela(matriz(tr, CONJ[c]), y, m, i271, i282)
        print(f"CONFIRMACAO {k}: {conf[k]['acertos']}/{conf[k]['n']} acc {conf[k]['acuracia']} "
              f"bal {conf[k]['acuracia_balanceada']}")
    out = {"escolha": {"atas": "251-270", "resultados": esc}, "escolhido": chave,
           "confirmacao": {"atas": "271-281", "resultados": conf}}
    (RAIZ / "modelo" / "v3_resultado.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
