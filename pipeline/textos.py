"""
Relatório de mercado sobre a última ata e a previsão para a próxima reunião → saida/textos.json.

    .venv/Scripts/python.exe pipeline/textos.py            # só se a entrada mudou (hash)
    .venv/Scripts/python.exe pipeline/textos.py --forcar
    .venv/Scripts/python.exe pipeline/textos.py --sem-claude --saida /tmp/t.json   # testa o plano B

Uma chamada `claude -p --model sonnet` com o diff, os parágrafos das 2 últimas atas (número e nota),
o índice das últimas 6 atas, banco/previsao.json, o acerto histórico, Selic/Focus com datas e a lista de
números permitidos. Pede só as 3 seções (mudou, efeito, observar) com 3 a 5 parágrafos no total; toda
sentença leva um marcador [[cN]] que aponta para uma citação {ata, paragrafo, trecho}. Manchete e linha fina
são montadas por código (modelo de texto fixo: manchete_fixa, linha_fina_fixa), sem o Claude. Nenhuma frase
afirma o futuro com certeza (lista CERTEZA, verificada por código).
Verificação por código (ver verificar()); até 2 reescritas com os erros. Se ainda falhar, ou se o
Claude não estiver disponível, PLANO B determinístico por modelos de frase fixos, que passa pela mesma
verificação. `mudancas` e `impacto` (seção de Evidência) vêm sempre do código.
Idempotente: guarda `hash_entrada` (atas do diff + previsao.json sem gerado_em); com o mesmo hash não faz
nada, exceto refazer um plano B causado por Claude indisponível quando o Claude voltar.
"""
import argparse
import hashlib
import json
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import claude_cli  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
ARQ_DIFF = RAIZ / "saida" / "diff_ultimas.json"
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_ATAS = RAIZ / "banco" / "atas.json"
ARQ_INDICE = RAIZ / "banco" / "indice.json"
ARQ_INDICE_MODELO = RAIZ / "banco" / "indice_modelo.json"
ARQ_PREVISAO = RAIZ / "banco" / "previsao.json"
ARQ_FOCUS = RAIZ / "data" / "case1_focus" / "focus_anuais.csv"
ARQ_SGS = RAIZ / "data" / "case1_focus" / "sgs_realizado.csv"
ARQ_SAIDA = RAIZ / "saida" / "textos.json"
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
ARQ_METRICAS = RAIZ / "banco" / "metricas_modelo.json"
MAX_REESCRITAS = 2
VERSAO = 6          # muda o hash quando o formato/prompt muda
FUSO = timezone(timedelta(hours=-3))

NOME_PREV = {"aperto": "alta", "manutencao": "manutenção", "afrouxamento": "corte"}
PALAVRAS_PREV = {"aperto": ("alta", "elevação", "aperto", "subir", "subida"),
                 "manutencao": ("manutenção", "manter", "mantida", "estabilidade", "pausa"),
                 "afrouxamento": ("corte", "redução", "afrouxamento", "cortar", "reduzir")}
# Termos que contradizem a previsão publicada: reprovados na manchete e na linha fina (sem acento, palavra inteira).
_ALTA = ("alta", "altas", "elevacao", "elevar", "aperto", "subir", "subida", "sobe", "aumento", "aumentar")
_CORTE = ("corte", "cortes", "cortar", "reducao", "reduzir", "afrouxamento", "queda", "cair", "baixar")
_MANT = ("manutencao", "manter", "mantida", "mantem", "estabilidade", "pausa")
TERMOS_CONTRA = {"manutencao": _ALTA + _CORTE, "aperto": _MANT + _CORTE, "afrouxamento": _ALTA + _MANT}
NOME_METODO = {"ingenua": "previsão ingênua, que repete a última decisão",
               "variacao_tom": "variação do índice de tom entre atas",
               "nivel_tom": "nível do índice de tom", "modelo_parceiro": "modelo do parceiro"}
ACAO_PREV = {"aperto": "subir", "manutencao": "manter", "afrouxamento": "cortar"}
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]
RE_MARCA = re.compile(r"\[\[(c\d+)\]\]")
RE_NUM = re.compile(r"\d+(?:[.,]\d+)*")
# Proibido no relatório (seções): afirmações sobre os nossos próprios dados. Manchete e linha fina podem.
PROIBIDOS_RELATORIO = {"acert": "acerto do sinal", "previsao ingenua": "previsão ingênua", "ingenua": "previsão ingênua",
                       "nosso sinal": "nosso sinal", "focus": "Focus", "nao foi publicada": "ata não publicada"}
# Afirmações sobre o futuro em tom de certeza: reprovadas em toda sentença do relatório (sem acento, caixa baixa).
# Lista simples de propósito: verbos no futuro do presente ("vai", "vão", "irá", "irão", "será", "serão") e
# expressões de certeza. O relatório fala do futuro só com "prevê", "é esperado", "a projeção indica", "pode".
CERTEZA = {r"\bvai\b": "vai", r"\bvao\b": "vão", r"\bira\b": "irá", r"\birao\b": "irão",
           r"\bcertamente\b": "certamente", r"\bcom certeza\b": "com certeza", r"\bsem duvida": "sem dúvida",
           r"\bgarant": "garant…", r"\bsera\b": "será", r"\bserao\b": "serão"}
CLASSE_PREV = {"aperto": "alta", "manutencao": "manutencao", "afrouxamento": "corte"}   # chave em probabilidades
# Temas da linha fina: (raízes sem acento procuradas no trecho, nome). Ordem = prioridade.
TEMAS_FINA = [(("expectativa",), "as expectativas de inflação"), (("mercado de trabalho", "desemprego", "salari"),
              "o mercado de trabalho"), (("cenario externo", "externo", "geopolit", "global"), "o cenário externo"),
              (("cambio", "cambial"), "o câmbio"), (("credito",), "o crédito"),
              (("atividade", "pib", "crescimento"), "a atividade"), (("inflacao", "precos"), "a inflação")]
STOPWORDS = set("""sobre entre quando ainda mesmo mesma porque tambem assim desde depois antes apenas outro outra
outros outras sendo estao seria serao pelos pelas essas esses essa nessa nesse nesta neste nestes nestas aquela
aquele aquelas aqueles muito muitos muita muitas menos maior menores maiores menor tanto tanta quanto quanta todos
todas qualquer dessa desse deste desta destes destas dessas desses foram tinha houve podem poder poderia dever devem
deve contra segundo durante embora enquanto porem contudo comite copom havia haver estar estava esteve tendo seja
sejam fosse fossem forma parte vista longo cerca algum alguma alguns algumas nenhum nenhuma outrem onde ondem cujo
cuja sempre nunca agora ainda pouco pouca poucos poucas grande grandes desta neles nelas deles delas assim""".split())

