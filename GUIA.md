# Publicar las bitácoras en GitHub Pages

Con esto las bitácoras quedan en una dirección fija (por ejemplo `https://tuusuario.github.io/bitacoras/`), se instalan como app en el teléfono, abren sin señal y los datos ya no se pierden al cerrar Chrome.

Lo que se publica es solo el programa. Tus lecturas se guardan en el teléfono y **no se suben al repositorio**. Solo salen del teléfono si activas "Compartir con el equipo" (sección 8), y entonces van a tu hoja de Google Sheets. No subas respaldos (.json) ni CSV al repositorio.

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
2. En `sw.js` cambia el número de `const VERSION = "bitacoras-v4";` por el siguiente (`"bitacoras-v5"`, y así sucesivamente). Sin este cambio, los teléfonos seguirán usando la copia guardada.
3. En el teléfono, abre la app con internet dos veces: la primera descarga la versión nueva y la segunda la usa. Tus datos no se tocan.

## 8. Compartir con el equipo (Google Sheets)

Cada persona captura en su teléfono como siempre. Cuando hay señal, la app sube sus lecturas a una hoja de Google Sheets y baja las de los demás. Sin señal no pasa nada: se suben cuando vuelve.

### Preparar la hoja (una sola vez, una persona, mejor desde la PC)

1. En Google Drive crea una hoja de cálculo nueva, por ejemplo "Bitácoras del sitio".
2. En la hoja: **Extensiones → Apps Script**.
3. Borra lo que aparece y pega todo el contenido del archivo `apps-script/Codigo.gs` de este repositorio.
4. En la línea `const CLAVE = "CAMBIA_ESTA_CLAVE";` escribe una clave para el equipo, por ejemplo `const CLAVE = "sala-electrica-2026";`. Es la que escribirá cada persona en la app.
5. Presiona **Guardar** (ícono de disco).
6. Arriba a la derecha: **Implementar → Nueva implementación**. En el engrane elige **Aplicación web** y llena:
   - Descripción: `Bitácoras`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
7. Presiona **Implementar**, luego **Autorizar acceso** y elige tu cuenta. Si aparece "Google no verificó esta app", toca **Configuración avanzada → Ir a Bitácoras (no seguro)**: es tu propio script.
8. Copia la **URL de la aplicación web** (termina en `/exec`). Si la abres en el navegador debe decir "El servidor de las bitácoras está activo".

Las pestañas **UPS**, **Interruptores** y **Equipos interruptores** se crean solas con la primera lectura. Las fotos se guardan en la carpeta de Drive **"Bitácoras - fotos"**.

### Conectar cada teléfono

En cualquiera de las dos bitácoras: **Ajustes → Compartir con el equipo**. Pega la dirección del script, escribe la clave y tu nombre, y toca **Conectar y sincronizar**. Basta hacerlo en una bitácora: la configuración aplica a las dos.

La primera vez se suben todas las lecturas que ya tenías en el teléfono. Arriba de cada bitácora aparece la barra ☁ con el estado. Tócala para sincronizar en ese momento.

### Cómo funciona

- **Lecturas:** cada una es un renglón con la persona que la capturó. Las de los demás aparecen en tu Historial, Resumen, Tendencias e Informe.
- **Fotos:** se bajan de Drive la primera vez que las abres o generas un informe.
- **Interruptores:** el catálogo y las líneas base también se comparten. Si dos personas dan de alta el mismo identificador, se queda el primero y las lecturas del segundo se pasan a ese.
- **Borrados:** borra siempre desde la app (Historial → Borrar), no en la hoja; así el borrado llega a todos los teléfonos. En la hoja la lectura queda marcada con la fecha en la columna "Borrado".
- **Columnas de la derecha:** `rev`, `id` y `datos` las usa la app. No las edites.
- **Parámetros:** los de UPS y los límites de interruptores siguen siendo de cada teléfono.

### Si cambias el script

Después de editar `Codigo.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la dirección no cambia. Si creas una implementación nueva, la dirección cambia y hay que pegarla otra vez en cada teléfono.

### Seguridad

Cualquiera con la dirección **y** la clave puede leer y escribir en la hoja. Compártelas solo con el equipo. Si la clave se filtra, cámbiala en el script, publica una nueva versión y actualízala en los teléfonos.

## Notas

- Si borras los datos de Chrome o desinstalas la app, se borran las lecturas. Por eso el respaldo semanal.
- Cada bitácora guarda sus datos por separado; no se mezclan.
- Antes de usarla con información del sitio, confirma con tu supervisor que está permitido registrar estos datos en un teléfono.
- Alternativa a GitHub: Netlify (app.netlify.com/drop) permite arrastrar la carpeta desde la PC; crea una cuenta para que el sitio no expire.
