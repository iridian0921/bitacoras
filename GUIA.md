# Publicar las bitácoras en GitHub Pages

Con esto las bitácoras quedan en una dirección fija (por ejemplo `https://tuusuario.github.io/bitacoras/`), se instalan como app en el teléfono, abren sin señal y los datos ya no se pierden al cerrar Chrome.

Lo que se publica es solo el programa. **Tus lecturas nunca se suben a internet**: se guardan en el teléfono. No subas respaldos (.json) ni CSV al repositorio.

## 1. Crear la cuenta y el repositorio (una sola vez, 10 minutos, mejor desde la PC)

1. Entra a github.com y crea una cuenta gratuita.
2. Arriba a la derecha: **+ → New repository**.
3. Nombre: `bitacoras`. Déjalo en **Public** (GitHub Pages gratuito requiere repositorio público; el código no contiene datos del sitio).
4. Marca **Add a README file** y presiona **Create repository**.

## 2. Subir los archivos

1. Descomprime el ZIP en tu PC.
2. En el repositorio: **Add file → Upload files**.
3. Arrastra **todo el contenido** de la carpeta `bitacoras` (index.html, ups.html, interruptores.html, diagnostico.html, comun.css, comun.js, sw.js, manifest.webmanifest y la carpeta icons). Deben quedar en la raíz del repositorio, no dentro de otra carpeta.
4. Abajo presiona **Commit changes**.

## 3. Activar GitHub Pages

1. En el repositorio: **Settings → Pages**.
2. En **Source** elige **Deploy from a branch**; en **Branch** elige `main` y carpeta `/ (root)`. Presiona **Save**.
3. Espera 1 a 3 minutos y recarga la página: arriba aparecerá la dirección, algo como `https://tuusuario.github.io/bitacoras/`.

## 4. Instalar en el teléfono

1. Abre esa dirección en **Chrome** del teléfono, con internet.
2. Espera a que la pantalla de inicio diga **"Lista para usarse sin señal"**.
3. Menú **⋮ → Instalar app** (o "Agregar a pantalla principal").
4. Desde ahora ábrela **siempre desde el ícono**. Funciona sin señal dentro del data center.

La pantalla principal muestra el estado del teléfono: dirección fija, modo sin señal, almacenamiento protegido y días desde el último respaldo de cada bitácora.

## 5. Pasar datos de la versión anterior

Si recuperaste registros en la versión de archivo:

1. En la versión vieja: **Ajustes → Descargar respaldo**.
2. En la app instalada: **Ajustes → Restaurar respaldo** y elige ese archivo.

Si solo tienes CSV exportados de la bitácora de UPS: **Ajustes → Importar CSV**. Puedes importar varios; los duplicados se detectan solos. Las fotos no viajan en respaldos ni en CSV.

## 6. Rutina recomendada

- Al guardar el último equipo de la ronda aparece **"Ronda completa: descargar respaldo"**. Tócalo y guarda el archivo en Drive o en tu PC.
- Si pasan más de 7 días o se acumulan 30 lecturas sin respaldo, la app te avisa arriba.

## 7. Publicar una actualización

1. Sube los archivos nuevos al repositorio (Add file → Upload files, reemplazan a los anteriores).
2. En `sw.js` cambia el número de `const VERSION = "bitacoras-v3";` por el siguiente (`"bitacoras-v4"`, y así sucesivamente). Sin este cambio, los teléfonos seguirán usando la copia guardada.
3. En el teléfono, abre la app con internet dos veces: la primera descarga la versión nueva y la segunda la usa. Tus datos no se tocan.

## Notas

- Si borras los datos de Chrome o desinstalas la app, se borran las lecturas. Por eso el respaldo semanal.
- Cada bitácora guarda sus datos por separado; no se mezclan.
- Antes de usarla con información del sitio, confirma con tu supervisor que está permitido registrar estos datos en un teléfono.
- Alternativa a GitHub: Netlify (app.netlify.com/drop) permite arrastrar la carpeta desde la PC; crea una cuenta para que el sitio no expire.
