/* Servidor de las Bitácoras de inspección en Google Sheets.
   Se pega en la hoja: Extensiones → Apps Script. Instrucciones en GUIA.md, "Compartir con el equipo".

   Cada lectura es un renglón. Las columnas de la izquierda son para leer; las de la derecha
   (rev, id, datos) las usa la app: no las edites ni las borres. Para borrar una lectura,
   hazlo desde la app (Historial → Borrar) para que el borrado llegue a todos los teléfonos. */

const CLAVE = "CAMBIA_ESTA_CLAVE";   // la clave del equipo: escribe la misma en la app

const HOJAS = {
  ups: {nombre:"UPS", vista:["Fecha","Rama","Equipo","kW","kVA","Estado","Nota"]},
  interruptores: {nombre:"Interruptores", vista:["Fecha","Interruptor","Tablero","I1 (A)","I2 (A)","I3 (A)","IN (A)","Estado","Nota"]},
  equipos: {nombre:"Equipos interruptores", vista:["Identificador","Tablero","Rama","In (A)","Descripción","Línea base"]}
};
const TECNICAS = ["Capturó","Guardado","Foto","Borrado","rev","id","datos"];
const POR_BITACORA = {ups:"ups", interruptores:"interruptores"};

function doGet(){
  return json({ok:true, mensaje:"El servidor de las bitácoras está activo. Copia esta dirección en la app (Ajustes → Compartir con el equipo)."});
}

function doPost(e){
  let p;
  try{ p = JSON.parse(e.postData.contents); }catch(err){ return json({ok:false, error:"Solicitud inválida."}); }
  if (CLAVE === "CAMBIA_ESTA_CLAVE") return json({ok:false, error:"Falta cambiar la CLAVE en el script (línea 8) y volver a implementar."});
  if (p.clave !== CLAVE) return json({ok:false, error:"La clave del equipo no coincide."});
  if (!POR_BITACORA[p.bitacora]) return json({ok:false, error:"Bitácora desconocida."});
  try{
    if (p.accion === "ping") return json({ok:true});
    if (p.accion === "foto") return json(foto(p));
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try{
      if (p.accion === "sync") return json(sync(p));
      if (p.accion === "subirFoto") return json(subirFoto(p));
    }finally{ lock.releaseLock(); }
    return json({ok:false, error:"Acción desconocida."});
  }catch(err){
    return json({ok:false, error:"Error en el script: " + (err && err.message || err)});
  }
}

