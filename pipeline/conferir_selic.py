"""
Confere a Selic e a decisão de cada reunião de banco/atas.json contra a tabela oficial do BC
(https://www.bcb.gov.br/controleinflacao/historicotaxasjuros) → saida/conferencia_selic.json.

    .venv/Scripts/python.exe pipeline/conferir_selic.py

Compara `selic_apos` com a MetaSelic da reunião e `decisao_pp`/`decisao` com a diferença para a
reunião ordinária anterior. Se GITHUB_OUTPUT existir, grava `divergencias=<n>`.
Sai com 0 mesmo se o BC não responder (grava `erro` no JSON).
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parents[1]
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_SAIDA = RAIZ / "saida" / "conferencia_selic.json"
FONTE = "https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def classificar(pp: float) -> str:
    return "alta" if pp > 0 else "corte" if pp < 0 else "manutencao"


def oficial() -> dict[int, dict]:
    erro = None
    for t in range(3):
        try:
            r = requests.get(FONTE, headers={"User-Agent": UA}, timeout=60)
            r.raise_for_status()
            itens = r.json()["conteudo"]
            break
        except Exception as e:
            erro = e
            time.sleep(5)
    else:
        raise RuntimeError(f"BC não respondeu: {erro}")
    # Uma linha por reunião (a vigência mais antiga é a decisão da própria reunião)
    por = {}
    for c in sorted(itens, key=lambda c: c.get("DataInicioVigencia") or ""):
        n = c.get("NumeroReuniaoCopom")
        if n is None or c.get("ReuniaoExtraordinaria") or c.get("MetaSelic") is None:
            continue
        por.setdefault(int(n), {"meta": float(c["MetaSelic"]), "data": (c.get("DataReuniaoCopom") or "")[:10]})
    return por


def main() -> int:
    agora = datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds")
    atas = json.loads(ARQ_ATAS.read_text(encoding="utf-8"))
    try:
        of = oficial()
    except Exception as e:
        saida = {"verificado_em": agora, "fonte_url": FONTE, "n_comparadas": 0, "divergencias": [], "erro": str(e)}
        print(f"Conferência da Selic não feita: {e}")
        divergencias = []
    else:
        divergencias, n = [], 0
        anteriores = sorted(of)
        for a in sorted(atas, key=lambda a: a["numero"]):
            o = of.get(a["numero"])
            if not o:
                continue
            n += 1
            if a.get("selic_apos") is None or abs(a["selic_apos"] - o["meta"]) > 1e-6:
                divergencias.append({"ata": a["numero"], "campo": "selic_apos", "banco": a.get("selic_apos"),
                                     "oficial": o["meta"]})
            prev = [k for k in anteriores if k < a["numero"]]
            if prev:
                pp = round(o["meta"] - of[prev[-1]]["meta"], 2)
                if a.get("decisao_pp") is None or abs(a["decisao_pp"] - pp) > 1e-6:
                    divergencias.append({"ata": a["numero"], "campo": "decisao_pp", "banco": a.get("decisao_pp"),
                                         "oficial": pp})
                if a.get("decisao") != classificar(pp):
                    divergencias.append({"ata": a["numero"], "campo": "decisao", "banco": a.get("decisao"),
                                         "oficial": classificar(pp)})
        saida = {"verificado_em": agora, "fonte_url": FONTE, "n_comparadas": n, "divergencias": divergencias}
        print(f"Conferência da Selic: {n} reuniões comparadas, {len(divergencias)} divergências"
              + (f": {divergencias}" if divergencias else ""))
    ARQ_SAIDA.parent.mkdir(exist_ok=True)
    ARQ_SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"divergencias={len(divergencias)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
