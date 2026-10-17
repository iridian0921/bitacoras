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
3. Arrastra **todo el contenido** de la carpeta `bitacoras` (index.html, ups.html, interruptores.html, calidad.html, baterias.html, sincronizacion.html, transferencia-ctos1.html, diagnostico.html, comun.css, comun.js, sw.js, manifest.webmanifest y la carpeta icons). Deben quedar en la raíz del repositorio, no dentro de otra carpeta.
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
2. En `sw.js` cambia el número de `const VERSION = "bitacoras-v39";` por el siguiente (`"bitacoras-v40"`, y así sucesivamente). Sin este cambio, los teléfonos seguirán usando la copia guardada.
3. En el teléfono, abre la app con internet. Cuando termine de descargar la versión nueva aparece abajo el aviso **"Hay una versión nueva de la app"**: toca **Actualizar**. Tus datos no se tocan. La pantalla de inicio muestra la versión instalada.
4. Si el teléfono se queda con una versión vieja, abre en Chrome `https://tuusuario.github.io/bitacoras/reparar.html` y toca **Reparar ahora** (también está el botón **Reparar actualización** en la pantalla de inicio). Vuelve a descargar el programa sin borrar lecturas, fotos ni ajustes. Esa página siempre se baja del servidor, aunque la copia del teléfono esté atorada, y muestra un diagnóstico que puedes copiar.

## 8. Compartir con el equipo (Google Sheets)

Cada persona captura en su teléfono como siempre. Cuando hay señal, la app sube sus lecturas a una hoja de Google Sheets y baja las de los demás. Sin señal no pasa nada: se suben cuando vuelve.

### Preparar la hoja (una sola vez, una persona, mejor desde la PC)

1. En Google Drive crea una hoja de cálculo nueva, por ejemplo "Bitácoras del sitio".
2. En la hoja: **Extensiones → Apps Script**.
3. Borra lo que aparece y pega todo el contenido del archivo `apps-script/Codigo.gs` de este repositorio.
4. **Claves personales.** Arriba del script está el cuadro `USUARIOS` (Iridian administradora; Gerardo solo lectura; Diana, Jorge y Manuel captura). Cada persona necesita su propia clave:
   - Presiona **Guardar** (ícono de disco), elige la función **generarClaves** en la lista de arriba y toca **Ejecutar**. En el **Registro de ejecución** aparecen 5 claves de 16 caracteres.
   - Copia cada una en su renglón, en lugar de `CAMBIA_CLAVE_…`. No reutilices claves ni uses palabras fáciles.
   - Entrégale a cada quien **solo la suya**, en persona o por mensaje directo (no en un grupo).
5. Presiona **Guardar** otra vez.
6. Arriba a la derecha: **Implementar → Nueva implementación**. En el engrane elige **Aplicación web** y llena:
   - Descripción: `Bitácoras`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
7. Presiona **Implementar**, luego **Autorizar acceso** y elige tu cuenta. Si aparece "Google no verificó esta app", toca **Configuración avanzada → Ir a Bitácoras (no seguro)**: es tu propio script.
8. Copia la **URL de la aplicación web** (termina en `/exec`). Si la abres en el navegador debe decir "El servidor de las bitácoras está activo".

Las pestañas **UPS**, **Interruptores**, **Equipos interruptores**, **Calidad de energía**, **Medidores calidad**, **Reemplazos baterías** y **Baterías por mes** se crean solas con la primera lectura. Las fotos se guardan en la carpeta de Drive **"Bitácoras - fotos"**.

### Conectar cada teléfono

En cualquiera de las bitácoras: **Ajustes → Compartir con el equipo**. Pega la dirección del script, escribe **tu clave personal** y toca **Conectar y sincronizar**. Abajo aparece «Conectada como …» con tu nombre y tu rol: el nombre lo pone el script según la clave, así nadie puede capturar a nombre de otra persona. Basta hacerlo en una bitácora: la configuración aplica a todas.

La primera vez se suben todas las lecturas que ya tenías en el teléfono. Arriba de cada bitácora aparece la barra ☁ con el estado. Tócala para sincronizar en ese momento.

### Cómo funciona

