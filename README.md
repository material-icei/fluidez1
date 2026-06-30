# Vuela Leyendo — Guía de instalación

App web de fluidez lectora para 1º grado, pensada para Chromebooks (formato horizontal).
Archivos: `index.html`, `styles.css`, `app.js` (la app) y `Code.gs` (el backend en Apps Script).

---

## 1. Probar la app sin Google (rápido)

Podés abrir `index.html` directamente en Chrome para ver el diseño y probar la lectura.
Sin conectar Apps Script, los resultados se muestran igual en pantalla, pero no se guardan en ningún lado.

Para que el micrófono funcione, Chrome exige **https o localhost** (no funciona abriendo el archivo con doble clic en algunos casos). Si tenés problemas, subí los 3 archivos a un hosting simple (GitHub Pages, por ejemplo) o usá un servidor local:

```
cd lectura-app
python3 -m http.server 8000
```

y abrí `http://localhost:8000`.

---

## 2. Crear la Google Sheet

1. Andá a [sheets.google.com](https://sheets.google.com) y creá una hoja nueva. Ponele de nombre, por ejemplo, **"Vuela Leyendo - Resultados"**.
2. Mirá la URL. Vas a ver algo así:
   `https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrSt/edit`
   El **ID** es la parte entre `/d/` y `/edit`: `1AbCdEfGhIjKlMnOpQrSt`. Guardalo, lo vas a necesitar.

## 3. Crear la carpeta de Drive para los audios

1. Andá a [drive.google.com](https://drive.google.com) y creá una carpeta nueva, por ejemplo **"Audios Vuela Leyendo"**.
2. Entrá a la carpeta y copiá el ID de la URL de la misma forma:
   `https://drive.google.com/drive/folders/1XyZ...` → el ID es `1XyZ...`.

## 4. Pegar el código en Apps Script

1. Desde la Google Sheet que creaste, andá a **Extensiones → Apps Script**.
2. Borrá el contenido del archivo `Code.gs` que aparece por defecto y pegá ahí el contenido del archivo `Code.gs` de esta carpeta.
3. Arriba del todo, reemplazá:
   - `SHEET_ID` por el ID de la Sheet (paso 2).
   - `DRIVE_FOLDER_ID` por el ID de la carpeta de Drive (paso 3).
4. Guardá el proyecto (ícono de disquete o `Ctrl+S`). Podés ponerle de nombre "Vuela Leyendo Backend".

## 5. Publicar como aplicación web

1. Arriba a la derecha, hacé clic en **Implementar → Nueva implementación**.
2. En "Selecciona el tipo", elegí el ícono de engranaje y seleccioná **Aplicación web**.
3. Configurá:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier usuario
4. Hacé clic en **Implementar**.
5. Google te va a pedir autorizar permisos (porque el script escribe en tu Sheet y tu Drive). Aceptá los permisos con tu cuenta de docente/institucional.
6. Copiá la **URL de la aplicación web** que te da Google. Termina en `/exec`. Ejemplo:
   `https://script.google.com/macros/s/AKfycb.../exec`

> Cada vez que modifiques `Code.gs`, tenés que hacer **Implementar → Administrar implementaciones → ✏️ editar → Nueva versión → Implementar** para que los cambios se apliquen a esa misma URL.

## 6. Conectar la app web con Apps Script

1. Abrí la app (`index.html`) en Chrome.
2. Entrá a **"Preparar texto y datos"**.
3. Pegá la URL del paso 5 en el campo **"URL de Apps Script (Web App)"**.
4. Completá nombre del alumno, curso y el texto a leer, y arrancá la actividad.

Al terminar la lectura, la app sube automáticamente:
- una fila nueva en la hoja **"Resultados"** de tu Google Sheet (fecha, alumno, curso, palabras por minuto, palabras correctas, palabras del texto, precisión y el link al audio),
- el archivo de audio dentro de la carpeta de Drive que configuraste.

---

## Cómo funciona el conteo automático

- La app usa el **reconocimiento de voz del navegador** (Web Speech API, en español), que funciona mejor en Chrome y necesita conexión a internet.
- Mientras el alumno lee, cada palabra reconocida se compara contra el texto original usando un algoritmo de coincidencia en orden (similar a "buscar las palabras en común manteniendo la secuencia"). Las palabras que coinciden se marcan en verde sobre el texto.
- **Palabras leídas por minuto**: total de palabras que el micrófono reconoció, ajustado a los segundos efectivos de lectura (máximo 60 segundos).
- **Palabras correctas**: cantidad de palabras del texto original que fueron reconocidas en el orden correcto.
- El audio se graba en paralelo con `MediaRecorder` y queda disponible para escuchar en la pantalla de resultados, además de subirse a Drive.

El reconocimiento de voz es una ayuda automática, no es perfecto (un Chromebook en un aula con ruido puede perder alguna palabra). Por eso siempre queda el audio guardado: el docente puede escucharlo y, si quiere, corregir el conteo a mano mirando la fila correspondiente en la Sheet.

## Permisos del navegador

La primera vez que un alumno toque "Empezar a leer", Chrome va a pedir permiso para usar el micrófono. Hay que aceptar "Permitir". Si quedó bloqueado por error, se puede volver a habilitar tocando el ícono de candado/micrófono en la barra de direcciones.