PROMPT = """Você é analista de política monetária e escreve para profissionais de banco, mercado e investidores,
que querem saber o que deve acontecer com os juros e por quê. Use SOMENTE os dados abaixo.

## Previsão publicada para a próxima reunião (método escolhido por maior acurácia histórica; banco/previsao.json)
{previsao}

## Acerto histórico (reuniões de {ini} a {fim})
{acerto}

## Índice de tom das últimas 6 atas (−2 muito brando … +2 muito duro; média das notas dos parágrafos, ignorando neutros)
{indices}

## Dados de mercado (com a data de cada um)
{mercado}

## O que mudou entre a ata {anterior} e a ata {atual} (diff por parágrafo)
Novos na ata {atual}: {novos}
Removidos (existiam na ata {anterior}): {removidos}
Alterados (parágrafo atual ← anterior): {alterados}

## Parágrafos da ata {atual} (reunião de {data_atual}) — [ata §parágrafo | nota | seção]
{par_atual}

## Parágrafos da ata {anterior} (reunião de {data_anterior})
{par_anterior}

## Números permitidos (qualquer outro número é proibido, exceto número de ata, de parágrafo, anos e datas dos dados)
{permitidos}

## Tarefa
Escreva SÓ o corpo do relatório em JSON (a manchete e a linha fina já existem e vêm do código:
"{manchete}" / "{linha_fina}"). O relatório não pode contradizer essa previsão.
- O futuro NUNCA aparece como certeza: use "prevê", "é esperado", "a projeção indica", "pode", "tende a".
  Frases com "vai", "vão", "irá", "irão", "será", "serão", "certamente", "com certeza", "sem dúvida" ou
  "garant..." (garante, garantir, garantia) são reprovadas por código, mesmo ao parafrasear a ata.
- "secoes": exatamente 3 seções, nesta ordem, com 3 a 5 parágrafos NO TOTAL (pelo menos 1 por seção):
  1. id "mudou", titulo "O que mudou na comunicação do Copom": o que mudou e por quê;
  2. id "efeito", titulo "O efeito provável no mercado": efeito provável sobre Selic, juros futuros, câmbio,
     inflação esperada e crédito, SEMPRE em linguagem condicional ("pode", "tende a", "sinaliza");
  3. id "observar", titulo "O que observar até a próxima reunião".
Regras de citação (verificadas por código):
- Cada parágrafo é {{"texto": "...", "citacoes": [...]}}.
- TODA sentença do texto termina com um ou mais marcadores [[cN]] ANTES do ponto final, assim:
  "O Copom retirou a menção a X [[c1]]." Nenhuma sentença sem marcador.
- Cada citação: {{"id": "c1", "ata": {atual} ou {anterior}, "paragrafo": N, "trecho": "..."}}; o trecho é cópia
  LITERAL e contínua de até 25 palavras do parágrafo indicado (sem reticências, sem aspas extras).
- Todo marcador usado no texto existe em "citacoes" do mesmo parágrafo, e toda citação é usada no texto.
- Nenhum número que não esteja na lista de números permitidos. Números no padrão brasileiro (13,75%).
Regras de conteúdo do relatório (as 3 seções; verificadas por código):
- O relatório só afirma o que está nas atas acima. NÃO fale dos nossos próprios dados: acerto ou acurácia do
  sinal, "nosso sinal", previsão ingênua, Focus, índice de tom, ata ainda não publicada. Isso já aparece na
  manchete, na linha fina e nos blocos laterais da página. Frases com "acert", "ingênua", "nosso sinal", "Focus"
  ou "não foi publicada" são reprovadas.
- Cada citação tem de sustentar a frase em que aparece: o trecho citado trata do mesmo fato, e pelo menos uma
  palavra de conteúdo (5 letras ou mais) da frase aparece também no trecho. Uma frase sem trecho que a sustente
  deve ser cortada, não remendada com uma citação genérica.
Linguagem de mercado, direta, sem jargão sem explicação. Não é recomendação de investimento: não diga para
comprar, vender ou investir em nada.

Responda APENAS com o JSON:
{{"secoes": [{{"id": "mudou", "titulo": "O que mudou na comunicação do Copom", "paragrafos": [{{"texto": "Frase [[c1]].", "citacoes": [{{"id": "c1", "ata": {atual}, "paragrafo": 1, "trecho": ""}}]}}]}}, {{"id": "efeito", "titulo": "O efeito provável no mercado", "paragrafos": []}}, {{"id": "observar", "titulo": "O que observar até a próxima reunião", "paragrafos": []}}]}}"""

PROMPT_REESCRITA = """Sua resposta anterior teve problemas verificados por código:
{erros}

Corrija o que falhou mantendo todas as regras (toda sentença com marcador [[cN]] antes do ponto; trecho =
cópia literal de até 25 palavras do parágrafo indicado; cada trecho sustenta a sua frase; nada sobre acerto
do sinal, previsão ingênua, Focus ou ata não publicada nas seções; só números permitidos; nada de futuro em
tom de certeza: sem "vai", "vão", "irá", "irão", "será", "serão", "certamente", "com certeza", "sem dúvida",
"garant..."; use "prevê", "é esperado", "a projeção indica", "pode"). Responda APENAS com o JSON {{"secoes": [...]}}.

Sua resposta anterior:
{anterior}"""


# ---------------------------------------------------------------- dados

