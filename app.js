/* =========================================================
   VUELA LEYENDO — lógica de la app
   ========================================================= */

const TEXTO_EJEMPLO = `El gato Tom vive en una casa azul. Todos los días sale al jardín a jugar con una pelota roja. Le gusta correr, saltar y mirar las flores. A veces se sube a un árbol y desde ahí ve a los pájaros volar. Cuando se cansa, vuelve a su casa y toma un poco de leche.`;

const state = {
  studentName: '',
  grade: '1º grado',
  text: '',
  words: [],          // palabras normalizadas del texto original
  webAppUrl: '',
  recognizedWords: [], // palabras reconocidas en orden (tal como llegan)
  heardSet: new Set(), // índices de palabras del texto ya marcadas como escuchadas
  timeLeft: 60,
  timerId: null,
  startTimestamp: null,
  recognizing: false,
  recognition: null,
  mediaRecorder: null,
  audioChunks: [],
  audioBlob: null,
  finished: false,
};

/* ---------- utilidades de texto ---------- */
function normalizarPalabra(w) {
  return w
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos para comparar
    .replace(/[^a-zñ0-9]/g, '');
}

function tokenizarTexto(texto) {
  return texto
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);
}

/* Alineación tipo LCS entre el texto original y lo escuchado,
   para contar cuántas palabras del texto fueron leídas correctamente y en orden. */
function calcularPalabrasCorrectas(originalNorm, escuchadoNorm) {
  const n = originalNorm.length;
  const m = escuchadoNorm.length;
  const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (originalNorm[i - 1] && originalNorm[i - 1] === escuchadoNorm[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  // reconstruir qué índices del original quedaron marcados como "correctos"
  const marcados = new Set();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (originalNorm[i - 1] === escuchadoNorm[j - 1]) {
      marcados.add(i - 1);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return { correctas: dp[n][m], indicesMarcados: marcados };
}

/* ---------- navegación entre pantallas ---------- */
function mostrarPantalla(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen--active'));
  document.getElementById(id).classList.add('screen--active');
}

/* ---------- pantalla menú ---------- */
document.getElementById('card-actividad-1').addEventListener('click', () => {
  mostrarPantalla('screen-config');
});
document.getElementById('btn-config').addEventListener('click', () => {
  mostrarPantalla('screen-config');
});

/* ---------- pantalla configuración ---------- */
/* ---------- URL de Apps Script ---------- */
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxvq95RdeFlheqXPFXZZWzklZEuoXh4xcTjbh40lPyH5F39uy2PBIFUSvJwkzvOQaXxnQ/exec';

const inputStudent = document.getElementById('input-student');
const inputGrade = document.getElementById('input-grade');
const inputText = document.getElementById('input-text');
const wordCountPreview = document.getElementById('word-count-preview');

function actualizarPreviewPalabras() {
  const n = tokenizarTexto(inputText.value).length;
  wordCountPreview.textContent = `${n} palabra${n === 1 ? '' : 's'}`;
}
inputText.addEventListener('input', actualizarPreviewPalabras);

document.getElementById('btn-text-sample').addEventListener('click', () => {
  inputText.value = TEXTO_EJEMPLO;
  actualizarPreviewPalabras();
});

document.getElementById('back-from-config').addEventListener('click', () => mostrarPantalla('screen-menu'));

document.getElementById('btn-start-reading').addEventListener('click', () => {
  const nombre = inputStudent.value.trim();
  const texto = inputText.value.trim();
  if (!nombre) { alert('Falta escribir el nombre del alumno o alumna.'); inputStudent.focus(); return; }
  if (!texto) { alert('Falta cargar el texto que va a leer.'); inputText.focus(); return; }

  state.studentName = nombre;
  state.grade = inputGrade.value.trim() || '1º grado';
  state.text = texto;
  state.words = tokenizarTexto(texto);
  state.webAppUrl = WEB_APP_URL;

  prepararPantallaLectura();
  mostrarPantalla('screen-reading');
});

/* ---------- pantalla lectura ---------- */
const readingTextEl = document.getElementById('reading-text');
const btnRecord = document.getElementById('btn-record');
const recordBtnLabel = document.getElementById('record-btn-label');
const btnStop = document.getElementById('btn-stop');
const statWords = document.getElementById('stat-words');
const statStatus = document.getElementById('stat-status');
const statStatusLabel = document.getElementById('stat-status-label');
const timerSecondsEl = document.getElementById('timer-seconds');
const timerRingFg = document.getElementById('timer-ring-fg');
const readingHint = document.getElementById('reading-hint');
const mascotMouth = document.getElementById('mascot-mouth');

const RING_CIRCUMFERENCE = 439.8;

function prepararPantallaLectura() {
  document.getElementById('display-student').textContent = state.studentName;
  document.getElementById('display-grade').textContent = state.grade;

  readingTextEl.innerHTML = state.words
    .map((w, idx) => `<span class="word" data-idx="${idx}">${w}</span>`)
    .join(' ');

  state.timeLeft = 60;
  state.recognizedWords = [];
  state.heardSet = new Set();
  state.audioBlob = null;
  state.finished = false;
  timerSecondsEl.textContent = '60';
  timerRingFg.style.strokeDashoffset = '0';
  statWords.textContent = '0';
  statStatus.classList.remove('live');
  statStatus.textContent = '●';
  statStatusLabel.textContent = 'listo';
  btnRecord.classList.remove('recording');
  recordBtnLabel.textContent = 'Empezar a leer';
  btnStop.hidden = true;
  readingHint.textContent = 'Apretá el botón cuando estés listo o lista para leer en voz alta.';
  mascotMouth.setAttribute('d', 'M48 84 Q60 90 72 84');
}

document.getElementById('back-from-reading').addEventListener('click', () => {
  detenerTodo();
  mostrarPantalla('screen-menu');
});

/* --- Web Speech API (reconocimiento) --- */
function crearReconocedor() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.lang = 'es-AR';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    let finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalChunk += ' ' + event.results[i][0].transcript;
      }
    }
    if (finalChunk.trim()) {
      const nuevas = tokenizarTexto(finalChunk);
      state.recognizedWords.push(...nuevas);
      refrescarReconocimientoEnVivo();
    }
  };
  rec.onerror = (e) => {
    console.warn('Error de reconocimiento de voz:', e.error);
  };
  rec.onend = () => {
    if (state.recognizing && !state.finished) {
      // el navegador a veces corta el reconocimiento solo; lo reiniciamos si seguimos grabando
      try { rec.start(); } catch (_) {}
    }
  };
  return rec;
}

