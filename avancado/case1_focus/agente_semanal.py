"""
Case 1 — Termômetro do Focus · o AGENTE SEMANAL (esqueleto que já roda de ponta a ponta).

Rode da raiz do repositório:
    python avancado/case1_focus/agente_semanal.py                 # fluxo completo
    python avancado/case1_focus/agente_semanal.py --sem-email     # gera o relatório, mas não envia
    python avancado/case1_focus/agente_semanal.py --sem-download  # usa os CSVs que já estão em data/

As etapas:
  1. baixar   — dados novos do Banco Central (scripts/baixar_dados_bcb.py)
  2. calcular — o termômetro da semana, salvo em saida/resumo_semana.json
  3. checar   — se algo estiver errado, o agente PARA e avisa o time
  4. analisar — o Claude escreve a análise via Claude Code (`claude -p`), usando o seu plano do Claude
  5. conferir — todo número do texto precisa existir no JSON
  6. montar   — relatório em HTML (é também o artefato web): saida/relatorio_semana.html
  7. enviar   — e-mail pelo Gmail (enviar_email.py + .env)

Os pontos marcados com TODO são o desafio do time.
"""
import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
SAIDA = AQUI / "saida"
sys.path.insert(0, str(AQUI))

from inicio_focus import META_INFLACAO, carregar_focus, serie_semanal  # noqa: E402

INDICADORES = ["IPCA", "Selic", "Câmbio", "PIB Total"]
# TODO: limiares chutados. Calibrem com o histórico (ex.: 2 desvios-padrão das variações de 4 semanas).
LIMIAR_4S = {"IPCA": 0.3, "Selic": 0.5, "Câmbio": 0.15, "PIB Total": 0.3}
# Faixas plausíveis para a checagem: fora disso, provavelmente é erro de dado.
FAIXA = {"IPCA": (0, 20), "Selic": (0, 30), "Câmbio": (2, 10), "PIB Total": (-10, 10)}
MAX_DIAS_DEFASAGEM = 10


# ------------------------------------------------------------------ 1. baixar
def baixar() -> None:
    subprocess.run([sys.executable, str(RAIZ / "scripts" / "baixar_dados_bcb.py")], check=True)


# ------------------------------------------------------------------ 2. calcular
def calcular() -> dict:
    focus = carregar_focus()
    data_focus = focus["Data"].max()
    resumo = {"data_focus": f"{data_focus:%d/%m/%Y}", "gerado_em": f"{date.today():%d/%m/%Y}",
              "indicadores": [], "alertas": []}
    for ind in INDICADORES:
        for ano in (data_focus.year, data_focus.year + 1):
            s = serie_semanal(focus, ind, ano)
            if len(s) < 5:
                continue
            linha = {"indicador": ind, "ano": int(ano), "mediana": round(float(s.iloc[-1]), 2),
                     "var_semana": round(float(s.iloc[-1] - s.iloc[-2]), 2),
                     "var_4_semanas": round(float(s.iloc[-1] - s.iloc[-5]), 2)}
            disp = focus[(focus["Indicador"] == ind) & (focus["DataReferencia"] == ano)
                         & (focus["Data"] == focus["Data"].max())]["DesvioPadrao"]
            if not disp.empty:
                linha["desvio_padrao"] = round(float(disp.iloc[0]), 2)
            if ind == "IPCA":
                linha["distancia_da_meta"] = round(linha["mediana"] - META_INFLACAO, 2)
            resumo["indicadores"].append(linha)
            if abs(linha["var_4_semanas"]) >= LIMIAR_4S[ind]:
                resumo["alertas"].append(f"{ind} {ano}: variou {linha['var_4_semanas']:+.2f} em 4 semanas")
    # TODO: o que mais um gestor quer ver toda segunda? Acurácia do ano passado? Selic atual vs. esperada?
    return resumo


# ------------------------------------------------------------------ 3. checar
def checar(resumo: dict) -> list[str]:
    problemas = []
    dias = (date.today() - date(*map(int, reversed(resumo["data_focus"].split("/"))))).days
    if dias > MAX_DIAS_DEFASAGEM:
        problemas.append(f"o Focus mais recente é de {resumo['data_focus']} ({dias} dias atrás)")
    if not resumo["indicadores"]:
        problemas.append("nenhum indicador calculado")
    for l in resumo["indicadores"]:
        lo, hi = FAIXA[l["indicador"]]
        if not lo <= l["mediana"] <= hi:
            problemas.append(f"{l['indicador']} {l['ano']} = {l['mediana']} fora da faixa plausível")
    # TODO: outras checagens? (ex.: número de respondentes muito baixo, semana repetida)
    return problemas