def ler(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def br(x: float, casas: int = 2) -> str:
    return f"{x:.{casas}f}".replace(".", ",")


def pct(x: float | None) -> str:
    return "—" if x is None else f"{round(x * 100)}%"


def data_br(iso: str | None, ano: bool = False) -> str | None:
    if not iso:
        return None
    d = date.fromisoformat(iso[:10])
    return d.strftime("%d/%m/%Y" if ano else "%d/%m")


def paragrafos_de(ata: int) -> dict[int, dict]:
    out = {}
    with ARQ_PARAGRAFOS.open(encoding="utf-8") as f:
        for l in f:
            if l.strip():
                p = json.loads(l)
                if p["ata"] == ata:
                    out[p["paragrafo"]] = p
    return out


def notas_de(ata: int) -> dict[int, int]:
    out = {}
    if ARQ_ROTULOS.exists():
        with ARQ_ROTULOS.open(encoding="utf-8") as f:
            for l in f:
                if l.strip():
                    r = json.loads(l)
                    if r["ata"] == ata:
                        out[r["paragrafo"]] = r["nota"]          # última linha vence
    return out


def indices_por_ata() -> dict[int, float | None]:
    arq = ARQ_INDICE_MODELO if ARQ_INDICE_MODELO.exists() else ARQ_INDICE
    return {a["ata"]: a.get("indice") for a in ler(arq)["atas"]}


def dados_mercado() -> tuple[str, str | None, str | None]:
    """Texto com Selic/Focus/câmbio/IPCA e datas; devolve (texto, data_selic, data_focus)."""
    sgs = pd.read_csv(ARQ_SGS)
    linhas = []
    sel = sgs[sgs["serie"] == "selic_meta"].sort_values("data").iloc[-1]
    data_selic = str(sel["data"])
    linhas.append(f"- Selic meta em {data_selic}: {br(sel['valor'])}% ao ano")
    ipca = sgs[sgs["serie"] == "ipca_12m"].sort_values("data")
    if len(ipca):
        i = ipca.iloc[-1]
        linhas.append(f"- IPCA acumulado em 12 meses (mês {str(i['data'])[:7]}): {br(i['valor'])}%")
    dol = sgs[sgs["serie"] == "dolar_ptax_venda"].sort_values("data")
    if len(dol):
        d = dol.iloc[-1]
        linhas.append(f"- Dólar PTAX venda em {d['data']}: R$ {br(d['valor'])}")
    focus = pd.read_csv(ARQ_FOCUS)
    focus = focus[focus["baseCalculo"] == 0]
    data_focus = str(focus["Data"].max())
    ult = focus[focus["Data"] == data_focus]
    ano = int(data_focus[:4])
    nomes = {"Selic": "Selic no fim do ano (% a.a.)", "IPCA": "IPCA no ano (%)", "Câmbio": "Dólar no fim do ano (R$)"}
    for ind, nome in nomes.items():
        for ref in (ano, ano + 1):
            sub = ult[(ult["Indicador"] == ind) & (ult["DataReferencia"].astype(str) == str(ref))]
            if len(sub):
                linhas.append(f"- Focus {data_focus}, mediana {nome}, {ref}: {br(float(sub['Mediana'].iloc[0]))}")
    return "\n".join(linhas), data_selic, data_focus


def texto_previsao(prev: dict) -> str:
    p, u, f = prev.get("proxima_reuniao") or {}, prev.get("ultima_decisao") or {}, prev.get("focus_selic") or {}
    met = prev.get("metodo_escolhido") or "nivel_tom"
    vt = prev.get("variacao_tom") or {}
    l = [f"- PREVISÃO PUBLICADA para a próxima reunião: {prev['previsto']} ({NOME_PREV[prev['previsto']]} da Selic), "
         f"pelo nosso modelo, treinado com as atas desde 2021, que acertou {pct(prev.get('acuracia_escolhido'))} "
         f"das decisões seguintes.",
         f"- Tom (explicação do que mudou, não previsão): índice de tom {br(prev['indice'])} na ata {prev['base_ata']}"
         + (f", variação de {br(vt['delta'])} em relação à ata {vt.get('ata_anterior')}" if vt.get("delta") is not None else "")
         + ".",
         f"- Próxima reunião: {p.get('numero')} em {p.get('data') or 'data indisponível'} (fonte: {p.get('fonte')})."]
    if u:
        l.append(f"- Última decisão conhecida: reunião {u.get('numero')} em {u.get('data')}, {u.get('decisao')} "
                 f"({br(u.get('decisao_pp') or 0)} p.p.), Selic em {br(u.get('selic') or 0)}% ao ano"
                 + ("; a ata desta reunião AINDA NÃO FOI PUBLICADA." if not u.get("ata_publicada") else "."))
    if f:
        l.append(f"- Focus (coleta de {f.get('data')}): mediana da Selic no fim de {f.get('ano_referencia')} "
                 f"em {br(f['mediana'])}%.")
    return "\n".join(l)


def texto_acerto(prev: dict) -> str:
    if prev.get("metodos"):
        return "\n".join(f"- Nosso modelo: acertou {pct(m.get('acuracia_tempo'))} das decisões seguintes "
                         f"({m.get('n')} reuniões)" for m in prev["metodos"] if m.get("disponivel"))
    a = prev.get("acerto") or {}
    i, g = a.get("indice") or {}, a.get("ingenua") or {}
    return (f"- Nosso sinal de tom: acurácia {pct(i.get('acuracia'))} em {i.get('n')} reuniões; acerto de direção "
            f"{pct(i.get('acerto_sinal'))} nas {i.get('n_direcionais')} previsões de alta ou corte.\n"
            f"- Previsão ingênua (repete a última decisão): acurácia {pct(g.get('acuracia'))}; acerto de direção "
            f"{pct(g.get('acerto_sinal'))} em {g.get('n_direcionais')} previsões. Hoje ela prevê: {g.get('previsto')}.")


# ---------------------------------------------------------------- verificação

def numeros(texto: str) -> set[float]:
    saida = set()
    for m in RE_NUM.findall(texto):
        s = m
        if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", s):        # milhar com ponto
            s = s.replace(".", "")
        s = s.replace(",", ".")
        if s.count(".") > 1:
            continue
        try:
            saida.add(round(float(s), 4))
        except ValueError:
            pass
    return saida


def permitidos_de(dados: str) -> set[float]:
    base = numeros(dados)
    extra = set()
    for x in base:
        if abs(x) < 1:                                 # 0,844 → 84%, 84,4%; 0,25 p.p. → 25 pontos-base
            extra |= {round(x * 100, 1), float(round(x * 100))}
    return base | extra | {0.0, 1.0, 2.0}                # régua de notas −2..+2


def limpar_referencias(texto: str, datas_ok: set[tuple[int, int]], erros: list[str]) -> str:
    """Tira do texto datas dos dados, números de ata/parágrafo/reunião e anos; registra datas desconhecidas."""
    def data_num(m):
        d, mes = int(m.group(1)), int(m.group(2))
        if (d, mes) not in datas_ok:
            erros.append(f"data {m.group(0)} não está nos dados")
        return " "
    def data_ext(m):
        d, mes = int(m.group(1)), MESES.index(m.group(2).lower()) + 1
        if (d, mes) not in datas_ok:
            erros.append(f"data {m.group(0)} não está nos dados")
        return " "
    t = RE_MARCA.sub(" ", texto)
    t = re.sub(r"\b(\d{1,2})/(\d{1,2})(?:/\d{2,4})?\b", data_num, t)
    t = re.sub(r"\b(\d{1,2})º? de (" + "|".join(MESES) + r")\b", data_ext, t, flags=re.I)
    t = re.sub(r"(?i)\b(atas?|reuniões|reunião|parágrafos?|§)\s*(n[º°.]\s*)?\d+(\s*(,|e|a)\s*\d+)*", " ", t)
    t = re.sub(r"§\s*\d+", " ", t)
    t = re.sub(r"\b(19|20)\d{2}\b", " ", t)
    return t


def sentencas(texto: str) -> list[str]:
    partes = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ\"“(])", texto.strip())
    return [p for p in (x.strip() for x in partes) if p]


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


