"""
Compara as notas humanas de validacao/para_rotular.csv com as do Claude em banco/rotulos.jsonl
→ validacao/resultado.json (formato do CONTRATO.md).

Rode da raiz do repositório:
    .venv/Scripts/python.exe validacao/comparar.py

Só entram os parágrafos com nota_humana preenchida e nota do Claude disponível.
Se o CSV ainda não tiver notas ou banco/rotulos.jsonl não existir, escreve resultado com n = 0.
"""
import csv
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_CSV = RAIZ / "validacao" / "para_rotular.csv"
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
ARQ_SAIDA = RAIZ / "validacao" / "resultado.json"


def nota_inteira(valor: str) -> int | None:
    v = (valor or "").strip().replace("+", "").replace(",", ".")
    if not v:
        return None
    try:
        n = int(round(float(v)))
    except ValueError:
        return None
    return n if -2 <= n <= 2 else None


def carregar_rotulos() -> dict[tuple[int, int], int]:
    if not ARQ_ROTULOS.exists():
        print(f"aviso: {ARQ_ROTULOS.name} ainda não existe; nenhuma nota do Claude para comparar")
        return {}
    rotulos = {}
    for linha in ARQ_ROTULOS.read_text(encoding="utf-8").splitlines():
        if linha.strip():
            r = json.loads(linha)
            rotulos[(int(r["ata"]), int(r["paragrafo"]))] = int(r["nota"])
    return rotulos


def main() -> int:
    if not ARQ_CSV.exists():
        print(f"{ARQ_CSV} não existe; rode pipeline/exportar_validacao.py primeiro")
        return 1
    rotulos = carregar_rotulos()
    itens, sem_humana, sem_claude = [], 0, 0
    with ARQ_CSV.open(encoding="utf-8-sig", newline="") as f:
        for linha in csv.DictReader(f):
            ata, par = int(linha["ata"]), int(linha["paragrafo"])
            humana = nota_inteira(linha.get("nota_humana"))
            if humana is None:
                sem_humana += 1
                continue
            claude = rotulos.get((ata, par))
            if claude is None:
                sem_claude += 1
                continue
            itens.append({"ata": ata, "paragrafo": par, "nota_humana": humana, "nota_claude": claude})

    n = len(itens)
    exata = sum(i["nota_humana"] == i["nota_claude"] for i in itens)
    um_ponto = sum(abs(i["nota_humana"] - i["nota_claude"]) <= 1 for i in itens)
    resultado = {"n": n,
                 "concordancia_exata": round(exata / n, 2) if n else None,
                 "concordancia_1ponto": round(um_ponto / n, 2) if n else None,
                 "itens": itens}
    ARQ_SAIDA.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"n={n} exata={resultado['concordancia_exata']} 1ponto={resultado['concordancia_1ponto']} "
          f"(sem nota humana: {sem_humana}; sem nota do Claude: {sem_claude}) -> {ARQ_SAIDA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