# ------------------------------------------------------------------ 4. analisar
def analisar(resumo: dict) -> str:
    claude = shutil.which("claude")
    if not claude:
        raise SystemExit("Claude Code não encontrado. Instale e faça login (ver avancado/README.md).")
    prompt = (AQUI / "prompt_analise.md").read_text(encoding="utf-8")
    entrada = prompt + "\n" + json.dumps(resumo, ensure_ascii=False, indent=2)
    r = subprocess.run([claude, "-p"], input=entrada, capture_output=True, text=True,
                       encoding="utf-8", timeout=300)
    if r.returncode != 0:
        raise SystemExit(f"Erro ao chamar o Claude Code:\n{r.stderr}")
    return r.stdout.strip().removeprefix("```html").removesuffix("```").strip()


# ------------------------------------------------------------------ 5. conferir
def conferir(texto: str, resumo: dict) -> list[str]:
    """Todo número decimal do texto precisa aparecer no JSON (pega número inventado)."""
    validos = set()
    for v in re.findall(r"-?\d+(?:[.,]\d+)?", json.dumps(resumo)):
        x = float(v.replace(",", "."))
        validos |= {round(x, 2), round(abs(x), 2)}
    suspeitos = []
    for v in re.findall(r"\d+,\d+|\d+\.\d+", re.sub(r"<[^>]+>", " ", texto)):
        if round(float(v.replace(",", ".")), 2) not in validos:
            suspeitos.append(v)
    return suspeitos


# ------------------------------------------------------------------ 6. montar
def montar(resumo: dict, analise: str) -> str:
    linhas = "".join(
        f"<tr><td>{l['indicador']}</td><td>{l['ano']}</td><td>{l['mediana']:.2f}</td>"
        f"<td>{l['var_semana']:+.2f}</td><td>{l['var_4_semanas']:+.2f}</td></tr>"
        for l in resumo["indicadores"])
    # TODO: deixem o e-mail com a cara do time (cores, gráfico, ordem das seções).
    return f"""<html><body style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
<h2>Termômetro do Focus — {resumo['data_focus']}</h2>
{analise}
<h3>Números da semana (mediana)</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse">
<tr><th>Indicador</th><th>Ano</th><th>Mediana</th><th>Var. semana</th><th>Var. 4 semanas</th></tr>
{linhas}</table>
<p style="font-size:12px;color:#666">Fonte: Banco Central do Brasil, Relatório Focus de {resumo['data_focus']}.
Análise gerada automaticamente com o Claude e conferida contra os dados. Não constitui recomendação de investimento.</p>
</body></html>"""


# ------------------------------------------------------------------ fluxo
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-download", action="store_true")
    ap.add_argument("--sem-email", action="store_true")
    args = ap.parse_args()
    SAIDA.mkdir(exist_ok=True)

    if not args.sem_download:
        print("1. Baixando dados..."); baixar()
    print("2. Calculando o termômetro..."); resumo = calcular()
    (SAIDA / "resumo_semana.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")

    print("3. Checando..."); problemas = checar(resumo)
    if problemas:
        aviso = "<p>O agente parou. Problemas encontrados:</p><ul>" + \
                "".join(f"<li>{html.escape(p)}</li>" for p in problemas) + "</ul>"
        print("   PAROU:", "; ".join(problemas))
        if not args.sem_email:
            from enviar_email import enviar
            enviar("[ALERTA] Agente do Focus parou", aviso)
        sys.exit(1)

    print("4. Pedindo a análise ao Claude..."); analise = analisar(resumo)
    print("5. Conferindo números do texto...")
    suspeitos = conferir(analise, resumo)
    if suspeitos:
        # TODO: em vez de só avisar, peçam ao Claude para reescrever (até 2 tentativas).
        print("   ATENÇÃO: números no texto que não estão no JSON:", ", ".join(suspeitos))

    print("6. Montando o relatório...")
    relatorio = montar(resumo, analise)
    destino = SAIDA / "relatorio_semana.html"
    destino.write_text(relatorio, encoding="utf-8")
    print("   salvo em", destino)

    if not args.sem_email:
        from enviar_email import enviar
        para = enviar(f"Termômetro do Focus — {resumo['data_focus']}", relatorio)
        print("7. E-mail enviado para", ", ".join(para))


if __name__ == "__main__":
    main()