def palavras_conteudo(s: str) -> set[str]:
    """Palavras de 5+ letras fora das stopwords, sem acento, em caixa baixa e sem o "s" do plural."""
    return {w[:-1] if w.endswith("s") and len(w) > 5 else w
            for w in re.findall(r"[a-z]+", sem_acento(RE_MARCA.sub(" ", s))) if len(w) >= 5 and w not in STOPWORDS}


def termos_certeza(texto: str) -> list[str]:
    """Termos de CERTEZA presentes no texto (fora dos marcadores), sem acento e em caixa baixa."""
    t = sem_acento(RE_MARCA.sub(" ", texto))
    return [nome for padrao, nome in CERTEZA.items() if re.search(padrao, t)]


# ---------------------------------------------------------------- manchete e linha fina (modelo fixo)

def data_extenso(iso: str | None) -> str | None:
    if not iso:
        return None
    d = date.fromisoformat(iso[:10])
    return f"{d.day} de {MESES[d.month - 1]}"


def manchete_fixa(prev: dict, atas: dict) -> str:
    data = data_extenso((prev.get("proxima_reuniao") or {}).get("data"))
    if prev["previsto"] == "manutencao":
        selic = (prev.get("ultima_decisao_conhecida") or {}).get("selic")
        if selic is None:
            selic = atas[max(atas)].get("selic_apos")
        return f"Selic deve ficar em {br(selic)}% {'em ' + data if data else 'na próxima reunião'}, prevê o CopomAI"
    verbo = "cair" if prev["previsto"] == "afrouxamento" else "subir"
    return f"Selic deve {verbo} {'na reunião de ' + data if data else 'na próxima reunião'}, prevê o CopomAI"


def tema_fina(trecho: str) -> str | None:
    t = sem_acento(trecho)
    for raizes, nome in TEMAS_FINA:
        if any(r in t for r in raizes):
            if nome == "a atividade" and re.search(r"desaceler|moderac", t):
                return "a desaceleração da atividade"
            return nome
    return None


def linha_fina_fixa(ctx: dict) -> str:
    prev = ctx["prev"]
    met = (ler(ARQ_METRICAS) or {}).get("metricas") or {}
    probs = prev.get("probabilidades") or {}
    p = probs.get(CLASSE_PREV[prev["previsto"]])
    n, acc = met.get("n"), met.get("acuracia")
    ini = (met.get("periodo") or {}).get("inicio") or (prev.get("validacao_tempo") or {}).get("inicio")
    partes = []
    if p is not None:
        partes.append(f"Probabilidade estimada de {round(p * 100)}% de {NOME_PREV[prev['previsto']]}")
    if n and acc is not None and ini:
        d = date.fromisoformat(ini[:10])
        partes.append(f"o modelo acertou {round(acc * n)} de {n} reuniões desde {MESES[d.month - 1]} de {d.year}")
    frase1 = "; ".join(partes)
    frase1 = (frase1[0].upper() + frase1[1:] + ". ") if frase1 else ""
    atual, anterior = ctx["atual"], ctx["anterior"]
    i, i0 = ctx["indices"].get(atual), ctx["indices"].get(anterior)
    dlt = (i - i0) if i is not None and i0 is not None else 0
    tom = "mais duro" if dlt > 0.05 else "menos duro" if dlt < -0.05 else "estável"
    efeito = "endureceu" if dlt > 0.05 else "suavizou" if dlt < -0.05 else None
    cands = candidatos_mudanca(ctx)
    c = next((x for x in cands if efeito is None or x["efeito"] == efeito), None)
    t = tema_fina(c["trecho"]) if c else None
    return frase1 + f"A ata {atual} trouxe tom {tom}" + (f", com destaque para {t}." if t else ".")