function refrescarReconocimientoEnVivo() {
  statWords.textContent = String(state.recognizedWords.length);

  const originalNorm = state.words.map(normalizarPalabra);
  const escuchadoNorm = state.recognizedWords.map(normalizarPalabra);
  const { indicesMarcados } = calcularPalabrasCorrectas(originalNorm, escuchadoNorm);

  document.querySelectorAll('#reading-text .word').forEach(span => {
    const idx = Number(span.dataset.idx);
    span.classList.toggle('word--heard', indicesMarcados.has(idx));
  });

  mascotMouth.setAttribute('d', indicesMarcados.size % 2 === 0
    ? 'M48 84 Q60 92 72 84'
    : 'M48 86 Q60 80 72 86');
}

/* --- grabación de audio --- */
async function iniciarGrabacionAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.mediaRecorder = new MediaRecorder(stream);
  state.audioChunks = [];
  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.audioChunks.push(e.data);
  };
  state.mediaRecorder.onstop = () => {
    state.audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
    stream.getTracks().forEach(t => t.stop());
  };
  state.mediaRecorder.start();
}

function detenerGrabacionAudio() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
}

/* --- timer --- */
function iniciarTimer() {
  state.startTimestamp = Date.now();
  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    timerSecondsEl.textContent = String(Math.max(state.timeLeft, 0));
    const offset = RING_CIRCUMFERENCE * (1 - state.timeLeft / 60);
    timerRingFg.style.strokeDashoffset = String(offset);
    if (state.timeLeft <= 0) {
      finalizarLectura();
    }
  }, 1000);
}

function detenerTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

/* --- botones de control --- */
btnRecord.addEventListener('click', async () => {
  if (state.recognizing) return;

  if (!('mediaDevices' in navigator)) {
    alert('Este navegador no permite acceder al micrófono.');
    return;
  }

  try {
    await iniciarGrabacionAudio();
  } catch (err) {
    alert('No se pudo acceder al micrófono. Revisá los permisos del navegador.');
    return;
  }

  state.recognition = crearReconocedor();
  if (state.recognition) {
    try { state.recognition.start(); } catch (_) {}
  } else {
    readingHint.textContent = 'Este navegador no reconoce el habla automáticamente; igual se va a grabar el audio.';
  }

  state.recognizing = true;
  state.finished = false;
  btnRecord.classList.add('recording');
  recordBtnLabel.textContent = 'Leyendo...';
  btnStop.hidden = false;
  statStatus.classList.add('live');
  statStatusLabel.textContent = 'grabando';
  readingHint.textContent = 'Leé en voz alta y clara. Se va a detener solo a los 60 segundos.';

  iniciarTimer();
});

