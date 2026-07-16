import os
import datetime
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from openpyxl import Workbook, load_workbook

app = Flask(__name__)
app.secret_key = os.urandom(24)

RANKING_FILE = "ranking.xlsx"
INVITE_OPTIONS = {
    "homem": {
        "role": "padrinho",
        "label": "Você aceita ser meu padrinho?"
    },
    "mulher": {
        "role": "madrinha",
        "label": "Você aceita ser minha madrinha?"
    }
}

QUESTIONS = [
    {
        "question": "Com quantos centímetros eu nasci?",
        "choices": ["46 cm", "48 cm", "50 cm"],
        "answer": "48 cm"
    },
    {
        "question": "Quanto eu pesei quando nasci?",
        "choices": ["2 kg e 980 g", "3 kg e 68 g", "3 kg e 250 g"],
        "answer": "3 kg e 68 g"
    },
    {
        "question": "Que horas eu nasci?",
        "choices": ["14h", "16h", "18h"],
        "answer": "16h"
    },
    {
        "question": "Quantas furadinhas levei no teste do pezinho?",
        "choices": ["3", "4", "5"],
        "answer": "4"
    },
    {
        "question": "Quem me deu meu primeiro presente?",
        "choices": ["Tia Dete", "Prima Laura", "Vovó Maninha"],
        "answer": "Prima Laura"
    },
    {
        "question": "Quem me deu meu primeiro banho?",
        "choices": ["Tia Dete", "Vovó Maninha", "Vovó Patrícia"],
        "answer": "Tia Dete"
    },
    {
        "question": "Qual é meu nome completo?",
        "choices": ["José Leonardo Sousa Lima", "José Leonardo Lima de Sousa", "José L. de Sousa"],
        "answer": "José Leonardo Lima de Sousa"
    },
    {
        "question": "Em que dia descobriram que eu estava a caminho?",
        "choices": ["30/10/2024", "02/11/2024", "05/11/2024"],
        "answer": "02/11/2024"
    },
    {
        "question": "Quantos mL tomei na minha primeira mamadeira?",
        "choices": ["50 mL", "60 mL", "70 mL"],
        "answer": "60 mL"
    },
    {
        "question": "Qual foi meu primeiro remédio?",
        "choices": ["Simeticona", "Multi B Gotas", "Vitamina D"],
        "answer": "Multi B Gotas"
    }
]


def ensure_ranking_file():
    if not os.path.exists(RANKING_FILE):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Ranking"
        sheet.append(["Nome", "Pontuação", "Acertos", "Erros", "Tempo", "Data", "Hora", "Convite Aceito"])
        workbook.save(RANKING_FILE)


def format_seconds_to_time(total_seconds):
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"


def parse_time_string(time_string):
    try:
        parts = time_string.split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        return int(time_string)
    except Exception:
        return 0


def write_ranking_entry(name, score, correct, wrong, time_str, accepted="Não"):
    ensure_ranking_file()
    workbook = load_workbook(RANKING_FILE)
    sheet = workbook.active
    timestamp = datetime.datetime.now()
    sheet.append([
        name,
        score,
        correct,
        wrong,
        time_str,
        timestamp.strftime("%d/%m/%Y"),
        timestamp.strftime("%H:%M:%S"),
        accepted
    ])
    row_index = sheet.max_row
    workbook.save(RANKING_FILE)
    return row_index


def update_ranking_acceptance(row_index):
    if not os.path.exists(RANKING_FILE):
        return False
    workbook = load_workbook(RANKING_FILE)
    sheet = workbook.active
    if row_index <= 1 or row_index > sheet.max_row:
        return False
    sheet.cell(row=row_index, column=8).value = "Sim"
    workbook.save(RANKING_FILE)
    return True


