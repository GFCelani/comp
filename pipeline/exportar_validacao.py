"""
Sorteia 20 parágrafos de 20 atas diferentes para validação humana → validacao/para_rotular.csv.

Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/exportar_validacao.py

Colunas: ata,paragrafo,texto,nota_humana (em branco, para o time preencher de -2 a +2).
Sem a nota do Claude, para não enviesar. Seed fixa (42): rodar de novo dá a mesma amostra.
UTF-8 com BOM, para abrir direto no Excel.
"""
import csv
import json
import random
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_SAIDA = RAIZ / "validacao" / "para_rotular.csv"
N, SEED = 20, 42


def main() -> int:
    por_ata: dict[int, list[dict]] = {}
    for linha in ARQ_PARAGRAFOS.read_text(encoding="utf-8").splitlines():
        if linha.strip():
            p = json.loads(linha)
            por_ata.setdefault(p["ata"], []).append(p)

    rng = random.Random(SEED)
    atas = rng.sample(sorted(por_ata), min(N, len(por_ata)))
    amostra = sorted((rng.choice(por_ata[a]) for a in atas), key=lambda p: (p["ata"], p["paragrafo"]))

    ARQ_SAIDA.parent.mkdir(exist_ok=True)
    with ARQ_SAIDA.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ata", "paragrafo", "texto", "nota_humana"])
        for p in amostra:
            w.writerow([p["ata"], p["paragrafo"], p["texto"], ""])
    print(f"{len(amostra)} parágrafos de {len(set(p['ata'] for p in amostra))} atas -> {ARQ_SAIDA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
