"""
Análise de forças e fraquezas do modelo publicado (logística) sobre as 31 previsões da validação no tempo.
Só lê banco/ e modelo/base_modelo.csv; grava modelo/forcas_fraquezas.json e modelo/analise_erros.md.

    .venv/Scripts/python.exe modelo/analise_erros.py
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from treinar import CLASSES, DESC, VARS, fabricar, matriz  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
B = RAIZ / "banco"
ROT = {"alta": "alta", "manutencao": "manutenção", "corte": "corte"}


CONCLUSAO = {
    "confiavel": "Nas continuações (a próxima decisão repete a da ata): 21 de 25 acertos (84%). "
                 "Quando prevê corte, acerta 9 de 10 (precisão 90%).",
    "falha": "Nas viradas de ciclo: 2 de 6 acertos (33%). Em geral percebe a mudança 1 ou 2 reuniões depois, "
             "e não percebeu a pausa que veio depois da ata 281. Com probabilidade acima de 75% acerta 75% (15 de 20), "
             "abaixo da confiança média de 88%: o modelo é confiante demais.",
    "porque": "A variável mais forte é a decisão registrada na própria ata, que empurra para repetir a decisão. "
              "Nos erros, sinais_virada, termos de câmbio e de atividade puxaram para o lado errado. "
              "O Brier multiclasse (0,399) ficou pior que o da regra ingênua de repetir a decisão (0,387), "
              "e a regra ingênua acerta 25 de 31 (as continuações). Amostra pequena: 31 previsões e só 6 viradas.",
    "proximos_passos": [
        "Medir o modelo sempre ao lado da regra ingênua e só publicá-lo se ganhar dela na acurácia ou no Brier.",
        "Calibrar as probabilidades (por exemplo, regularização mais forte ou calibração por temperatura na "
        "validação no tempo) para que 88% de confiança média corresponda a acerto parecido.",
        "Criar e testar variáveis próprias de virada (mudança na orientação futura entre atas, Focus da Selic) "
        "e avaliar o modelo pela acurácia nas viradas, não só no total.",
    ],
}


def tabela(cab, linhas):
    f = lambda v: "—" if v is None else (f"{v:.1%}".replace(".", ",") if isinstance(v, float) and v <= 1 else str(v))
    return "\n".join(["| " + " | ".join(cab) + " |", "|" + "---|" * len(cab)] +
                     ["| " + " | ".join(f(v) for v in l) + " |" for l in linhas]) + "\n"


def markdown(d):
    pr = lambda q: " / ".join(f"{ROT[c]} {q[c]:.0%}" for c in CLASSES)
    g = d["acuracia_geral"]
    s = [f"# Forças e fraquezas do modelo publicado\n",
         f"Gerado por `modelo/analise_erros.py` em {d['gerado_em']}. Modelo: {d['modelo']} ({d['hiperparametros']}). "
         f"Validação no tempo, atas {d['periodo']['atas']} ({d['periodo']['inicio']} a {d['periodo']['fim']}): "
         f"{g['acertos']} acertos em {g['n']} previsões ({g['acuracia']:.1%}).\n",
         "**Amostra pequena:** 31 previsões e 6 viradas. Uma ata a mais ou a menos muda as taxas em vários pontos.\n",
         "## 1. Por classe\n",
         tabela(["classe", "previstas", "realizadas", "acertos", "precisão", "cobertura"],
                [[ROT[c["classe"]], c["n_previsto"], c["n_realizado"], c["acertos"], c["precisao"], c["cobertura"]]
                 for c in d["por_classe"]]),
         "\n## 2. Viradas contra continuações\n",
         tabela(["grupo", "n", "acertos", "acurácia"],
                [["viradas", d["viradas"]["n"], d["viradas"]["acertos"], d["viradas"]["acuracia"]],
                 ["continuações", d["continuacoes"]["n"], d["continuacoes"]["acertos"], d["continuacoes"]["acuracia"]]]),
         "\nDemora para perceber cada virada (0 = acertou na própria virada; k = passou a prever a nova decisão k reuniões depois):\n\n",
         tabela(["ata", "data", "de", "para", "previsto na virada", "reuniões até perceber"],
                [[v["ata"], v["data_reuniao"], ROT[v["de"]], ROT[v["para"]], ROT[v["previsto_na_virada"]],
                  v["reunioes_ate_perceber"]] for v in d["viradas"]["demora"]]),
         "\nA virada da ata 281 (corte → manutenção) é a última do período: não há reuniões depois dela no teste.\n",
         "\n## 3. Por fase\n",
         "Fases definidas pelas sequências de decisões em `banco/atas.json`. Cada previsão conta na fase da reunião que ela prevê "
         "(a seguinte). A previsão da ata 281 prevê a reunião 282, que ainda não está em atas.json; ela fica fora das fases.\n\n",
         tabela(["fase", "atas", "início", "fim", "atas na fase", "previsões testadas", "acertos", "acurácia"],
                [[f["fase"], f["atas"], f["inicio"], f["fim"], f["n_atas_na_fase"], f["n"],
                  f["acertos"] if f["n"] else None, f["acuracia"]] for f in d["por_fase"]]),
         "\nFora do teste: o ciclo de altas 2021–2022 (e a manutenção inicial de 2021), porque a validação começa na ata 251. "
         "A pausa de 2022–2023 só entra em parte (4 de 7 atas).\n",
         "\n## 4. Confiança e calibração\n",
         tabela(["maior probabilidade", "n", "acertos", "acurácia"],
                [["acima de 60%", d["confianca"]["acima"]["n"], d["confianca"]["acima"]["acertos"], d["confianca"]["acima"]["acuracia"]],
                 ["até 60%", d["confianca"]["abaixo"]["n"], d["confianca"]["abaixo"]["acertos"], d["confianca"]["abaixo"]["acuracia"]]]),
         "\n", tabela(["faixa", "n", "prob. média", "acerto real"],
                      [[c["faixa"], c["n"], c["prob_media"], c["acerto"]] for c in d["confianca"]["calibracao"]]),
         f"\nBrier multiclasse: {d['confianca']['brier']} (regra ingênua de repetir a decisão da ata: "
         f"{d['confianca']['brier_ingenua']}; menor é melhor).\n",
         "\n## 5. Erros\n",
         "Contribuição = coef(prevista) × valor padronizado − coef(realizada) × valor padronizado, na logística treinada "
         f"só com as atas anteriores (o reajuste reproduz as probabilidades publicadas com diferença máxima de "
         f"{d['conferencia_reajuste']['max_diferenca_prob']}).\n\n",
         tabela(["ata", "data", "previsto", "realizado", "probabilidades", "puxaram para o erro"],
                [[e["ata"], e["data_reuniao"], ROT[e["previsto"]], ROT[e["realizado"]], pr(e["probabilidades"]),
                  "; ".join(f"{p['variavel']} (+{p['contribuicao']})" for p in e["puxaram_errado"])
                  if e["puxaram_errado"] else e["nota"]] for e in d["erros"]]),
         "\n## 6. Conclusão\n",
         f"- **Onde é confiável:** {d['conclusao']['confiavel']}\n",
         f"- **Onde falha:** {d['conclusao']['falha']}\n",
         f"- **Por quê:** {d['conclusao']['porque']}\n",
         "\nPróximos passos (não executados):\n\n" + "\n".join(f"{i}. {p}" for i, p in enumerate(d['conclusao']['proximos_passos'], 1)) + "\n"]
    return "\n".join(x.strip("\n") + "\n" for x in s if x.strip())


def acc(lst):
    n = len(lst)
    a = int(sum(lst))
    return {"n": n, "acertos": a, "acuracia": round(a / n, 3) if n else None}


def main():
    met = json.loads((B / "metricas_modelo.json").read_text(encoding="utf-8"))
    prevs = met["previsoes_ata_a_ata"]
    atas_j = sorted(json.loads((B / "atas.json").read_text(encoding="utf-8")), key=lambda a: a["numero"])
    dec_ata = {a["numero"]: a["decisao"] for a in atas_j}
    data_ata = {a["numero"]: a["data_reuniao"] for a in atas_j}

    df = pd.read_csv(RAIZ / "modelo" / "base_modelo.csv")
    treino = df[df["proxima_decisao"].notna()].reset_index(drop=True)
    X, y = matriz(treino), treino["proxima_decisao"].values
    atual = treino["decisao_registrada_na_ata"].values
    pos = {int(a): i for i, a in enumerate(treino["ata"].values)}

    prev = [p["previsto"] for p in prevs]
    real = [p["realizado"] for p in prevs]
    ok = [p["acertou"] for p in prevs]
    probs = [[p["probabilidades"][c] for c in CLASSES] for p in prevs]
    reg = [atual[pos[p["ata"]]] for p in prevs]

    # 1. por classe
    por_classe = []
    for c in CLASSES:
        npv = sum(v == c for v in prev)
        nre = sum(v == c for v in real)
        tp = sum(a == c and b == c for a, b in zip(prev, real))
        por_classe.append({"classe": c, "n_previsto": npv, "n_realizado": nre, "acertos": tp,
                           "precisao": round(tp / npv, 3) if npv else None,
                           "cobertura": round(tp / nre, 3) if nre else None})

    # 2. viradas
    vir_idx = [i for i in range(len(prevs)) if real[i] != reg[i]]
    cont_idx = [i for i in range(len(prevs)) if real[i] == reg[i]]
    demora = []
    for i in vir_idx:
        para = real[i]
        k = None
        j = i
        while j < len(prevs) and real[j] == para:
            if prev[j] == para:
                k = j - i
                break
            j += 1
        demora.append({"ata": prevs[i]["ata"], "data_reuniao": prevs[i]["data_reuniao"], "de": reg[i], "para": para,
                       "previsto_na_virada": prev[i],
                       "reunioes_ate_perceber": k if k is not None else "não percebeu"})
    viradas = {**acc([ok[i] for i in vir_idx]), "demora": demora}
    continuacoes = acc([ok[i] for i in cont_idx])

    # 3. fases pela sequência de decisões em atas.json (decisão tomada na reunião)
    runs = []
    for a in atas_j:
        if runs and runs[-1]["decisao"] == a["decisao"]:
            runs[-1]["atas"].append(a["numero"])
        else:
            runs.append({"decisao": a["decisao"], "atas": [a["numero"]]})
    nomes = []
    for r in runs:
        d0 = data_ata[r["atas"][0]]
        ano = d0[:4]
        if r["decisao"] == "alta":
            nome = "ciclo de altas 2021–2022" if ano <= "2022" else "retomada das altas 2024–2025"
        elif r["decisao"] == "corte":
            nome = "ciclo de cortes 2023–2024" if ano <= "2024" else "cortes de 2026"
        else:
            a1 = data_ata[r["atas"][-1]][:4]
            nome = "manutenção inicial 2021" if a1 == "2021" else (f"pausa {ano}" if a1 == ano else f"pausa {ano}–{a1}")
        nomes.append(nome)
    fase_da_ata = {n: k for k, r in enumerate(runs) for n in r["atas"]}
    # cada previsão é atribuída à fase da reunião que ela prevê (ata seguinte)
    alvo = []
    for p in prevs:
        n = p["ata"] + 1
        if n in fase_da_ata:
            alvo.append(fase_da_ata[n])
        else:  # reunião seguinte ainda não está em atas.json: continua a última fase se a decisão bate
            alvo.append(len(runs) - 1 if runs[-1]["decisao"] == p["realizado"] else None)
    por_fase = []
    for k, r in enumerate(runs):
        idx = [i for i, f in enumerate(alvo) if f == k]
        por_fase.append({"fase": nomes[k], "decisao": r["decisao"], "inicio": data_ata[r["atas"][0]],
                         "fim": data_ata[r["atas"][-1]], "atas": f"{r['atas'][0]}–{r['atas'][-1]}",
                         "n_atas_na_fase": len(r["atas"]),
                         "n_previsoes_testadas": len(idx), **{kk: v for kk, v in acc([ok[i] for i in idx]).items()
                                                              if kk != "n"},
                         "n": len(idx),
                         "fora_do_teste": len(idx) == 0,
                         "parcial": 0 < len(idx) < len(r["atas"])})

    # 4. confiança e calibração
    pmax = [max(q) for q in probs]
    acima = acc([ok[i] for i in range(len(ok)) if pmax[i] > 0.6])
    abaixo = acc([ok[i] for i in range(len(ok)) if pmax[i] <= 0.6])
    faixas = [("<50%", 0, 0.5), ("50–60%", 0.5, 0.6), ("60–75%", 0.6, 0.75), (">75%", 0.75, 1.01)]
    calib = []
    for nome, lo, hi in faixas:
        if nome == "50–60%":
            idx = [i for i in range(len(ok)) if 0.5 <= pmax[i] <= 0.6]
        elif nome == "60–75%":
            idx = [i for i in range(len(ok)) if 0.6 < pmax[i] < 0.75]
        else:
            idx = [i for i in range(len(ok)) if lo <= pmax[i] < hi]
        calib.append({"faixa": nome, "n": len(idx),
                      "prob_media": round(float(np.mean([pmax[i] for i in idx])), 3) if idx else None,
                      "acerto": round(float(np.mean([ok[i] for i in idx])), 3) if idx else None})
    Y = np.array([[1.0 if r == c else 0.0 for c in CLASSES] for r in real])
    brier = round(float(np.mean(np.sum((np.array(probs) - Y) ** 2, axis=1))), 3)
    # referência: ingênua (repete a decisão registrada, prob 1)
    Yi = np.array([[1.0 if r == c else 0.0 for c in CLASSES] for r in reg])
    brier_ing = round(float(np.mean(np.sum((Yi - Y) ** 2, axis=1))), 3)

    # 5. erros e contribuições, refazendo a janela de cada ata
    erros = []
    max_dif = 0.0
    for i, p in enumerate(prevs):
        t = pos[p["ata"]]
        m = fabricar("logistica").fit(X[:t], y[:t])
        q = m.predict_proba(X[t:t + 1])[0]
        cl = list(m[-1].classes_)
        q3 = [float(q[cl.index(c)]) if c in cl else 0.0 for c in CLASSES]
        max_dif = max(max_dif, max(abs(a - b) for a, b in zip(q3, probs[i])))
        if p["acertou"]:
            continue
        z = m[0].transform(X[t:t + 1])[0]
        coef = m[-1].coef_
        if p["previsto"] in cl and p["realizado"] in cl:
            ci, cj = cl.index(p["previsto"]), cl.index(p["realizado"])
            contr = (coef[ci] - coef[cj]) * z
            ordem = np.argsort(-contr)
            puxa = [{"variavel": DESC[VARS[j]], "codigo": VARS[j], "contribuicao": round(float(contr[j]), 3)}
                    for j in ordem[:3] if contr[j] > 0]
            nota = None
        else:
            puxa = None
            nota = (f"classe '{p['realizado']}' ausente do treino desta janela: "
                    "contribuição não calculável")
        erros.append({"ata": p["ata"], "data_reuniao": p["data_reuniao"], "decisao_registrada": reg[i],
                      "previsto": p["previsto"], "realizado": p["realizado"], "probabilidades": p["probabilidades"],
                      "puxaram_errado": puxa, "nota": nota})

    n = len(prevs)
    conclusao = CONCLUSAO
    out = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "modelo": met.get("tipo"), "hiperparametros": met.get("hiperparametros"),
        "periodo": {"atas": f"{prevs[0]['ata']}–{prevs[-1]['ata']}", "inicio": prevs[0]["data_reuniao"],
                    "fim": prevs[-1]["data_reuniao"], "n": n},
        "acuracia_geral": acc(ok),
        "por_classe": por_classe,
        "viradas": viradas,
        "continuacoes": continuacoes,
        "por_fase": por_fase,
        "confianca": {"limiar": 0.6, "acima": acima, "abaixo": abaixo, "calibracao": calib, "brier": brier,
                      "brier_ingenua": brier_ing,
                      "aviso": f"amostra pequena: {n} previsões; diferenças de poucas atas mudam muito as taxas"},
        "erros": erros,
        "conferencia_reajuste": {"max_diferenca_prob": round(max_dif, 4)},
        "conclusao": conclusao,
    }
    return out


if __name__ == "__main__":
    out = main()
    (RAIZ / "modelo" / "analise_erros.md").write_text(markdown(out), encoding="utf-8")
    (RAIZ / "modelo" / "forcas_fraquezas.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n",
                                                          encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=1))