def get_top_ranking(limit=4):
    ensure_ranking_file()
    workbook = load_workbook(RANKING_FILE)
    sheet = workbook.active
    entries = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row or not any(row):
            continue
        name, score, correct, wrong, time_str, date_str, hour_str, accepted = row[:8]
        entries.append({
            "name": name,
            "score": score,
            "correct": correct,
            "wrong": wrong,
            "time": time_str,
            "date": date_str,
            "hour": hour_str,
            "accepted": accepted,
            "sort_time": parse_time_string(time_str)
        })
    entries.sort(key=lambda item: (-int(item["score"]), item["sort_time"]))
    return entries[:limit]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/audio")
def audio_player():
    return render_template("audio.html")


@app.route("/ranking")
def ranking():
    top_entries = get_top_ranking(limit=10)
    return render_template("ranking.html", top_entries=top_entries)


@app.route("/como-funciona")
def como_funciona():
    return render_template("como_funciona.html")


@app.route("/certificado")
def certificado():
    name = session.get("player_name") or "Seu nome"
    gender_key = session.get("player_gender", "homem")
    invite_info = INVITE_OPTIONS.get(gender_key, INVITE_OPTIONS["homem"])
    return render_template(
        "certificado.html",
        name=name,
        invite_role=invite_info["role"],
        today=datetime.datetime.now().strftime("%d/%m/%Y")
    )


@app.route("/nome", methods=["GET", "POST"])
def nome():
    if request.method == "POST":
        name = request.form.get("player_name", "").strip()
        gender = request.form.get("player_gender", "")
        if not name:
            return render_template(
                "nome.html",
                error="Por favor, informe como deseja aparecer no ranking.",
                player_name=name,
                player_gender=gender
            )
        if gender not in INVITE_OPTIONS:
            return render_template(
                "nome.html",
                error="Por favor, escolha se é homem ou mulher.",
                player_name=name,
                player_gender=gender
            )
        session.clear()
        session["player_name"] = name
        session["player_gender"] = gender
        return redirect(url_for("quiz"))
    return render_template("nome.html", player_name="", player_gender="")


@app.route("/quiz")
def quiz():
    if not session.get("player_name"):
        return redirect(url_for("nome"))
    return render_template("quiz.html", questions=QUESTIONS, player_name=session["player_name"])


@app.route("/save_result", methods=["POST"])
def save_result():
    payload = request.get_json()
    if not payload:
        return jsonify({"success": False, "message": "Dados não recebidos."}), 400

    name = session.get("player_name")
    if not name:
        return jsonify({"success": False, "message": "Nome não encontrado."}), 400

    score = int(payload.get("score", 0))
    correct = int(payload.get("correct", 0))
    wrong = int(payload.get("wrong", 0))
    time_spent = payload.get("time", "00:00")

    row_index = write_ranking_entry(name, score, correct, wrong, time_spent, accepted="Não")
    session["quiz_score"] = score
    session["quiz_correct"] = correct
    session["quiz_wrong"] = wrong
    session["quiz_time"] = time_spent
    session["ranking_row"] = row_index
    return jsonify({"success": True})


@app.route("/resultado")
def resultado():
    if not session.get("player_name") or session.get("quiz_score") is None:
        return redirect(url_for("nome"))

    top_entries = get_top_ranking(limit=4)
    return render_template(
        "resultado.html",
        name=session["player_name"],
        score=session["quiz_score"],
        correct=session["quiz_correct"],
        wrong=session["quiz_wrong"],
        time=session["quiz_time"],
        top_entries=top_entries
    )


@app.route("/convite", methods=["GET", "POST"])
def convite():
    if not session.get("player_name") or session.get("ranking_row") is None or not session.get("player_gender"):
        return redirect(url_for("nome"))

    gender_key = session.get("player_gender", "homem")
    invite_info = INVITE_OPTIONS.get(gender_key, INVITE_OPTIONS["homem"])

    if request.method == "POST":
        row_index = session.get("ranking_row")
        success = update_ranking_acceptance(row_index)
        return jsonify({"success": success})

    return render_template(
        "convite.html",
        invite_label=invite_info["label"],
        invite_role=invite_info["role"]
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