def verificar(resp: dict, ctx: dict) -> list[str]:
    erros: list[str] = []
    prev, permitidos, datas_ok = ctx["prev"], ctx["permitidos"], ctx["datas_ok"]
    pars = {ctx["atual"]: ctx["par_atual"], ctx["anterior"]: ctx["par_anterior"]}

    def nums(rotulo: str, txt: str):
        e2: list[str] = []
        limpo = limpar_referencias(txt, datas_ok, e2)
        erros.extend(f"{rotulo}: {e}" for e in e2)
        ruins = sorted(br(x).rstrip("0").rstrip(",") for x in numeros(limpo) if x not in permitidos)
        if ruins:
            erros.append(f"{rotulo}: números fora dos dados: {ruins}")

    # Manchete e linha fina são montadas por código (modelo de texto fixo); aqui só se confere que não mudaram
    # e que não usam termos proibidos.
    man, fina = (resp.get("manchete") or "").strip(), (resp.get("linha_fina") or "").strip()
    if man != ctx["manchete"]:
        erros.append("a manchete difere do modelo de texto fixo")
    if fina != ctx["linha_fina"]:
        erros.append("a linha fina difere do modelo de texto fixo")
    for rot, txt in (("manchete", man), ("linha_fina", fina)):
        proib = [w for w in ("metodo", "ingenua", "repete a ultima decisao") if w in sem_acento(txt)]
        if proib:
            erros.append(f"{rot}: não pode falar de método, previsão ingênua ou repetir a última decisão: {proib}")
        ruins = [w for w in TERMOS_CONTRA[prev["previsto"]] if re.search(rf"\b{w}\b", sem_acento(txt))]
        if ruins:
            erros.append(f"{rot}: menciona direção diferente da previsão publicada "
                         f"({NOME_PREV[prev['previsto']]}): {ruins}; a mudança de tom é explicação, não previsão")
        cert = termos_certeza(txt)
        if cert:
            erros.append(f"{rot}: afirma o futuro com certeza: {cert}")

    secoes = resp.get("secoes") or []
    ids = [s.get("id") for s in secoes]
    if ids != ["mudou", "efeito", "observar"]:
        erros.append(f"as seções devem ser mudou, efeito, observar nesta ordem (veio {ids})")
    total = sum(len(s.get("paragrafos") or []) for s in secoes)
    if not 3 <= total <= 5:
        erros.append(f"o relatório deve ter de 3 a 5 parágrafos no total (veio {total})")
    for s in secoes:
        if not s.get("paragrafos"):
            erros.append(f"seção {s.get('id')} sem parágrafos")
        for k, p in enumerate(s.get("paragrafos") or [], 1):
            rot = f"{s.get('id')} §{k}"
            txt = (p.get("texto") or "").strip()
            if not txt:
                erros.append(f"{rot}: texto vazio")
                continue
            cits = p.get("citacoes") or []
            por_id = {c.get("id"): c for c in cits}
            for sent in sentencas(txt):
                if not RE_MARCA.search(sent):
                    erros.append(f"{rot}: sentença sem marcador [[cN]]: {sent[:80]!r}")
                norm = sem_acento(sent)
                cert = termos_certeza(sent)
                if cert:
                    erros.append(f"{rot}: afirma o futuro com certeza ({', '.join(cert)}); use \"prevê\", \"é "
                                 f"esperado\", \"a projeção indica\" ou \"pode\": {sent[:80]!r}")
                for chave, nome in PROIBIDOS_RELATORIO.items():
                    if chave in norm:
                        erros.append(f"{rot}: o relatório não pode falar de {nome} (isso já está na manchete e nos "
                                     f"blocos laterais); reescreva só com o que está nas atas: {sent[:80]!r}")
                        break
                pal = palavras_conteudo(sent)
                for cid in dict.fromkeys(RE_MARCA.findall(sent)):
                    c = por_id.get(cid)
                    if c and not (pal & palavras_conteudo(c.get("trecho") or "")):
                        erros.append(f"{rot} {cid}: a citação não sustenta a frase (nenhuma palavra de conteúdo em "
                                     f"comum entre a frase e o trecho); troque o trecho ou reescreva a frase: "
                                     f"{sent[:80]!r}")
            usados = set(RE_MARCA.findall(txt))
            dados_ids = [c.get("id") for c in cits]
            if len(set(dados_ids)) != len(dados_ids):
                erros.append(f"{rot}: ids de citação repetidos")
            if usados - set(dados_ids):
                erros.append(f"{rot}: marcadores sem citação: {sorted(usados - set(dados_ids))}")
            if set(dados_ids) - usados:
                erros.append(f"{rot}: citações não usadas no texto: {sorted(set(dados_ids) - usados)}")
            for c in cits:
                try:
                    a, n = int(c.get("ata")), int(c.get("paragrafo"))
                except (TypeError, ValueError):
                    erros.append(f"{rot} {c.get('id')}: ata/parágrafo inválidos")
                    continue
                if a not in pars or n not in pars[a]:
                    erros.append(f"{rot} {c.get('id')}: parágrafo {n} da ata {a} não está nos dados")
                elif not claude_cli.trecho_ok(c.get("trecho", ""), pars[a][n]["texto"]):
                    erros.append(f"{rot} {c.get('id')}: trecho não é cópia literal de até 25 palavras do "
                                 f"parágrafo {n} da ata {a}")
            nums(rot, txt)
    return erros


def finalizar(resp: dict) -> dict:
    """Renumera as citações (c1..cN únicas no relatório) e normaliza trechos."""
    k, secoes = 0, []
    for s in resp["secoes"]:
        ps = []
        for p in s["paragrafos"]:
            mapa, cits = {}, []
            for c in p["citacoes"]:
                k += 1
                mapa[c["id"]] = f"c{k}"
                cits.append({"id": f"c{k}", "ata": int(c["ata"]), "paragrafo": int(c["paragrafo"]),
                             "trecho": claude_cli.normalizar(c["trecho"])})
            txt = RE_MARCA.sub(lambda m: f"[[{mapa[m.group(1)]}]]", p["texto"].strip())
            ps.append({"texto": txt, "citacoes": cits})
        secoes.append({"id": s["id"], "titulo": s.get("titulo") or "", "paragrafos": ps})
    return {"manchete": resp["manchete"].strip(), "linha_fina": resp["linha_fina"].strip(), "secoes": secoes}


# ---------------------------------------------------------------- plano B

def recorte(texto: str, n: int = 25) -> str:
    return " ".join(texto.split()[:n])


# Temas para o plano B: (raiz sem acento procurada no trecho, como aparece na frase). A frase leva uma palavra
# do trecho, o que garante a checagem de sustentação. Ordem = prioridade.
TEMAS = [("expectativa", "as expectativas de inflação"), ("desancorad", "a desancoragem das expectativas"),
         ("inflacao", "a inflação"), ("cambio", "o câmbio"), ("credito", "o crédito"), ("fiscal", "a política fiscal"),
         ("trabalho", "o mercado de trabalho"), ("atividade", "a atividade econômica"),
         ("servicos", "a inflação de serviços"), ("externo", "o cenário externo"), ("riscos", "os riscos"),
         ("incerteza", "a incerteza"), ("restritiv", "a política monetária restritiva"), ("cenario", "o cenário")]


def tema(trecho: str) -> str:
    t = sem_acento(trecho)
    for raiz, nome in TEMAS:
        if raiz in t and palavras_conteudo(nome) & palavras_conteudo(trecho):
            return nome
    for w in trecho.split():
        if palavras_conteudo(w):
            return f"o ponto sobre {w.strip(',.;:()')}"
    return f"o trecho que começa com \"{' '.join(trecho.split()[:6])}\""


