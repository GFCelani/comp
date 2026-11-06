"""
Teste FORA DA AMOSTRA: aplica o modelo congelado (estimador e escalas de resultados/calibracao.json,
ajustados só com atas de 2021+) a atas de 2020 que nunca foram usadas para montar regras, pesos ou
escolher o estimador.

    .venv/bin/python scripts/isolar_reacao.py dados/holdout/analistas.jsonl dados/holdout/reacao.csv
    .venv/bin/python scripts/teste_fora.py

Entradas: dados/holdout/{lotes,rotulos,reacao.csv}, resultados/calibracao.json
Saída:    resultados/teste_fora_amostra.json
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from indice import concordancia, nivel_ponderado, segunda_leitura
from lexico import placar_ata

RAIZ = Path(__file__).resolve().parents[1]
H = RAIZ / "dados" / "holdout"


def metricas(p, t):
    p, t = np.asarray(p, float), np.asarray(t, float)
    ok = ~(np.isnan(p) | np.isnan(t)); p, t = p[ok], t[ok]
    d = np.abs(t) >= 0.5
    return {"n": int(ok.sum()),
            "correlacao": round(float(np.corrcoef(p, t)[0, 1]), 3) if ok.sum() > 2 and t.std() > 0 else None,
            "acerto_direcao": round(float((np.sign(p[d]) == np.sign(t[d])).mean()), 3) if d.any() else None,
            "n_direcionais": int(d.sum()), "erro_medio_abs": round(float(np.abs(p - t).mean()), 3),
            "erro_base_zero": round(float(np.abs(t).mean()), 3)}


if __name__ == "__main__":
    cg = json.loads((RAIZ / "resultados" / "calibracao.json").read_text(encoding="utf-8"))["congelado"]
    lotes = {int(f.stem.split("_")[1]): json.loads(f.read_text(encoding="utf-8")) for f in (H / "lotes").glob("ata_*.json")}
    lex = {n: placar_ata(l)["lex_nivel"] for n, l in lotes.items()}
    linhas = []
    for f in sorted((H / "rotulos").glob("ata_*.json")):
        r = json.loads(f.read_text(encoding="utf-8"))
        n = r["ata"]
        df = pd.DataFrame(r["paragrafos"])
        df["confianca"] = pd.to_numeric(df.get("confianca", 0.7), errors="coerce").fillna(0.7)
        soma = sum(m.get("direcao", 0) for m in r.get("mudancas", []))
        mud = float(2 * np.tanh(soma / 4))
        cs = float(r["resumo"]["surpresa"])
        ld = (lex[n] - lex[n - 1]) if (n - 1) in lex else 0.0
        ldz = float(np.clip(ld / cg["lex_delta_dp"], -2, 2))
        conc = concordancia([cs, mud, ldz])
        enc = cs * (0.5 + 0.5 * conc)
        seg = segunda_leitura(n)
        cand = {"claude_surpresa": cs, "claude_encolhida": enc, "media_sinais": None,
                "claude_mudancas": (cs + mud) / 2, "duas_leituras": enc if np.isnan(seg) else (enc + seg) / 2}
        linhas.append({"ata": n, "nivel": (nivel_ponderado(df) + float(r["resumo"]["tom_nivel"])) / 2,
                       "claude_surpresa": cs, "mudancas": mud, "lex_delta_z": ldz,
                       "surpresa": cand.get(cg["estimador"], cs), "concord": conc})
    a = pd.DataFrame(linhas)
    reac = pd.read_csv(H / "reacao.csv")
    a = a.merge(reac[["ata", "surpresa_analistas", "rotulo_surpresa", "z_mercado", "peso_mercado", "veredito"]], on="ata", how="left")
    limpo = a[a["peso_mercado"] > 0]
    tau = cg["limiar_zona_neutra"]
    prev = np.where(a["surpresa"].abs() >= tau, np.sign(a["surpresa"]), 0)
    real = np.where(a["surpresa_analistas"].abs() >= 0.5, np.sign(a["surpresa_analistas"]), 0)
    ok = a["surpresa_analistas"].notna().to_numpy()
    a["direcao_prevista"] = prev
    direcao = {"limiar_congelado": tau, "n": int(ok.sum()),
               "acuracia_3_classes_vs_analistas": round(float((prev[ok] == real[ok]).mean()), 3),
               "base_sempre_em_linha": round(float((real[ok] == 0).mean()), 3),
               "erros_de_sinal_trocado": int(((prev * real)[ok] < 0).sum()),
               "direcoes_apontadas": int((prev[ok] != 0).sum()),
               "acertos_quando_aponta": int(((prev == real) & (prev != 0))[ok].sum())}
    res = {"atas": sorted(a["ata"].tolist()), "estimador_congelado": cg["estimador"],
           "vs_rotulo_combinado": metricas(a["surpresa"], a["rotulo_surpresa"]),
           "vs_analistas": metricas(a["surpresa"], a["surpresa_analistas"]),
           "vs_mercado_z_dias_limpos": metricas(limpo["surpresa"], limpo["z_mercado"].clip(-2, 2)),
           "claude_cru_vs_analistas": metricas(a["claude_surpresa"], a["surpresa_analistas"]),
           "direcao": direcao,
           "por_ata": a.round(2).to_dict(orient="records"),
           "nota": "Modelo congelado com atas 2021–2026; atas de 2020 nunca vistas. n pequeno: ler como "
                   "checagem de sanidade, não como estimativa precisa."}
    (RAIZ / "resultados" / "teste_fora_amostra.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(a[["ata", "surpresa", "claude_surpresa", "surpresa_analistas", "veredito", "z_mercado", "peso_mercado"]].round(2).to_string(index=False))
    print(direcao); print({k: res[k] for k in ("vs_rotulo_combinado", "vs_analistas", "vs_mercado_z_dias_limpos", "claude_cru_vs_analistas")})