btnStop.addEventListener('click', finalizarLectura);

function detenerTodo() {
  detenerTimer();
  if (state.recognition) { try { state.recognition.stop(); } catch (_) {} }
  detenerGrabacionAudio();
  state.recognizing = false;
}

function finalizarLectura() {
  if (state.finished) return;
  state.finished = true;
  detenerTodo();

  const elapsedSeconds = state.startTimestamp
    ? Math.min(60, (Date.now() - state.startTimestamp) / 1000)
    : 60;

  // pequeña espera para que termine de guardarse el blob de audio
  setTimeout(() => mostrarResultados(elapsedSeconds), 350);
}

/* ---------- pantalla resultados ---------- */
function mostrarResultados(elapsedSeconds) {
  const originalNorm = state.words.map(normalizarPalabra);
  const escuchadoNorm = state.recognizedWords.map(normalizarPalabra);
  const { correctas } = calcularPalabrasCorrectas(originalNorm, escuchadoNorm);

  const totalLeidas = state.recognizedWords.length;
  const minutos = Math.max(elapsedSeconds, 1) / 60;
  const wpm = Math.round(totalLeidas / minutos);
  const totalTexto = state.words.length;
  const precision = totalLeidas > 0 ? Math.round((correctas / Math.max(totalLeidas, totalTexto)) * 100) : 0;

  document.getElementById('results-name').textContent = state.studentName;
  document.getElementById('result-wpm').textContent = String(wpm);
  document.getElementById('result-correct').textContent = String(correctas);
  document.getElementById('result-total').textContent = String(totalTexto);
  document.getElementById('result-accuracy').textContent = `${Math.min(precision, 100)}%`;

  const reviewText = document.getElementById('review-text');
  reviewText.innerHTML = readingTextEl.innerHTML;

  const audioPlayer = document.getElementById('audio-player');
  if (state.audioBlob) {
    audioPlayer.src = URL.createObjectURL(state.audioBlob);
  } else {
    audioPlayer.removeAttribute('src');
  }

  const syncStatus = document.getElementById('sync-status');
  syncStatus.textContent = '';

  mostrarPantalla('screen-results');

  enviarResultados({
    studentName: state.studentName,
    grade: state.grade,
    text: state.text,
    wpm,
    correctWords: correctas,
    totalWords: totalTexto,
    readWords: totalLeidas,
    accuracy: Math.min(precision, 100),
    audioBlob: state.audioBlob,
  });
}

document.getElementById('btn-read-again').addEventListener('click', () => {
  prepararPantallaLectura();
  mostrarPantalla('screen-reading');
});
document.getElementById('btn-finish').addEventListener('click', () => mostrarPantalla('screen-menu'));

/* ---------- envío a Google Apps Script ---------- */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function enviarResultados(data) {
  const syncStatus = document.getElementById('sync-status');

  if (!state.webAppUrl) {
    syncStatus.textContent = 'No hay URL de Apps Script configurada: el resultado quedó solo en esta pantalla.';
    return;
  }

  syncStatus.textContent = 'Guardando en la planilla y subiendo el audio…';

  try {
    const payload = {
      studentName: data.studentName,
      grade: data.grade,
      text: data.text,
      wpm: data.wpm,
      correctWords: data.correctWords,
      totalWords: data.totalWords,
      readWords: data.readWords,
      accuracy: data.accuracy,
      timestamp: new Date().toISOString(),
      audioBase64: data.audioBlob ? await blobToBase64(data.audioBlob) : null,
      audioMimeType: data.audioBlob ? data.audioBlob.type : null,
    };

    const response = await fetch(state.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS con Apps Script
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ ok: response.ok }));
    if (result && result.ok) {
      syncStatus.textContent = '✅ Guardado en la planilla y el audio subido a Drive.';
    } else {
      syncStatus.textContent = '⚠️ Se envió, pero hubo un problema al guardar. Revisá el Apps Script.';
    }
  } catch (err) {
    console.error(err);
    syncStatus.textContent = '⚠️ No se pudo conectar con Apps Script. El resultado quedó solo en esta pantalla.';
  }
}

/* inicialización */
actualizarPreviewPalabras();
