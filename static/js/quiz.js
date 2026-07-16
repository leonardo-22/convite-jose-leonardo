const questionText = document.getElementById('questionText');
const answersContainer = document.getElementById('answersContainer');
const currentQuestion = document.getElementById('currentQuestion');
const scoreValue = document.getElementById('scoreValue');
const errorsValue = document.getElementById('errorsValue');
const progressFill = document.getElementById('progressFill');
const timerValue = document.getElementById('timerValue');

let currentIndex = 0;
let score = 0;
let errors = 0;
let timer = null;
let secondsLeft = 20;
let startTime = null;

function shuffleArray(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function startQuiz() {
    currentIndex = 0;
    score = 0;
    errors = 0;
    startTime = Date.now();
    renderQuestion();
    updateScore();
    updateErrors();
}

function renderQuestion() {
    if (currentIndex >= QUESTIONS.length) {
        return endQuiz();
    }

    const current = QUESTIONS[currentIndex];
    currentQuestion.textContent = currentIndex + 1;
    questionText.textContent = current.question;
    const choices = shuffleArray(current.choices);
    answersContainer.innerHTML = '';

    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'answer-button';
        button.type = 'button';
        button.textContent = choice;
        button.addEventListener('click', () => selectAnswer(choice, button));
        answersContainer.appendChild(button);
    });

    updateProgress();
    startTimer();
}

function startTimer() {
    clearInterval(timer);
    secondsLeft = 20;
    timerValue.textContent = `${secondsLeft}s`;
    timerValue.classList.remove('timer-critical');

    timer = setInterval(() => {
        secondsLeft -= 1;
        timerValue.textContent = `${secondsLeft}s`;
        if (secondsLeft <= 5) {
            timerValue.classList.add('timer-critical');
        }
        if (secondsLeft <= 0) {
            clearInterval(timer);
            handleWrongAnswer();
        }
    }, 1000);
}

function selectAnswer(choice, button) {
    clearInterval(timer);
    disableAllAnswers();
    const current = QUESTIONS[currentIndex];
    const isCorrect = choice === current.answer;

    if (isCorrect) {
        score += 10;
        button.classList.add('answer-correct');
    } else {
        errors += 1;
        button.classList.add('answer-wrong');
        markCorrectAnswer(current.answer);
        try {
            playWrongSound();
        } catch (error) {
            console.warn('Falha ao reproduzir som de erro.', error);
        }
    }

    updateScore();
    updateErrors();
    setTimeout(() => {
        currentIndex += 1;
        renderQuestion();
    }, 520);
}

function handleWrongAnswer() {
    errors += 1;
    try {
        playWrongSound();
    } catch (error) {
        console.warn('Falha ao reproduzir som de erro por tempo esgotado.', error);
    }
    currentIndex += 1;
    updateErrors();
    renderQuestion();
}

function disableAllAnswers() {
    const buttons = answersContainer.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
}

function markCorrectAnswer(answerText) {
    const buttons = answersContainer.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.textContent === answerText) {
            btn.classList.add('answer-correct');
        }
    });
}

function updateProgress() {
    const percent = ((currentIndex) / QUESTIONS.length) * 100;
    progressFill.style.width = `${percent}%`;
}

function updateScore() {
    scoreValue.textContent = score;
}

function updateErrors() {
    errorsValue.textContent = errors;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function endQuiz() {
    clearInterval(timer);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const payload = {
        score,
        correct: (QUESTIONS.length - errors),
        wrong: errors,
        time: formatTime(elapsed)
    };
    fetch('/save_result', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/resultado';
            } else {
                alert('Houve um problema ao salvar seu resultado.');
            }
        })
        .catch(() => {
            alert('Erro na conexão. Tente novamente.');
        });
}

window.addEventListener('DOMContentLoaded', startQuiz);