- **Lecturas:** cada una es un renglón con la persona que la capturó. Las de los demás aparecen en tu Historial (columna **Capturó**), Resumen, Tendencias e Informe.
- **Fotos:** se bajan de Drive la primera vez que las abres o generas un informe.
- **Interruptores y medidores de calidad:** el catálogo (y en interruptores, las líneas base) también se comparte.
- **Baterías:** la telemetría diaria de Gexia se queda en el teléfono que cargó los CSV. Se comparten el **resumen mensual de cada banco** (estado, conteos, resistencia mediana, flotación, hallazgos y las 20 baterías más urgentes) y el **registro de reemplazos** con su foto. Quien no cargó los CSV ve los bancos con ☁ y puede generar el informe con esos resúmenes. La telemetría de los cargadores (CSV `CARGADORES_LADO_A` y `_B`) también se queda en el teléfono, agrupada por hora; no se sube a la hoja. Si dos personas dan de alta el mismo identificador, se queda el primero y las lecturas del segundo se pasan a ese.
- **Borrados:** borra siempre desde la app (Historial → Borrar), no en la hoja; así el borrado llega a todos los teléfonos. En la hoja la lectura queda marcada con la fecha en la columna "Borrado".
- **Columnas de la derecha:** `rev`, `id` y `datos` las usa la app. No las edites.
- **Parámetros:** los de UPS y los límites de interruptores y de calidad de energía siguen siendo de cada teléfono.

### Si una bitácora dice que el script es de una versión anterior

La hoja necesita el `Codigo.gs` actualizado. Copia el archivo nuevo completo, vuelve a poner las claves del cuadro `USUARIOS` y publícalo como se explica abajo. Las lecturas que ya están en la hoja no se tocan.

### Si cambias el script

Después de editar `Codigo.gs`: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así la dirección no cambia. Si creas una implementación nueva, la dirección cambia y hay que pegarla otra vez en cada teléfono.

### Usuarios y permisos

- **Administradora (Iridian):** siempre tiene acceso. En **Ajustes → Compartir con el equipo → Usuarios → Ver usuarios** habilita o deshabilita el **acceso** y la **captura** de cada persona, o de todos a la vez («Deshabilitar a todos» / «Habilitar a todos»). No se necesita tocar el script; el cambio se aplica en la siguiente sincronización de esa persona.
- **Captura:** ve y sube lecturas, fotos, equipos y borrados.
- **Solo lectura (Gerardo):** ve todo lo del equipo, pero en su app no aparecen los botones de guardar y el script rechaza cualquier intento de subir o borrar. La administradora puede habilitarle la captura desde el mismo panel.
- **Deshabilitado:** el script ya no le responde. Lo que tenga en su teléfono no se borra, pero ya no recibe ni envía nada.

### Seguridad

- **Una clave por persona.** Si una clave se filtra o alguien deja el equipo: deshabilítalo desde el panel (inmediato) y después cámbiale la clave en el script o borra su renglón, y publica una nueva versión.
- **La hoja y la carpeta de fotos no se comparten.** El script entra con tu cuenta; nadie más necesita acceso directo. En Drive, **Compartir** en la hoja «Bitácoras del sitio» y en la carpeta «Bitácoras - fotos» debe mostrar solo a ti (y, si quieres, a quien deba revisar la hoja). «Acceso general» debe decir **Restringido**, no «Cualquier persona con el vínculo».
- **La dirección del script** (`/exec`) sola no da acceso: sin una clave registrada el script no responde datos.
- **El programa** (las páginas de la app) está publicado en GitHub Pages y es visible para quien tenga la dirección, pero no contiene lecturas: esas viven en cada teléfono y en tu hoja.

## Notas

- Si borras los datos de Chrome o desinstalas la app, se borran las lecturas. Por eso el respaldo semanal.
- Cada bitácora guarda sus datos por separado; no se mezclan.
- **Logo de los informes:** en el inicio, tarjeta «Logo de los informes» → «Elegir logo» (PNG o JPG; se reduce solo). Sale en la cabecera de los informes de todas las bitácoras, en pantalla, PDF y HTML. Se guarda en ese teléfono; cada teléfono elige el suyo y no se sincroniza.
- Antes de usarla con información del sitio, confirma con tu supervisor que está permitido registrar estos datos en un teléfono.
- Alternativa a GitHub: Netlify (app.netlify.com/drop) permite arrastrar la carpeta desde la PC; crea una cuenta para que el sitio no expire.