function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ===== hojas ===== */
function abrir(clave){
  const def = HOJAS[clave], ss = SpreadsheetApp.getActiveSpreadsheet();
  const cab = def.vista.concat(TECNICAS);
  let sh = ss.getSheetByName(def.nombre);
  if (!sh){
    sh = ss.insertSheet(def.nombre);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  const head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  const col = {};
  head.forEach((h, i) => { if (h !== "") col[h] = i; });
  cab.forEach(h => {                       // columnas que falten (hoja vieja o editada a mano)
    if (!(h in col)){ const c = sh.getLastColumn() + 1; sh.getRange(1, c).setValue(h).setFontWeight("bold"); col[h] = c - 1; }
  });
  const ancho = Math.max.apply(null, Object.keys(col).map(k => col[k])) + 1;
  const n = sh.getLastRow() - 1;
  const filas = n > 0 ? sh.getRange(2, 1, n, ancho).getValues() : [];
  const porId = new Map();
  filas.forEach((f, i) => { if (f[col.id]) porId.set(String(f[col.id]), i); });
  return {sh, col, ancho, filas, porId};
}
function aFila(H, obj){
  const f = new Array(H.ancho).fill("");
  Object.keys(obj).forEach(k => { if (k in H.col) f[H.col[k]] = obj[k]; });
  return f;
}
function agregar(H, objs){
  if (!objs.length) return;
  const filas = objs.map(o => aFila(H, o));
  H.sh.getRange(H.sh.getLastRow() + 1, 1, filas.length, H.ancho).setValues(filas);
}
function actualizar(H, i, obj){
  Object.keys(obj).forEach(k => { if (k in H.col) H.filas[i][H.col[k]] = obj[k]; });
  H.sh.getRange(i + 2, 1, 1, H.ancho).setValues([H.filas[i]]);
}
function cambios(H, desde){
  const out = [];
  H.filas.forEach(f => {
    if (Number(f[H.col.rev]) <= desde || !f[H.col.id]) return;
    let datos = {};
    try{ datos = JSON.parse(f[H.col.datos] || "{}"); }catch(err){}
    out.push({id:String(f[H.col.id]), datos, borrado:!!f[H.col.Borrado], foto:!!f[H.col.Foto], autor:String(f[H.col["Capturó"]] || "")});
  });
  return out;
}
function vista(it){
  const v = Object.assign({}, it.vista || {});
  if (v.Fecha) v.Fecha = new Date(v.Fecha);
  return v;
}

/* ===== sincronización =====
   rev es un contador global: cada renglón nuevo o cambiado recibe el siguiente número,
   y cada teléfono pide "lo que cambió desde el último rev que vi". */
function sync(p){
  const props = PropertiesService.getScriptProperties();
  let rev = Number(props.getProperty("rev") || 0);
  const ahora = new Date(), remap = {};
  const desde = Number(p.desde || 0);
  let E = null;

  if (p.bitacora === "interruptores"){
    E = abrir("equipos");
    const porTag = new Map();
    E.filas.forEach((f, i) => { if (!f[E.col.Borrado]) porTag.set(String(f[E.col.Identificador]).trim().toLowerCase(), i); });
    const nuevos = [];
    (p.equipos || []).forEach(it => {
      if (!it || !it.id || !it.datos) return;
      const i = E.porId.get(it.id), d = it.datos;
      if (i === undefined){
        const tag = String(d.tag || "").trim().toLowerCase(), j = porTag.get(tag);
        if (j !== undefined){ remap[it.id] = String(E.filas[j][E.col.id]); return; }   // ya registrado por otra persona
        rev++;
        nuevos.push(Object.assign(vista(it), {"Capturó":it.autor || "", Guardado:ahora, rev, id:it.id, datos:JSON.stringify(d)}));
        E.porId.set(it.id, -1); porTag.set(tag, -1);
      } else if (i >= 0 && !E.filas[i][E.col.Borrado]){
        let prev = {}; try{ prev = JSON.parse(E.filas[i][E.col.datos] || "{}"); }catch(err){}
        if ((d.upd || 0) > (prev.upd || 0)){
          rev++;
          actualizar(E, i, Object.assign(vista(it), {"Capturó":it.autor || "", Guardado:ahora, rev, datos:JSON.stringify(d)}));
        }
      }
    });
    agregar(E, nuevos);
    (p.borrarEq || []).forEach(id => {
      const i = E.porId.get(id);
      if (i >= 0 && !E.filas[i][E.col.Borrado]){ rev++; actualizar(E, i, {Borrado:ahora, rev}); }
    });
  }

  const H = abrir(POR_BITACORA[p.bitacora]);
  const nuevas = [];
  (p.subir || []).forEach(it => {
    if (!it || !it.id || !it.datos || H.porId.has(it.id)) return;     // una lectura guardada no cambia
    const d = it.datos;
    if (d.eq && remap[d.eq]) d.eq = remap[d.eq];
    rev++;
    nuevas.push(Object.assign(vista(it), {"Capturó":it.autor || "", Guardado:ahora, rev, id:it.id, datos:JSON.stringify(d)}));
    H.porId.set(it.id, -1);
  });
  agregar(H, nuevas);
  (p.borrar || []).forEach(id => {
    const i = H.porId.get(id);
    if (i >= 0 && !H.filas[i][H.col.Borrado]){ rev++; actualizar(H, i, {Borrado:ahora, rev}); }
  });
  props.setProperty("rev", String(rev));

  const res = {ok:true, cursor:rev, remap, lecturas:cambios(abrir(POR_BITACORA[p.bitacora]), desde)};
  if (E){
    const E2 = abrir("equipos"), destinos = new Set(Object.keys(remap).map(k => remap[k]));
    res.equipos = cambios(E2, desde);
    // los equipos a los que se reasignó algo van siempre, aunque el teléfono ya los hubiera visto
    E2.filas.forEach(f => {
      const id = String(f[E2.col.id]);
      if (destinos.has(id) && !res.equipos.some(x => x.id === id)) res.equipos.push(cambios({filas:[f], col:E2.col}, -1)[0]);
    });
  }
  return res;
}

/* ===== fotos en Drive ===== */
function carpeta(){
  const props = PropertiesService.getScriptProperties(), id = props.getProperty("carpeta");
  if (id){ try{ return DriveApp.getFolderById(id); }catch(err){} }
  const c = DriveApp.createFolder("Bitácoras - fotos");
  props.setProperty("carpeta", c.getId());
  return c;
}
function subirFoto(p){
  const H = abrir(POR_BITACORA[p.bitacora]), i = H.porId.get(p.id);
  if (i === undefined) return {ok:false, error:"La lectura todavía no está en la hoja."};
  if (H.filas[i][H.col.Foto]) return {ok:true};
  const blob = Utilities.newBlob(Utilities.base64Decode(p.b64), p.tipo || "image/jpeg", p.id + ".jpg");
  const f = carpeta().createFile(blob);
  const props = PropertiesService.getScriptProperties(), rev = Number(props.getProperty("rev") || 0) + 1;
  props.setProperty("rev", String(rev));
  actualizar(H, i, {Foto:f.getUrl(), rev});        // el nuevo rev avisa a los demás que ya hay foto
  return {ok:true};
}
function foto(p){
  const H = abrir(POR_BITACORA[p.bitacora]), i = H.porId.get(p.id);
  const url = i === undefined ? "" : String(H.filas[i][H.col.Foto] || "");
  const m = url.match(/[-\w]{25,}/);
  if (!m) return {ok:false, error:"Esa lectura no tiene foto en Drive."};
  const b = DriveApp.getFileById(m[0]).getBlob();
  return {ok:true, tipo:b.getContentType(), b64:Utilities.base64Encode(b.getBytes())};
}
