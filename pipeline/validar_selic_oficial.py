"""Cruza validacao/selic_oficial.csv (tabela oficial do BC, coletada pelo time) com banco/atas.json.

Saída: saida/validacao_selic_oficial.json
  {verificado_em, fonte, n_csv, n_banco, n_comparadas, so_no_csv, so_no_banco,
   divergencias: [{ata, campo, banco, oficial}]}
No CSV a decisão de corte vem como "baixa"; aqui ela é tratada como "corte".
"""
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
CSV = RAIZ / "validacao" / "selic_oficial.csv"
ATAS = RAIZ / "banco" / "atas.json"
SAIDA = RAIZ / "saida" / "validacao_selic_oficial.json"
DECISAO = {"baixa": "corte", "corte": "corte", "alta": "alta", "manutencao": "manutencao"}


def main() -> dict | None:
    if not CSV.exists():
        print("validacao/selic_oficial.csv não existe; nada a cruzar")
        return None
    oficial = {int(r["numero"]): r for r in csv.DictReader(CSV.open(encoding="utf-8-sig"))}
    banco = {a["numero"]: a for a in json.loads(ATAS.read_text(encoding="utf-8"))}
    divergencias = []
    comuns = sorted(set(oficial) & set(banco))
    for n in comuns:
        o, b = oficial[n], banco[n]
        pares = [
            ("data_reuniao", b.get("data_reuniao"), o["data_reuniao"]),
            ("selic_apos", b.get("selic_apos"), round(float(o["selic_apos"]), 2)),
            ("decisao_pp", b.get("decisao_pp"), round(float(o["decisao_pp"]), 2)),
            ("decisao", b.get("decisao"), DECISAO.get(o["decisao"], o["decisao"])),
        ]
        for campo, vb, vo in pares:
            iguais = abs(float(vb) - vo) < 0.005 if isinstance(vo, float) and vb is not None else vb == vo
            if not iguais:
                divergencias.append({"ata": n, "campo": campo, "banco": vb, "oficial": vo})
    res = {
        "verificado_em": datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds"),
        "fonte": "validacao/selic_oficial.csv (BCB, histórico das taxas de juros; ver validacao/FONTE_SELIC.md)",
        "n_csv": len(oficial),
        "n_banco": len(banco),
        "n_comparadas": len(comuns),
        "so_no_csv": sorted(set(oficial) - set(banco)),
        "so_no_banco": sorted(set(banco) - set(oficial)),
        "divergencias": divergencias,
    }
    SAIDA.parent.mkdir(exist_ok=True)
    SAIDA.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(comuns)} reuniões comparadas, {len(divergencias)} divergências; só no CSV: {res['so_no_csv']}")
    return res


if __name__ == "__main__":
    main()
