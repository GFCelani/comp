"""
Placar léxico: segunda opinião sem IA, determinística, baseada nos padrões de resultados/padroes.md.

    .venv/bin/python scripts/lexico.py          # gera dados/lexico.csv para todas as atas dos lotes

Cada expressão tem um peso (+ = duro, − = brando) e o código do padrão de origem. O placar de um
parágrafo é a soma dos pesos das expressões encontradas; o da ata é a soma dos parágrafos dividida
pela raiz do nº de parágrafos (para não premiar atas longas). `delta` = placar − placar da anterior.
É grosseiro de propósito: não entende contexto nem negação. Serve para checar o Claude — quando os
dois discordam, a confiança do índice cai.
"""
import json
import re
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
LOTES = RAIZ / "dados" / "lotes"

# (regex, peso, padrão) — regex sobre texto em minúsculas
LEXICO = [
    # P01 orientação explícita
    (r"não hesitará em (elevar|retomar|ajustar)", 2.0, "P01"),
    (r"retomar[aá]? o ciclo de (ajuste|alta|aperto)", 1.5, "P05"),
    (r"(elevação|alta|ajustes?) (adicional|adicionais)", 1.0, "P01"),
    (r"(acelerar|intensifica\w+) (o )?ritmo", 1.0, "P01"),
    (r"(início|iniciar) (d[ao] )?(processo de )?(flexibilização|afrouxamento|redução da taxa|inflexão)", -2.0, "P01"),
    (r"(flexibilização|afrouxamento|distensão) monetári", -1.0, "P01"),
    (r"(interrupção|pausa|encerramento|fim) (d[oa] )?(ciclo|processo)", -1.0, "P01"),
    (r"cortes? de|redução de 0,\d+ ponto", -1.0, "P01"),
    (r"ajuste (residual|de menor magnitude)|menor magnitude", -0.5, "P01"),
    (r"pouco provável uma intensificação", 0.5, "P01"),
    # P02 plural
    (r"nas próximas reuniões", 0.5, "P02"),
    # P03 balanço de riscos
    (r"assimetri\w+ altista|assimétrico para cima|viés assimétrico altista", 1.5, "P03"),
    (r"balanço de riscos (mais )?(equilibrado|simétrico|neutro)", -1.0, "P03"),
    # P04 duração
    (r"período (bastante |suficientemente |mais )?(prolongado|longo)", 1.0, "P04"),
    (r"maior e por mais tempo", 1.5, "P04"),
    (r"por mais tempo", 0.5, "P04"),
    # P06 quem concorda
    (r"unanim\w+|todos os membros", 0.3, "P06"),
    # P07 neutro / terminal
    (r"(taxa de juros|juro) (real )?neutr[ao]", 0.3, "P07"),
    (r"terminal (superior|mais elevad)", 1.5, "P07"),
    (r"significativamente (mais )?contracionista", 1.5, "P10"),
    (r"(mais )?contracionista", 0.5, "P04"),
    # P08 projeção x meta
    (r"acima da meta", 0.7, "P08"),
    (r"(em torno|próxim\w+) da meta|abaixo da meta", -0.3, "P08"),
    # P09 suficiência
    (r"(é|seja|ser) suficiente para|maior convicção", -1.0, "P09"),
    (r"(não (é|seria|será) suficiente|insuficiente)", 1.0, "P09"),
    # P11 expectativas
    (r"desancorad\w+|desancoragem", 0.8, "P11"),
    (r"reancoragem", 0.3, "P11"),
    (r"(queda|redução|recuo) das expectativas", -0.7, "P11"),
    # P12 fiscal
    (r"parafiscal|crédito direcionado|disciplina fiscal|esmorecimento", 0.7, "P12"),
    (r"prêmios? de risco", 0.4, "P12"),
    # P13 atividade
    (r"(desaceleração|moderação) (da atividade|no crescimento|do crescimento)", -0.7, "P13"),
    (r"hiato (do produto )?(positivo|mais estreito)|mercado de trabalho (aquecido|dinâmico|resiliente)", 0.8, "P13"),
    (r"(ociosidade|hiato) (negativo|elevad)", -0.5, "P13"),
    # P10 inflação
    (r"(inflação|preços) (corrente )?(tem|têm|tenha) (apresentado|mostrado) (queda|recuo|arrefecimento)|desinfla\w+", -0.5, "P10"),
    (r"pressões inflacionárias|inflação (corrente )?(elevada|acima)", 0.7, "P10"),
    # P17 choques
    (r"efeitos secundários|efeitos de segunda ordem", 0.7, "P17"),
    (r"reagir com firmeza", 1.0, "P17"),
    # P18 estilo
    (r"vigilân\w+|vigilante", 0.5, "P18"),
    (r"serenidade", 0.2, "P18"),
    (r"cautela", 0.2, "P18"),
]
COMPILADO = [(re.compile(r), w, p) for r, w, p in LEXICO]


def placar(texto: str) -> tuple[float, list[str]]:
    t = texto.lower()
    total, achados = 0.0, []
    for rx, w, p in COMPILADO:
        n = len(rx.findall(t))
        if n:
            total += w * min(n, 2)                         # repetição conta, mas satura
            achados.append(p)
    return total, achados


def placar_ata(lote: dict) -> dict:
    ps = [placar(p["texto"])[0] for p in lote["paragrafos"]]
    novo_alt = [placar(p["texto"])[0] for p in lote["paragrafos"] if p["status"] in ("novo", "alterado")]
    rem = [placar(p["texto"])[0] for p in lote["removidos"]]
    n = max(len(ps), 1)
    return {"ata": lote["ata"], "lex_nivel": round(sum(ps) / n ** 0.5, 3),
            "lex_mudanca": round((sum(novo_alt) - sum(rem)) / max(len(novo_alt) + len(rem), 1) ** 0.5, 3)}


if __name__ == "__main__":
    linhas = [placar_ata(json.loads(f.read_text(encoding="utf-8")))
              for f in sorted(LOTES.glob("ata_*.json"), key=lambda f: int(f.stem.split("_")[1]))]
    df = pd.DataFrame(linhas)
    df["lex_delta"] = df["lex_nivel"].diff().round(3)
    df.to_csv(RAIZ / "dados" / "lexico.csv", index=False)
    print(df.to_string(index=False))
