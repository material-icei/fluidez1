/**
 * VUELA LEYENDO — Apps Script backend
 * --------------------------------------------------------------
 * Recibe los resultados de la actividad de lectura en voz alta,
 * los guarda como una fila nueva en una Google Sheet, y sube el
 * audio grabado a una carpeta de Google Drive.
 *
 * INSTALACIÓN (resumen, ver README.md para el paso a paso):
 * 1. Crear una Google Sheet nueva. Copiar su ID (está en la URL).
 * 2. Crear (o elegir) una carpeta en Google Drive para los audios.
 *    Copiar su ID (también está en la URL de la carpeta).
 * 3. Abrir Extensiones > Apps Script desde esa Sheet, pegar este código.
 * 4. Completar SHEET_ID y DRIVE_FOLDER_ID abajo.
 * 5. Implementar > Nueva implementación > Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 6. Copiar la URL que termina en /exec y pegarla en la app web
 *    (campo "URL de Apps Script" en la pantalla de configuración).
 */

const SHEET_ID = 'PEGAR_AQUI_EL_ID_DE_LA_GOOGLE_SHEET';
const DRIVE_FOLDER_ID = 'PEGAR_AQUI_EL_ID_DE_LA_CARPETA_DE_DRIVE';
const SHEET_NAME = 'Resultados';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const audioUrl = guardarAudioEnDrive(data);
    guardarFilaEnSheet(data, audioUrl);

    return respuestaJson({ ok: true, audioUrl: audioUrl || null });
  } catch (err) {
    return respuestaJson({ ok: false, error: String(err) });
  }
}

function doGet() {
  return ContentService.createTextOutput(
    'El backend de Vuela Leyendo está funcionando. Usá POST para enviar resultados.'
  );
}

function respuestaJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function guardarAudioEnDrive(data) {
  if (!data.audioBase64) return '';

  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const mime = data.audioMimeType || 'audio/webm';
  const extension = mime.indexOf('webm') > -1 ? 'webm' : 'wav';

  const fecha = new Date();
  const fechaTexto = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  const nombreArchivo = `${limpiarNombre(data.studentName)}_${fechaTexto}.${extension}`;

  const bytes = Utilities.base64Decode(data.audioBase64);
  const blob = Utilities.newBlob(bytes, mime, nombreArchivo);

  const archivo = folder.createFile(blob);
  // Para que la maestra/o pueda escucharlo desde el link sin pedir permisos extra:
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return archivo.getUrl();
}

function guardarFilaEnSheet(data, audioUrl) {
  const sheet = obtenerOPrepararHoja();

  sheet.appendRow([
    new Date(),
    data.studentName || '',
    data.grade || '',
    data.wpm || 0,
    data.correctWords || 0,
    data.totalWords || 0,
    data.readWords || 0,
    (data.accuracy || 0) + '%',
    audioUrl || '',
    data.text || '',
  ]);
}

function obtenerOPrepararHoja() {
  const libro = SpreadsheetApp.openById(SHEET_ID);
  let hoja = libro.getSheetByName(SHEET_NAME);

  if (!hoja) {
    hoja = libro.insertSheet(SHEET_NAME);
  }

  if (hoja.getLastRow() === 0) {
    hoja.appendRow([
      'Fecha y hora',
      'Alumno/a',
      'Curso',
      'Palabras por minuto',
      'Palabras correctas',
      'Palabras del texto',
      'Palabras leídas (total)',
      'Precisión',
      'Audio (link Drive)',
      'Texto leído',
    ]);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, 10).setFontWeight('bold');
  }

  return hoja;
}

function limpiarNombre(nombre) {
  return (nombre || 'alumno')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
