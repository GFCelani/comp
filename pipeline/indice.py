"""
Índice de tom por ata → banco/indice.json.

    .venv/Scripts/python.exe pipeline/indice.py

indice = média das notas ignorando zeros (null se nenhuma nota ≠ 0);
indice_media_simples = média de todas as notas. Lê banco/rotulos.jsonl e banco/atas.json.
"""
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_SAIDA = RAIZ / "banco" / "indice.json"


def main() -> int:
    notas = defaultdict(dict)
    with ARQ_ROTULOS.open(encoding="utf-8") as f:
        for l in f:
            if l.strip():
                r = json.loads(l)
                notas[r["ata"]][r["paragrafo"]] = r["nota"]      # última linha vence, se houver repetição
    datas = {a["numero"]: a["data_reuniao"] for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8"))}

    saida = []
    for ata in sorted(notas, reverse=True):
        v = list(notas[ata].values())
        nz = [x for x in v if x != 0]
        saida.append({"ata": ata, "data_reuniao": datas.get(ata),
                      "indice": round(sum(nz) / len(nz), 2) if nz else None,
                      "indice_media_simples": round(sum(v) / len(v), 2),
                      "n_paragrafos": len(v), "n_nao_zero": len(nz)})

    novo = {"metodo": "media_sem_zeros", "atas": saida}
    if ARQ_SAIDA.exists():                       # não reescreve se nada mudou (idempotência)
        antigo = json.loads(ARQ_SAIDA.read_text(encoding="utf-8"))
        if antigo.get("atas") == saida:
            print(f"Índice sem mudanças ({len(saida)} atas).")
            return 0
    novo = {"metodo": "media_sem_zeros", "gerado_em": datetime.now().isoformat(timespec="seconds"), "atas": saida}
    ARQ_SAIDA.write_text(json.dumps(novo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"banco/indice.json: {len(saida)} atas")
    for a in saida[:6]:
        print(f"  {a['ata']} {a['data_reuniao']}: índice {a['indice']} (média simples {a['indice_media_simples']}, "
              f"{a['n_nao_zero']}/{a['n_paragrafos']} não zero)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