# Modelos de frase do plano B por (tipo, efeito), escolhidos pela posição da mudança.
# {t} = tema, {a} = ata atual, {b} = ata anterior, {k} = id da citação.
MODELOS_MUDOU = {
    ("novo", "endureceu"): [
        "A ata {a} incluiu um trecho novo sobre {t} que deixa a comunicação mais dura [[{k}]].",
        "Na ata {a}, o Copom passou a abordar {t} com um tom mais duro [[{k}]].",
        "Um parágrafo novo da ata {a}, sobre {t}, reforça a cautela do Comitê [[{k}]].",
        "O texto novo sobre {t} na ata {a} aponta para uma postura mais firme [[{k}]]."],
    ("novo", "suavizou"): [
        "A ata {a} incluiu um trecho novo sobre {t} que deixa a comunicação mais branda [[{k}]].",
        "Na ata {a}, o Copom passou a abordar {t} com um tom mais leve [[{k}]].",
        "Um parágrafo novo da ata {a}, sobre {t}, alivia o tom do Comitê [[{k}]].",
        "O texto novo sobre {t} na ata {a} abre espaço para uma postura menos rígida [[{k}]]."],
    ("alterado", "endureceu"): [
        "O Copom reescreveu na ata {a} a passagem sobre {t}, agora com tom mais duro [[{k}]].",
        "A redação sobre {t} ficou mais dura na ata {a} do que na ata {b} [[{k}]].",
        "Ao revisar o que dizia sobre {t}, o Comitê endureceu a mensagem na ata {a} [[{k}]].",
        "A nova versão do trecho sobre {t} na ata {a} soa mais firme [[{k}]]."],
    ("alterado", "suavizou"): [
        "O Copom reescreveu na ata {a} a passagem sobre {t}, agora com tom mais brando [[{k}]].",
        "A redação sobre {t} ficou mais leve na ata {a} do que na ata {b} [[{k}]].",
        "Ao revisar o que dizia sobre {t}, o Comitê suavizou a mensagem na ata {a} [[{k}]].",
        "A nova versão do trecho sobre {t} na ata {a} soa menos rígida [[{k}]]."],
    ("removido", "endureceu"): [
        "Saiu da ata {a} o trecho da ata {b} sobre {t}, o que deixa a comunicação mais dura [[{k}]].",
        "Sem a passagem da ata {b} sobre {t}, a ata {a} fica com tom mais firme [[{k}]].",
        "O Copom deixou de lado na ata {a} o que dizia sobre {t} na ata {b}, e o tom endureceu [[{k}]]."],
    ("removido", "suavizou"): [
        "Saiu da ata {a} o trecho da ata {b} sobre {t}, o que deixa a comunicação mais branda [[{k}]].",
        "Sem a passagem da ata {b} sobre {t}, a ata {a} fica com tom mais leve [[{k}]].",
        "O Copom deixou de lado na ata {a} o que dizia sobre {t} na ata {b}, e o tom suavizou [[{k}]]."],
}


def candidatos_mudanca(ctx: dict) -> list[dict]:
    """Mudanças do diff ordenadas por |nota| (novos/removidos) ou variação de nota (alterados)."""
    diff, atual, anterior = ctx["diff"], ctx["atual"], ctx["anterior"]
    na, nb, pa, pb = ctx["notas_atual"], ctx["notas_anterior"], ctx["par_atual"], ctx["par_anterior"]
    cand = []
    for x in diff["novos"]:
        n, v = x["paragrafo"], na.get(x["paragrafo"], 0)
        if v and n in pa:
            cand.append((abs(v), abs(v), {"paragrafo": n, "ata": atual, "tipo": "novo", "nota": v, "nota_antes": None,
                                          "efeito": "endureceu" if v > 0 else "suavizou"}))
    for x in diff["alterados"]:
        n, m = x["paragrafo_atual"], x["paragrafo_anterior"]
        v, w = na.get(n, 0), nb.get(m, 0)
        if v != w and n in pa:
            cand.append((abs(v - w), abs(v), {"paragrafo": n, "ata": atual, "tipo": "alterado", "nota": v,
                                              "nota_antes": w, "efeito": "endureceu" if v > w else "suavizou"}))
    for x in diff["removidos"]:
        n, w = x["paragrafo"], nb.get(x["paragrafo"], 0)
        if w and n in pb:
            cand.append((abs(w), abs(w), {"paragrafo": n, "ata": anterior, "tipo": "removido", "nota": None,
                                          "nota_antes": w, "efeito": "suavizou" if w > 0 else "endureceu"}))
    cand.sort(key=lambda c: (c[0], c[1]), reverse=True)
    out = []
    for _, _, c in cand[:3]:
        fonte = pa if c["tipo"] != "removido" else pb
        c["trecho"] = recorte(fonte[c["paragrafo"]]["texto"])
        out.append(c)
    return out


def mudancas_evidencia(ctx: dict) -> list[dict]:
    atual, anterior = ctx["atual"], ctx["anterior"]
    out = []
    for c in candidatos_mudanca(ctx):
        brando = c["efeito"] == "suavizou"
        if c["tipo"] == "novo":
            exp = (f"Parágrafo novo na ata {atual}, com nota {c['nota']:+d} na régua de tom de -2 a +2. "
                   f"Por isso, ele deixa a comunicação do Copom mais {'branda' if brando else 'dura'}.")
        elif c["tipo"] == "alterado":
            exp = (f"O parágrafo foi reescrito e a nota de tom passou de {c['nota_antes']:+d} na ata {anterior} "
                   f"para {c['nota']:+d} na ata {atual}. Por isso, a comunicação do Copom ficou mais "
                   f"{'branda' if brando else 'dura'} neste ponto.")
        else:
            exp = (f"Este parágrafo da ata {anterior}, com nota {c['nota_antes']:+d}, saiu da ata {atual}. "
                   f"Sem ele, a comunicação do Copom fica mais {'branda' if brando else 'dura'}.")
        out.append({"paragrafo": c["paragrafo"], "trecho": c["trecho"], "efeito": c["efeito"], "explicacao": exp,
                    "tipo": c["tipo"]})
    return out


