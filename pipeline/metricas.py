"""
Compara o índice de cada ata com a decisão da reunião seguinte → banco/metricas_previsao.json.

    .venv/Scripts/python.exe pipeline/metricas.py

Regra fixa (não ajustada para vencer a base): indice > 0,25 → aperto; < -0,25 → afrouxamento;
senão manutenção. Base ingênua: repete a decisão da reunião atual como previsão da próxima.
Usa banco/indice_modelo.json quando existir (fonte_indice = "modelo"), senão banco/indice.json.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_INDICE = RAIZ / "banco" / "indice.json"
ARQ_INDICE_MODELO = RAIZ / "banco" / "indice_modelo.json"
ARQ_SAIDA = RAIZ / "banco" / "metricas_previsao.json"

LIMIAR = 0.25
ROTULOS = ["afrouxamento", "manutencao", "aperto"]
DECISAO = {"alta": "aperto", "corte": "afrouxamento", "manutencao": "manutencao"}


def prever(indice: float | None) -> str:
    if indice is None:
        return "manutencao"
    return "aperto" if indice > LIMIAR else "afrouxamento" if indice < -LIMIAR else "manutencao"


def avaliar(itens: list[dict]) -> dict:
    n = len(itens)
    matriz = [[0] * 3 for _ in range(3)]
    for it in itens:
        matriz[ROTULOS.index(it["previsto"])][ROTULOS.index(it["realizado"])] += 1
    direcionais = [it for it in itens if it["previsto"] != "manutencao"]
    return {"acuracia": round(sum(it["acertou"] for it in itens) / n, 3) if n else None,
            "acerto_sinal": round(sum(it["previsto"] == it["realizado"] for it in direcionais) / len(direcionais), 3)
            if direcionais else None,
            "n_previsoes_direcionais": len(direcionais),
            "matriz_confusao": {"rotulos": ROTULOS, "valores": matriz},
            "atas": itens}


def main() -> int:
    fonte = "modelo" if ARQ_INDICE_MODELO.exists() else "simples"
    indice = json.loads((ARQ_INDICE_MODELO if fonte == "modelo" else ARQ_INDICE).read_text(encoding="utf-8"))
    por_ata = {a["ata"]: a["indice"] for a in indice["atas"]}
    atas = sorted(json.loads(ARQ_ATAS.read_text(encoding="utf-8")), key=lambda a: a["numero"], reverse=True)

    it_ind, it_ing = [], []
    for a in atas:
        if a["numero"] not in por_ata or not a.get("proxima_decisao") or not a.get("decisao"):
            continue                                  # última ata (sem decisão seguinte) ou sem rótulos
        realizado = DECISAO[a["proxima_decisao"]]
        p = prever(por_ata[a["numero"]])
        it_ind.append({"ata": a["numero"], "data_reuniao": a["data_reuniao"], "indice": por_ata[a["numero"]],
                       "previsto": p, "realizado": realizado, "variacao_pp": a["proxima_decisao_pp"],
                       "acertou": p == realizado})
        q = DECISAO[a["decisao"]]
        it_ing.append({"ata": a["numero"], "data_reuniao": a["data_reuniao"], "previsto": q,
                       "realizado": realizado, "acertou": q == realizado})

    ind, ing = avaliar(it_ind), avaliar(it_ing)
    melhor = ("empate" if ind["acuracia"] == ing["acuracia"]
              else "indice" if (ind["acuracia"] or 0) > (ing["acuracia"] or 0) else "ingenua")
    datas = [i["data_reuniao"] for i in it_ind]
    corpo = {"regra": {"aperto": "indice > 0.25", "afrouxamento": "indice < -0.25",
                       "manutencao": "entre -0.25 e 0.25"},
             "fonte_indice": fonte, "n_atas": len(it_ind),
             "periodo": {"inicio": min(datas), "fim": max(datas)} if datas else None,
             "indice": ind, "ingenua": ing, "melhor": melhor}
    if ARQ_SAIDA.exists():
        antigo = json.loads(ARQ_SAIDA.read_text(encoding="utf-8"))
        antigo.pop("gerado_em", None)
        if antigo == corpo:
            print(f"Métricas sem mudanças (fonte {fonte}).")
            return 0
    saida = {"regra": corpo["regra"], "fonte_indice": fonte, "gerado_em": datetime.now().isoformat(timespec="seconds"),
             **{k: v for k, v in corpo.items() if k not in ("regra", "fonte_indice")}}
    ARQ_SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"banco/metricas_previsao.json (fonte {fonte}, {len(it_ind)} atas): índice acurácia {ind['acuracia']} "
          f"sinal {ind['acerto_sinal']} | ingênua acurácia {ing['acuracia']} sinal {ing['acerto_sinal']} "
          f"| melhor: {melhor}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