def impacto_evidencia(ctx: dict) -> str:
    atual, anterior = ctx["atual"], ctx["anterior"]
    i, i0 = ctx["indices"].get(atual), ctx["indices"].get(anterior)
    ata = ctx["atas"].get(atual, {})
    frases, d = [], None
    if i is not None and i0 is not None:
        d = round(i - i0, 2)
        frases.append(f"O índice de tom da ata {atual} ficou em {br(i)}, contra {br(i0)} na ata {anterior}, "
                      f"uma variação de {'+' if d >= 0 else '-'}{br(abs(d))} na escala de -2 a +2.")
    pp, selic, dec = ata.get("decisao_pp"), ata.get("selic_apos"), ata.get("decisao")
    if dec and selic is not None:
        acao = {"alta": f"subir a Selic em {br(abs(pp or 0))} ponto percentual",
                "corte": f"cortar a Selic em {br(abs(pp or 0))} ponto percentual",
                "manutencao": "manter a Selic"}[dec]
        frases.append(f"Na reunião, o Copom decidiu {acao}, e a meta passou a {br(selic)}% ao ano.")
    if d is not None and d > 0.1:
        frases.append("Se esse tom mais duro se mantiver, os juros futuros tendem a ficar mais altos e a próxima "
                      "decisão pode manter a Selic por mais tempo ou interromper cortes.")
    elif d is not None and d < -0.1:
        frases.append("Se esse tom mais brando se mantiver, os juros futuros tendem a recuar e a próxima decisão "
                      "pode trazer novo corte da Selic.")
    else:
        frases.append("Com o tom pouco alterado, a próxima decisão tende a seguir a linha desta reunião, "
                      "salvo surpresa nos dados de inflação e de atividade.")
    return " ".join(frases)


def maior_nota(ctx: dict, filtro) -> int | None:
    pa, na = ctx["par_atual"], ctx["notas_atual"]
    cand = [(abs(na.get(n, 0)), -n, n) for n, p in pa.items() if filtro(p) and na.get(n, 0)]
    return max(cand)[2] if cand else None


def plano_b(ctx: dict) -> dict:
    prev, atual, anterior = ctx["prev"], ctx["atual"], ctx["anterior"]
    manchete, fina = ctx["manchete"], ctx["linha_fina"]      # modelo de texto fixo, igual ao do Claude

    # mudou
    cits, frases = [], []
    for k, c in enumerate(candidatos_mudanca(ctx)[:3], 1):
        modelos = MODELOS_MUDOU[(c["tipo"], c["efeito"])]
        frases.append(modelos[(k - 1) % len(modelos)].format(t=tema(c["trecho"]), a=atual, b=anterior, k=f"c{k}"))
        cits.append({"id": f"c{k}", "ata": c["ata"], "paragrafo": c["paragrafo"], "trecho": c["trecho"]})
    mudou = [{"texto": " ".join(frases), "citacoes": cits}] if frases else []

    # efeito
    pa = ctx["par_atual"]
    n_dec = maior_nota(ctx, lambda p: re.search(r"(?i)decis|condução", p.get("secao") or "")) \
        or maior_nota(ctx, lambda p: True)
    cond = {"aperto": ("juros mais altos", "os juros futuros tendem a subir, o real pode ganhar "
                       "apoio e o crédito tende a ficar mais caro"),
            "manutencao": ("juros parados por mais tempo", "os juros futuros tendem a oscilar pouco, "
                           "o câmbio pode seguir mais ligado ao cenário externo e o crédito tende a continuar restrito"),
            "afrouxamento": ("espaço para juros menores", "os juros futuros tendem a recuar, o real pode "
                             "perder parte do diferencial de juros e o crédito tende a ficar menos caro")}[prev["previsto"]]
    efeito = []
    if n_dec:
        tr = recorte(pa[n_dec]["texto"])
        efeito = [{"texto": f"Se o mercado ler o que a ata {atual} diz sobre {tema(tr)} como sinal de {cond[0]}, "
                            f"{cond[1]}, com efeito sobre a inflação esperada [[c1]].",
                   "citacoes": [{"id": "c1", "ata": atual, "paragrafo": n_dec, "trecho": tr}]}]
    # observar
    n_risco = maior_nota(ctx, lambda p: re.search(r"(?i)risco", (p.get("secao") or "") + " " + p["texto"])) or n_dec
    observar = []
    if n_risco:
        tr = recorte(pa[n_risco]["texto"])
        observar = [{"texto": f"Até a próxima reunião, vale acompanhar {tema(tr)}, ponto que o Copom destacou na ata "
                              f"{atual} e que pode confirmar ou mudar a direção dos juros [[c1]].",
                     "citacoes": [{"id": "c1", "ata": atual, "paragrafo": n_risco, "trecho": tr}]}]
    return {"manchete": manchete, "linha_fina": fina,
            "secoes": [{"id": "mudou", "titulo": "O que mudou na comunicação do Copom", "paragrafos": mudou},
                       {"id": "efeito", "titulo": "O efeito provável no mercado", "paragrafos": efeito},
                       {"id": "observar", "titulo": "O que observar até a próxima reunião", "paragrafos": observar}]}


# ---------------------------------------------------------------- Claude

def contexto() -> dict:
    diff = ler(ARQ_DIFF)
    atual, anterior = diff["ata_atual"], diff["ata_anterior"]
    prev = ler(ARQ_PREVISAO)
    if not prev:
        raise RuntimeError("banco/previsao.json não existe; rode pipeline/previsao.py antes")
    atas = {a["numero"]: a for a in ler(ARQ_ATAS)}
    ctx = {"diff": diff, "atual": atual, "anterior": anterior, "prev": prev, "atas": atas,
           "par_atual": paragrafos_de(atual), "par_anterior": paragrafos_de(anterior),
           "notas_atual": notas_de(atual), "notas_anterior": notas_de(anterior), "indices": indices_por_ata()}
    try:
        ctx["mercado"], ctx["data_selic"], ctx["data_focus"] = dados_mercado()
    except Exception as e:
        print(f"  aviso: sem dados de mercado ({e})")
        ctx["mercado"], ctx["data_selic"], ctx["data_focus"] = "(indisponível)", None, None

    def lista_par(n_ata, pars, notas):
        return "\n\n".join(f"[{n_ata} §{n} | nota {notas.get(n, 0):+d} | {p.get('secao') or '-'}] {p['texto']}"
                           for n, p in sorted(pars.items()))
    ult6 = sorted(a for a in ctx["indices"] if a <= atual)[-6:]
    indices_txt = "\n".join(f"- Ata {n} (reunião {atas.get(n, {}).get('data_reuniao')}): índice "
                            f"{br(ctx['indices'][n]) if ctx['indices'][n] is not None else '—'}; decisão: "
                            f"{atas.get(n, {}).get('decisao')} de {br(atas.get(n, {}).get('decisao_pp') or 0)} p.p., "
                            f"Selic após {br(atas.get(n, {}).get('selic_apos') or 0)}%" for n in ult6)
    per = (prev.get("acerto") or {}).get("periodo") or {}
    campos = dict(previsao=texto_previsao(prev), acerto=texto_acerto(prev), ini=per.get("inicio"), fim=per.get("fim"),
                  indices=indices_txt, mercado=ctx["mercado"], atual=atual, anterior=anterior,
                  novos=", ".join(f"§{x['paragrafo']}" for x in diff["novos"]) or "nenhum",
                  removidos=", ".join(f"§{x['paragrafo']}" for x in diff["removidos"]) or "nenhum",
                  alterados=", ".join(f"§{x['paragrafo_atual']} ← §{x['paragrafo_anterior']}" for x in diff["alterados"]) or "nenhum",
                  data_atual=atas.get(atual, {}).get("data_reuniao"), data_anterior=atas.get(anterior, {}).get("data_reuniao"),
                  par_atual=lista_par(atual, ctx["par_atual"], ctx["notas_atual"]),
                  par_anterior=lista_par(anterior, ctx["par_anterior"], ctx["notas_anterior"]),
                  previsto=prev["previsto"], metodo=NOME_METODO.get(prev.get("metodo_escolhido"), "nível do tom"),
                  termos_contra=", ".join(f'"{w}"' for w in TERMOS_CONTRA[prev["previsto"]]))
    dados = "\n".join(str(v) for k, v in campos.items() if k not in ("atual", "anterior", "termos_contra"))
    ctx["permitidos"] = permitidos_de(dados)
    datas = set(re.findall(r"\d{4}-\d{2}-\d{2}", dados + json.dumps(prev)))
    ctx["datas_ok"] = {(int(x[8:10]), int(x[5:7])) for x in datas}
    lista = sorted(x for x in ctx["permitidos"] if not (1900 <= x <= 2100))
    campos["permitidos"] = ", ".join(br(x, 4).rstrip("0").rstrip(",") for x in lista)
    ctx["manchete"], ctx["linha_fina"] = manchete_fixa(prev, atas), linha_fina_fixa(ctx)
    campos["manchete"], campos["linha_fina"] = ctx["manchete"], ctx["linha_fina"]
    ctx["prompt"] = PROMPT.format(**campos)
    return ctx


def via_claude(ctx: dict):
    """Devolve (resposta verificada ou None, erros, reescritas)."""
    texto = claude_cli.chamar(ctx["prompt"])
    reescritas = 0
    while True:
        try:
            resp = claude_cli.extrair_json(texto)
            resp["manchete"], resp["linha_fina"] = ctx["manchete"], ctx["linha_fina"]   # sempre do código
            erros = verificar(resp, ctx)
        except Exception as e:
            resp, erros = None, [f"JSON inválido: {e}"]
        if not erros:
            return resp, [], reescritas
        if reescritas >= MAX_REESCRITAS:
            return None, erros, reescritas
        reescritas += 1
        print(f"Reescrita {reescritas}: {erros}", flush=True)
        texto = claude_cli.chamar(ctx["prompt"] + "\n\n" + PROMPT_REESCRITA.format(
            erros="\n".join(f"- {e}" for e in erros[:30]), previsto=ctx["prev"]["previsto"], anterior=texto))


def hash_entrada(atual: int, anterior: int) -> str:
    prev = {k: v for k, v in (ler(ARQ_PREVISAO) or {}).items() if k != "gerado_em"}
    met = (ler(ARQ_METRICAS) or {}).get("metricas")            # entra na linha fina (acertou K de N)
    s = json.dumps([VERSAO, atual, anterior, prev, met], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--sem-claude", action="store_true", help="gera só a versão automática (plano B)")
    ap.add_argument("--saida", type=Path, default=ARQ_SAIDA)
    args = ap.parse_args()

    diff = ler(ARQ_DIFF)
    atual, anterior = diff["ata_atual"], diff["ata_anterior"]
    h = hash_entrada(atual, anterior)
    sem_claude = args.sem_claude or not claude_cli.disponivel()
    velho = ler(args.saida) or {}
    if not args.forcar and velho.get("hash_entrada") == h:
        refazer = velho.get("origem") == "automatico" and velho.get("motivo_automatico") == "indisponivel" \
            and not sem_claude
        if not refazer:
            print(f"Textos já gerados para esta entrada (ata {atual}, hash {h}); não chama o Claude.")
            return 0
        print("Claude voltou: refaz o relatório que estava no plano B.")

    ctx = contexto()
    resp, erros, reescritas, origem, motivo = None, [], 0, "claude", None
    if sem_claude:
        motivo = "indisponivel"
        print("Sem Claude: relatório automático (plano B).")
    else:
        try:
            resp, erros, reescritas = via_claude(ctx)
            if resp is None:
                motivo = "reprovado"
                print(f"Reprovado após {reescritas} reescritas: {erros}")
        except Exception as e:
            motivo, erros = "indisponivel", [f"Claude falhou: {e}"]
            print(f"Claude falhou ({e}); relatório automático (plano B).")
    if resp is None:
        origem = "automatico"
        resp = plano_b(ctx)
        erros_b = verificar(resp, ctx)
        if erros_b:                                   # não deveria acontecer; registra e segue
            print(f"!! plano B com problemas na verificação: {erros_b}")
            erros = erros + [f"plano B: {e}" for e in erros_b]
    final = finalizar(resp)

    saida = {"ata_atual": atual, "ata_anterior": anterior,
             "gerado_em": datetime.now(FUSO).isoformat(timespec="seconds"),
             "origem": origem, "motivo_automatico": motivo, "tentativas": reescritas + (0 if sem_claude else 1),
             "reescritas": reescritas, "hash_entrada": h, "previsto": ctx["prev"]["previsto"],
             "metodo_escolhido": ctx["prev"].get("metodo_escolhido"),
             "proxima_reuniao": ctx["prev"].get("proxima_reuniao"),
             **final,
             "mudancas": mudancas_evidencia(ctx),
             "impacto": {"texto": impacto_evidencia(ctx), "data_selic": ctx["data_selic"],
                         "data_focus": ctx["data_focus"], "origem": "automatico"},
             "verificacao": {"reescritas": reescritas, "descartados": erros, "chamadas_claude": claude_cli.CHAMADAS}}
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n = sum(len(s["paragrafos"]) for s in final["secoes"])
    print(f"{args.saida.name}: relatório {origem} ({n} parágrafos, {reescritas} reescritas). Manchete: {final['manchete']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
