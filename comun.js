/* Código compartido por las bitácoras (ups.html e interruptores.html).
   Al cambiar este archivo, sube también la VERSION en sw.js. */
const Comun = (() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ================= formato ================= */
const num = v => (v === null || v === undefined || v === "" || isNaN(+v)) ? null : +v;
const pct = (x,d=1) => x===null||x===undefined||!isFinite(x) ? "—" : (x*100).toFixed(d)+" %";
const fx = (x,d=1) => x===null||x===undefined||!isFinite(x) ? "—" : (+x).toFixed(d);
const fmtFecha = new Intl.DateTimeFormat("es-MX", {dateStyle:"short", timeStyle:"short"});
const fdate = iso => { const d = new Date(iso); return isNaN(d) ? esc(iso) : fmtFecha.format(d); };
/* "AAAA-MM-DDTHH:MM" en hora local, para inputs datetime-local y CSV. */
const isoLocal = (d = new Date()) => new Date(d - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
const nowLocal = () => isoLocal();
const stamp = () => new Date().toISOString().slice(0,10);
const horaArchivo = () => { const d = new Date(); return String(d.getHours()).padStart(2,"0") + String(d.getMinutes()).padStart(2,"0"); };

function download(name, data, type){
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = document.createElement("a"); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
const csvCelda = v => { const s = v===null||v===undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
const descargarCSV = (name, head, filas) =>
  download(name, "﻿" + [head, ...filas].map(f => f.map(csvCelda).join(",")).join("\r\n"), "text/csv;charset=utf-8");
const blobToDataURL = b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); });
function estado(st, texto, err = false){ st.classList.toggle("err", err); st.textContent = texto; }

/* ================= fotos en IndexedDB =================
   Se guardan como ArrayBuffer (más compatible que Blob en algunos navegadores). */
function fotosDB(nombre){
  const ready = new Promise(res => {
    try{
      const rq = indexedDB.open(nombre, 1);
      rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains("fotos")) rq.result.createObjectStore("fotos"); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
      setTimeout(() => res(null), 5000);
    }catch{ res(null); }
  });
  async function put(k, blob){
    const db = await ready; if (!db) throw new Error("sin IndexedDB");
    const buf = await blob.arrayBuffer();
    await new Promise((res,rej)=>{ const t=db.transaction("fotos","readwrite"); t.objectStore("fotos").put({type:blob.type||"image/jpeg", buf}, k); t.oncomplete=res; t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); });
  }
  async function getLocal(k){
    const db = await ready; if (!db) return null;
    const v = await new Promise(res=>{ try{ const r=db.transaction("fotos").objectStore("fotos").get(k); r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null); }catch{ res(null); } });
    if (!v) return null;
    if (v instanceof Blob) return v;                       // fotos guardadas por la versión anterior
    return v.buf ? new Blob([v.buf], {type:v.type}) : null;
  }
  /* Si la foto no está en este teléfono y la bitácora está compartida, se baja del servidor. */
  async function get(k){
    const b = await getLocal(k);
    return b || (api.remoto && !String(k).startsWith("__") ? api.remoto(k) : null);
  }
  async function has(k){
    const db = await ready; if (!db) return false;
    return new Promise(res=>{ try{ const r=db.transaction("fotos").objectStore("fotos").count(k); r.onsuccess=()=>res(r.result>0); r.onerror=()=>res(false); }catch{ res(false); } });
  }
  async function del(k){
    const db = await ready; if (!db) return;
    await new Promise(res=>{ try{ const t=db.transaction("fotos","readwrite"); t.objectStore("fotos").delete(k); t.oncomplete=res; t.onerror=res; }catch{ res(); } });
  }
  const api = {ready, put, get, getLocal, has, del, remoto:null};
  return api;
}

async function reducir(file, maxLado, calidad){
  let bmp = null;
  try{ bmp = await createImageBitmap(file, {imageOrientation:"from-image"}); }catch{}
  let w, h, src;
  if (bmp){ w=bmp.width; h=bmp.height; src=bmp; }
  else {
    const url = URL.createObjectURL(file);
    try{ src = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("decodificar")); i.src=url; }); }
    finally{ setTimeout(()=>URL.revokeObjectURL(url), 1000); }
    w=src.naturalWidth; h=src.naturalHeight;
  }
  const s = Math.min(1, maxLado/Math.max(w,h));
  const c = document.createElement("canvas"); c.width=Math.max(1,Math.round(w*s)); c.height=Math.max(1,Math.round(h*s));
  c.getContext("2d").drawImage(src,0,0,c.width,c.height);
  if (bmp) bmp.close?.();
  const out = await new Promise(res=>c.toBlob(b=>res(b),"image/jpeg",calidad));
  if (!out || out.size < 1000) throw new Error("comprimir");
  return out;
}

/* Foto de evidencia de la captura: #photoCam, #photoGal, #preview, #photoDel, #photoStatus.
   El borrador de la foto se guarda en IndexedDB con DRAFT_KEY para sobrevivir recargas. */
const DRAFT_KEY = "__borrador__";
function capturaFoto({fotos, maxLado, calidad, heic, onChange}){
  let blob = null, pending = null;
  const img = $("#preview"), st = $("#photoStatus");
  function set(b){
    blob = b;
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = URL.createObjectURL(b); img.src = img.dataset.url;
    img.classList.remove("hidden"); $("#photoDel").classList.remove("hidden");
  }
  function clear(){
    blob = null; pending = null;
    if (img.dataset.url){ URL.revokeObjectURL(img.dataset.url); delete img.dataset.url; }
    img.removeAttribute("src"); img.classList.add("hidden"); $("#photoDel").classList.add("hidden");
    estado(st, ""); $("#photoCam").value=""; $("#photoGal").value=""; fotos.del(DRAFT_KEY);
  }
  function onPhoto(e){
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    estado(st, "Procesando foto…");
    $("#saveBtn").disabled = true;
    pending = (async () => {
      try{
        const b = await reducir(f, maxLado, calidad);
        set(b);
        try{ await fotos.put(DRAFT_KEY, b); }catch{}
        onChange();
        estado(st, `Foto lista (${Math.round(b.size/1024)} KB).`);
      }catch{
        blob = null;
        estado(st, /heic|heif/i.test(f.type+f.name) ? heic : "No se pudo abrir la foto. Intenta con otra o elígela desde la galería.", true);
      }finally{
        $("#saveBtn").disabled = false;
      }
    })();
  }
  $("#photoCam").onchange = onPhoto; $("#photoGal").onchange = onPhoto;
  $("#photoDel").onclick = () => { clear(); onChange(); };
  return {
    get blob(){ return blob; },
    get pending(){ return pending; },
    async restore(){ const b = await fotos.get(DRAFT_KEY); if (b) set(b); },
    clear,
    /* Guarda la foto de la captura con la clave id. Devuelve el texto para el mensaje de guardado. */
    async guardar(id){
      if (!blob) return {ok:false, msg:""};
      try{
        await fotos.put(id, blob);
        if (await fotos.has(id)) return {ok:true, msg:" con foto"};
      }catch{}
      return {ok:false, msg:". La foto NO se guardó: este navegador no permite guardar imágenes al abrir el archivo así"};
    }
  };
}

/* Visor de fotos del historial: botones con data-foto dentro de cont. */
function visorFotos(fotos, cont){
  const dlg = $("#dlg"), img = $("#dlgImg");
  $("#dlgClose").onclick = () => dlg.close();
  cont.addEventListener("click", async e => {
    const b = e.target.closest("[data-foto]"); if (!b) return;
    const blob = await fotos.get(b.dataset.foto);
    if (!blob){ alert("La foto no está en este navegador."); return; }
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = URL.createObjectURL(blob); img.src = img.dataset.url; dlg.showModal();
  });
}

/* ================= pestañas ================= */
/* Solo se dibuja la pestaña visible; las demás se dibujan al abrirlas. */
function pestanas(render){
  const botones = document.querySelectorAll("nav button"), secciones = document.querySelectorAll("section");
  let actual = document.querySelector('nav button[aria-selected="true"]')?.dataset.tab;
  botones.forEach(b => b.onclick = () => {
    actual = b.dataset.tab;
    botones.forEach(x=>x.setAttribute("aria-selected", x===b));
    secciones.forEach(s=>s.classList.toggle("on", s.id===actual));
    render[actual]?.();
  });
  return {
    get actual(){ return actual; },
    renderVisible(){ render[actual]?.(); },
    ir(tab){ document.querySelector(`nav button[data-tab="${tab}"]`).click(); }
  };
}

/* ================= hora de la lectura =================
   Por defecto la lectura toma la hora en que se toca Guardar (antes se llenaba al abrir el formulario y un
   borrador o la app abierta en segundo plano dejaban horas viejas). "Cambiar hora" permite ponerla a mano, p. ej.
   al pasar lecturas de papel; esas quedan marcadas con tsManual y siempre se guarda también la hora real (guardado). */
const fmtHora = new Intl.DateTimeFormat("es-MX", {hour:"numeric", minute:"2-digit", second:"2-digit"});
function horaCaptura(alCambiar){
  const inp = $("#ts"), caja = document.createElement("span");
  caja.className = "tsbox";
  inp.before(caja); caja.append(inp);
  caja.insertAdjacentHTML("beforeend", `<span class="tsauto" id="tsAuto"></span><button type="button" class="linkbtn" id="tsModo"></button>`);
  let manual = false;
  const pintar = () => {
    inp.classList.toggle("hidden", !manual); $("#tsAuto").classList.toggle("hidden", manual);
    $("#tsModo").textContent = manual ? "Usar hora automática" : "Cambiar hora";
    if (!manual) $("#tsAuto").textContent = `Se toma al guardar · ${fmtHora.format(new Date())}`;
  };
  setInterval(() => { if (!manual) pintar(); }, 1000);
  const poner = (m, v = "") => { manual = m; inp.value = m ? (v || nowLocal()) : ""; pintar(); };
  $("#tsModo").onclick = () => { poner(!manual); if (manual) inp.focus(); alCambiar?.(); };
  inp.addEventListener("change", () => alCambiar?.());
  poner(false);
  return {
    /* para el borrador: "" = automática */
    valor: () => manual ? inp.value : "",
    poner: v => poner(!!v, v),
    reiniciar: () => poner(false),
    /* al guardar: {ts, guardado, manual} o null si la persona cancela una hora dudosa */
    leer(){
      const ahora = new Date(), g = ahora.toISOString();
      if (!manual || !inp.value) return {ts:g, guardado:g, manual:false};
      const d = new Date(inp.value);
      if (isNaN(d)) return {ts:g, guardado:g, manual:false};
      if (d - ahora > 5*60000 && !confirm(`La hora de la lectura (${fdate(d)}) está en el futuro. ¿Guardar así?`)) return null;
      if (ahora - d > 86400000 && !confirm(`La hora de la lectura (${fdate(d)}) tiene más de 24 h de diferencia con la hora actual. ¿Guardar así?`)) return null;
      return {ts:d.toISOString(), guardado:g, manual:true};
    }
  };
}
/* Marca para lecturas con hora puesta a mano: ✎ con la hora real en que se guardó. */
const marcaHora = r => r.tsManual ? ` <span class="tsman" title="Hora corregida a mano${r.guardado ? "; guardada el " + fdate(r.guardado) : ""}">✎</span>` : "";

/* ================= gráfica de tendencias =================
   series: [{name, color, dash, pts:[{t, v, id?, foto?}]}]
   lim: línea de límite superior · banda: [mín, máx] del rango normal · fuera(v): punto fuera de límite (va en rojo) */
const fmtDia = new Intl.DateTimeFormat("es-MX", {day:"2-digit", month:"short"});
/* Gráfica de líneas en SVG. tema cambia los colores de la cuadrícula (el informe exportado no tiene las variables CSS). */
/* ancho: el de la pantalla, para que los textos salgan a su tamaño real (sin él, 700 para el informe). */
function svgGrafica(series, {lim = null, banda = null, fuera = null, fmt, min0 = false, label, tema = {}, ancho = 0}){
  const C = {line:"var(--line)", muted:"var(--muted)", bad:"var(--bad)", banda:"var(--okbg)", fondo:"var(--surface)", ...tema};
  let t0=Infinity, t1=-Infinity, v0=Infinity, v1=-Infinity;
  for (const s of series) for (const p of s.pts){ if (p.t<t0) t0=p.t; if (p.t>t1) t1=p.t; if (p.v<v0) v0=p.v; if (p.v>v1) v1=p.v; }
  if (t0===t1){ t0-=43200000; t1+=43200000; }
  if (lim!==null){ v1=Math.max(v1,lim); v0=Math.min(v0,lim); }
  if (banda){ v1=Math.max(v1,banda[1]); v0=Math.min(v0,banda[0]); }
  const pad=(v1-v0)*0.12 || Math.abs(v1)*0.05 || 1; v0-=pad; v1+=pad; if (min0) v0=Math.max(0,v0);
  const W = ancho ? Math.max(300, Math.round(ancho)) : 700, H = W < 500 ? 250 : 320, L=52, R=10, T=14, B=34;
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R), Y=v=>T+(1-(v-v0)/(v1-v0))*(H-T-B);
  const g = [];
  if (banda) g.push(`<rect x="${L}" width="${W-L-R}" y="${Y(banda[1])}" height="${Y(banda[0])-Y(banda[1])}" fill="${C.banda}"/>`);
  for (let i=0;i<=4;i++){ const v=v0+(v1-v0)*i/4; g.push(`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="${C.muted}">${fmt(v)}</text>`); }
  const corto = t1-t0 < 2*86400000, fmtT = corto ? new Intl.DateTimeFormat("es-MX", {hour:"numeric", minute:"2-digit"}) : fmtDia;
  for (let i=0;i<=3;i++){ const t=t0+(t1-t0)*i/3; g.push(`<text x="${X(t)}" y="${H-10}" text-anchor="${i===0?"start":i===3?"end":"middle"}" font-size="12" fill="${C.muted}">${fmtT.format(t)}</text>`); }
  if (banda) for (const [v, txt] of [[banda[1],"Máx."],[banda[0],"Mín."]])
    g.push(`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.bad}" stroke-dasharray="6 5"/><text x="${W-R}" y="${Y(v)+(txt==="Máx."?-5:14)}" text-anchor="end" font-size="12" fill="${C.muted}">${txt} ${fmt(v)}</text>`);
  if (lim!==null) g.push(`<line x1="${L}" x2="${W-R}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="${C.bad}" stroke-dasharray="6 5"/><text x="${W-R}" y="${Y(lim)-5}" text-anchor="end" font-size="12" fill="${C.muted}">Límite ${fmt(lim)}</text>`);
  series.forEach((s, si) => {
    const dash = s.dash ? ` stroke-dasharray="8 4"` : "";
    if (s.pts.length>1) g.push(`<polyline fill="none" stroke="${s.color}" stroke-width="2"${dash} points="${s.pts.map(p=>X(p.t)+","+Y(p.v)).join(" ")}"/>`);
    s.pts.forEach((p, i) => {
      const mal = fuera && fuera(p.v);
      // punto visible (rojo y más grande si sale de límite) y un área de toque más grande, invisible
      g.push(`<circle cx="${X(p.t)}" cy="${Y(p.v)}" r="${mal?6:4}" fill="${mal?C.bad:s.color}" stroke="${C.fondo}" stroke-width="2"><title>${esc(s.name)}: ${fmt(p.v)} (${fdate(p.t)})</title></circle>`);
      g.push(`<circle class="hit" data-s="${si}" data-i="${i}" cx="${X(p.t)}" cy="${Y(p.v)}" r="14" fill="transparent"/>`);
    });
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g.join("")}</svg>`;
}
/* Dibuja en #chartBox con su leyenda. Al tocar un punto muestra equipo, fecha y valor (y la foto si la lectura tiene). */
let graficaActual = null;
function grafica(series, opts){
  graficaActual = {series, opts};
  const box = $("#chartBox");
  box.innerHTML = svgGrafica(series, {...opts, ancho: box.clientWidth}) + `<div class="chart-tip hidden" id="chartTip" role="status"></div>`;
  $("#legend").innerHTML = series.length > 1 ? series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}${s.dash?" (punteada)":""}</span>`).join("") : "";
  if (!box.dataset.tip){
    box.dataset.tip = "1";
    box.addEventListener("click", ev => {
      const tip = $("#chartTip"); if (!tip || ev.target.closest("#chartTip")) return;
      const h = ev.target.closest("circle.hit");
      if (!h){ tip.classList.add("hidden"); return; }
      const {series, opts} = graficaActual, s = series[+h.dataset.s], p = s.pts[+h.dataset.i];
      const mal = opts.fuera && opts.fuera(p.v);
      tip.innerHTML = `<b>${esc(s.name)}</b> · ${fdate(p.t)}<br><span class="v">${opts.fmt(p.v)}</span>${mal ? ` <span class="mal">⚠ fuera de límite</span>` : ""}${p.foto ? ` <button class="linkbtn" data-foto="${esc(p.id)}">Ver foto</button>` : ""}`;
      const r = box.getBoundingClientRect(), c = h.getBoundingClientRect();
      tip.classList.remove("hidden");
      const x = Math.min(Math.max(c.left + c.width/2 - r.left - tip.offsetWidth/2, 0), r.width - tip.offsetWidth);
      const yArriba = c.top - r.top - tip.offsetHeight - 4;
      tip.style.left = x + "px"; tip.style.top = (yArriba >= 0 ? yArriba : c.bottom - r.top + 4) + "px";
    });
  }
}

/* ================= informe ================= */
/* Impresión común de los informes: sin recuadro, sin renglones partidos y valores fuera de límite en rojo. */
const CSS_IMPRESION = `
.rep .mal{color:#a3330b;font-weight:700}
@media print{.rep{border:0!important;padding:0!important;border-radius:0!important}.rep .tw{overflow:visible}
  .rep tr,.rep .bloque,.rep .kpi,.rep figure,.rep .firma{break-inside:avoid}.rep h2{break-after:avoid}}`;
/* Pie de cada hoja impresa: nombre del informe y "Página X de Y" (márgenes de página de CSS). */
const piePagina = texto => `@page{size:letter;margin:12mm 12mm 16mm;
  @bottom-left{content:"${String(texto).replace(/[<>"\\\n]/g, "")}";font:9px system-ui,sans-serif;color:#6a7784}
  @bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px system-ui,sans-serif;color:#6a7784}}`;
function cssInforme(css){ const st = document.createElement("style"); st.textContent = css + CSS_IMPRESION; document.head.append(st); }
const docInforme = (titulo, css, html, pie = titulo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title><style>body{margin:0;padding:12px;background:#eef1f4}${css}${CSS_IMPRESION}@media print{body{background:#fff;padding:0}}${piePagina(pie)}</style></head><body>${html}</body></html>`;
/* Fotos que no se pudieron cargar en el último informe; accionesInforme las avisa. */
let fotosFaltantes = [];
/* Carga las fotos [{id, alt, pie}] y devuelve las <figure> del informe. Las que no están en el teléfono se bajan
   del servidor de dos en dos y con reintentos: pedirlas todas a la vez hacía que Apps Script rechazara varias
   y el informe salía con unas fotos sí y otras no. */
async function figurasInforme(fotos, lista){
  const urls = new Array(lista.length).fill(null), st = $("#repStatus");
  let sig = 0, hechas = 0, fallidas = 0;
  const una = async f => {
    for (let k = 0; k < 3; k++){
      const b = await fotos.get(f.id);
      if (b) return blobToDataURL(b);
      // sin servidor o sin señal no tiene caso insistir; tras dos fotos perdidas, las demás se intentan una sola vez
      if (!fotos.remoto || navigator.onLine === false || fallidas >= 2) break;
      await new Promise(r => setTimeout(r, 1500 * (k + 1)));
    }
    fallidas++;
    return null;
  };
  const trabajador = async () => {
    while (sig < lista.length){
      const i = sig++;
      urls[i] = await una(lista[i]);
      hechas++; if (st && lista.length > 1) estado(st, `Preparando fotos: ${hechas} de ${lista.length}…`);
    }
  };
  await Promise.all([trabajador(), trabajador()]);
  fotosFaltantes.push(...lista.filter((f, i) => !urls[i]).map(f => f.pie));
  return lista.map((f, i) => urls[i] ? `<figure><img src="${urls[i]}" alt="${esc(f.alt)}"><figcaption>${esc(f.pie)}</figcaption></figure>` : "").join("");
}
/* Botones del informe. generar() devuelve {html, texto, doc} o null si no hay lecturas. */
function accionesInforme({generar, guardarDatos, vacio, archivo, titulo}){
  let rep = null;
  $("#repGen").onclick = async () => {
    const st = $("#repStatus"); estado(st, "Generando…");
    $("#repGen").disabled = true;
    try{
      guardarDatos();
      fotosFaltantes = [];
      rep = await generar();
      if (!rep){ estado(st, typeof vacio==="function" ? vacio() : vacio, true); $("#rep").innerHTML=""; $("#repAcc").classList.add("hidden"); return; }
      $("#rep").innerHTML = rep.html; $("#repAcc").classList.remove("hidden");
      let pp = $("#repPagina"); if (!pp){ pp = document.createElement("style"); pp.id = "repPagina"; document.head.append(pp); }
      pp.textContent = piePagina(rep.pie || titulo);
      $("#repShare").classList.toggle("hidden", !navigator.share);
      const nf = fotosFaltantes.length;
      estado(st, nf ? `Informe listo, pero ${nf === 1 ? "falta 1 foto que no se pudo bajar" : `faltan ${nf} fotos que no se pudieron bajar`} del servidor${nf <= 3 ? ` (${fotosFaltantes.join("; ")})` : ""}. Revisa la señal y toca «Generar informe» otra vez.` : "Informe listo.", !!nf);
    }catch{ estado(st, "No se pudo generar el informe.", true); }
    finally{ $("#repGen").disabled = false; }
  };
  $("#repPrint").onclick = () => window.print();
  $("#repHtml").onclick = () => download(`${archivo}_${stamp()}_${horaArchivo()}.html`, rep.doc, "text/html;charset=utf-8");
  $("#repShare").onclick = async () => { try{ await navigator.share({title:titulo, text:rep.texto}); }catch{} };
  $("#repCopy").onclick = async () => {
    const st = $("#repStatus");
    try{ await navigator.clipboard.writeText(rep.texto); estado(st, "Resumen copiado. Pégalo en WhatsApp o en un correo."); }
    catch{
      const t = document.createElement("textarea"); t.value = rep.texto; document.body.append(t); t.select();
      const ok = document.execCommand && document.execCommand("copy"); t.remove();
      if (ok) estado(st, "Resumen copiado."); else estado(st, "No se pudo copiar automáticamente.", true);
    }
  };
}

/* ================= protección de datos ================= */
/* Fecha de creación codificada en el id (base 36 tras la letra inicial). */
const creado = r => { const n = parseInt(String(r.id||"").slice(1,9), 36); return isFinite(n) ? n : +new Date(r.ts); };
function respaldo({lecturas, cfg, persist}){
  function aviso(){
    const L = lecturas(), P = cfg(), w = $("#bakWarn"); const lb = P.lastBackup ? +new Date(P.lastBackup) : 0;
    let pend = 0; for (const r of L) if (creado(r) > lb) pend++;
    const dias = lb ? Math.floor((Date.now()-lb)/86400000) : null;
    $("#lastBak").textContent = lb ? `Último respaldo: ${fdate(P.lastBackup)} (hace ${dias} día(s)). ${pend} lectura(s) nuevas desde entonces.` : "Aún no has descargado ningún respaldo.";
    if (!L.length || (lb && dias < 7 && pend < 30)){ w.classList.add("hidden"); return; }
    w.innerHTML = `${lb ? `Último respaldo hace ${dias} día(s)` : "Nunca has descargado un respaldo"}: ${pend} lectura(s) solo existen en este teléfono. <button class="linkbtn" id="bakNow">Respaldar ahora</button>`;
    w.classList.remove("hidden"); $("#bakNow").onclick = () => $("#bakBtn").click();
  }
  return {
    aviso,
    marcar(){ cfg().lastBackup = new Date().toISOString(); persist(); aviso(); },
    ronda(st){
      const b = document.createElement("button"); b.className = "btn"; b.style.marginTop = "8px"; b.textContent = "Ronda completa: descargar respaldo";
      b.onclick = () => { $("#bakBtn").click(); b.remove(); };
      st.append(document.createElement("br"), b);
    }
  };
}
async function renderUso(texto){
  try{ const e = await navigator.storage?.estimate?.(); if (e?.usage) texto += ` Espacio usado: ${(e.usage/1048576).toFixed(1)} MB.`; }catch{}
  $("#usage").textContent = texto;
}

/* Registra el modo sin señal y avisa cuando llega una versión nueva. Una app instalada que se
   reanuda no vuelve a cargar la página, así que también se busca versión al volver a ella. */
function vigilarVersion(){
  const sw = navigator.serviceWorker, habia = !!sw.controller;
  sw.register("sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(()=>{}); });
  }).catch(()=>{});
  sw.addEventListener("controllerchange", () => {
    if (!habia || document.getElementById("versionNueva")) return;
    const d = document.createElement("div"); d.id = "versionNueva"; d.className = "version-nueva noprint";
    d.innerHTML = `<span>Hay una versión nueva de la app.</span><button class="btn" type="button">Actualizar</button>`;
    d.querySelector("button").onclick = () => location.reload();
    document.body.append(d);
  });
}

/* Revisa almacenamiento, registra el modo sin señal y muestra los avisos en #storeNote. */
async function revisarEntorno({lsOk, persist, fotos, sinFotos}){
  const notes = [], pr = location.protocol;
  if (pr === "file:" || pr === "content:") notes.push("Estás usando la app como archivo local. Los datos quedan ligados a esta dirección exacta: si la abres por otro camino (WhatsApp, Drive, otra carpeta) aparecerá vacía. Usa la versión publicada o respalda al terminar cada ronda.");
  if ("serviceWorker" in navigator && (pr === "https:" || location.hostname === "localhost")) vigilarVersion();
  if (!lsOk || !persist()) notes.push("Este navegador no permite guardar datos al abrir el archivo así: la información se perderá al cerrar.");
  const db = await fotos.ready;
  if (!db) notes.push(sinFotos);
  else { try{ await fotos.put("__prueba__", new Blob(["x"],{type:"text/plain"})); await fotos.del("__prueba__"); }catch{ notes.push("El almacenamiento de fotos de este navegador falló la prueba de escritura. Las fotos podrían no guardarse."); } }
  if (notes.length){ const n=$("#storeNote"); n.innerHTML = notes.map(esc).join("<br>"); n.classList.remove("hidden"); }
  try{ navigator.storage?.persist?.(); }catch{}
}

function avisoBorrador(){ const n=$("#draftNote"); n.textContent="Se recuperó la captura que tenías en proceso."; n.classList.remove("hidden"); setTimeout(()=>n.classList.add("hidden"),6000); }
const nuevoId = letra => letra + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/* ================= compartir con el equipo (Google Sheets) =================
   Las lecturas se guardan primero en el teléfono; cuando hay señal se suben al script de
   Google Apps Script (apps-script/Codigo.gs) y se bajan las que capturaron los demás.
   Marcas locales: r.srv (lectura ya en la hoja), r.fotoSrv (foto ya en Drive),
   e.srvUpd (versión del equipo que ya está en la hoja). */
const SYNC_CFG = "bitacoras-sync";
const leerLS = (k, def) => { try{ return {...def, ...JSON.parse(localStorage.getItem(k) || "{}")}; }catch{ return {...def}; } };
const escribirLS = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
const syncConfig = () => leerLS(SYNC_CFG, {url:"", clave:"", autor:""});
const blobAB64 = b => blobToDataURL(b).then(u => { if (!u) throw new Error("foto"); return u.slice(u.indexOf(",")+1); });
const b64ABytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const sinLocales = (o, ...k) => { const c = {...o}; k.forEach(x => delete c[x]); return c; };
function haceTxt(iso){
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m/60)} h` : `el ${fdate(iso)}`;
}
/* Sin encabezado Content-Type la solicitud es "simple" y Apps Script la acepta sin CORS previo. */
async function llamarScript(cfg, cuerpo){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 90000);
  let r;
  try{ r = await fetch(cfg.url, {method:"POST", body:JSON.stringify({...cuerpo, clave:cfg.clave}), signal:ctl.signal}); }
  catch{ throw new Error(navigator.onLine === false ? "Sin conexión: se subirán al volver la señal." : "No se pudo contactar el script. Revisa la dirección o la señal."); }
  finally{ clearTimeout(t); }
  let o; try{ o = await r.json(); }catch{ throw new Error("La dirección no responde como el script de las bitácoras. Revisa que el acceso sea \"Cualquier persona\"."); }
  if (!o.ok) throw new Error(o.error || "Error del script.");
  return o;
}

/* o: {bitacora, fotos, lecturas(), setLecturas(arr), fila(r), alCambiar(), migrar?(r),
       equipos?(), setEquipos?(arr), filaEquipo?(e)} */
function compartir(o){
  const KEY = "bitacoras-sync-" + o.bitacora;
  const st = leerLS(KEY, {url:"", cursor:0, borrar:[], borrarEq:[], ultima:null});
  const guardarSt = () => escribirLS(KEY, st);
  let enCurso = null, otraVez = false, error = "";
  const activo = () => { const c = syncConfig(); return !!(c.url && c.clave); };

  o.fotos.remoto = async id => {
    const cfg = syncConfig(); if (!activo()) return null;
    try{
      const r = await llamarScript(cfg, {accion:"foto", bitacora:o.bitacora, id});
      const b = new Blob([b64ABytes(r.b64)], {type:r.tipo || "image/jpeg"});
      try{ await o.fotos.put(id, b); }catch{}
      return b;
    }catch{ return null; }
  };

  const pendientes = () => {
    let n = 0; for (const r of o.lecturas()) if (!r.srv || (r.foto && !r.fotoSrv)) n++;
    return n + st.borrar.length;
  };

  function estadoUI(){
    const bar = $("#syncBar"), sts = $("#syStatus");
    if (!activo()){
      bar?.classList.add("hidden");
      if (sts) estado(sts, "No conectada: las lecturas solo están en este teléfono.");
      return;
    }
    const pend = pendientes();
    const txt = enCurso ? "Sincronizando…"
      : error ? `${error}${pend ? ` ${pend} cambio(s) por subir.` : ""}`
      : `Compartida con el equipo${st.ultima ? ", actualizada " + haceTxt(st.ultima) : ""}${pend ? ` · ${pend} por subir` : ""}`;
    if (bar){ bar.textContent = "☁ " + txt; bar.classList.toggle("warn", !!error && !enCurso); bar.classList.remove("hidden"); }
    if (sts) estado(sts, txt, !!error && !enCurso);
  }

  /* Al cambiar de hoja, todo se vuelve a subir a la nueva. */
  function cambioDeHoja(url){
    for (const r of o.lecturas()){ delete r.srv; delete r.fotoSrv; }
    if (o.equipos) for (const e of o.equipos()) delete e.srvUpd;
    Object.assign(st, {url, cursor:0, borrar:[], borrarEq:[], ultima:null});
  }

  function aplicar(res){
    let cambio = false;
    if (o.equipos){
      const remap = res.remap || {};
      if (Object.keys(remap).length){
        // otro usuario ya había registrado ese identificador: se usa el suyo
        o.setEquipos(o.equipos().filter(e => !remap[e.id]));
        for (const r of o.lecturas()) if (remap[r.eq]) r.eq = remap[r.eq];
        cambio = true;
      }
      const porId = new Map(o.equipos().map(e => [e.id, e])), quitar = new Set();
      for (const x of res.equipos || []){
        if (typeof x.id !== "string" || !x.datos) continue;
        const loc = porId.get(x.id);
        if (x.borrado){ if (loc) quitar.add(x.id); continue; }
        if (st.borrarEq.includes(x.id)) continue;
        x.datos = {...x.datos, id:x.id, tag:String(x.datos.tag ?? ""), in:num(x.datos.in)};
        const upd = x.datos.upd || 0;
        if (!loc){ o.equipos().push({...x.datos, srvUpd:upd}); cambio = true; }
        else if (upd > (loc.upd || 0)){ Object.assign(loc, x.datos, {srvUpd:upd}); cambio = true; }
        else if (upd === (loc.upd || 0)) loc.srvUpd = upd;
      }
      if (quitar.size){
        o.setEquipos(o.equipos().filter(e => !quitar.has(e.id)));
        o.setLecturas(o.lecturas().filter(r => !quitar.has(r.eq)));
        cambio = true;
      }
    }
    const L = o.lecturas(), porId = new Map(L.map(r => [r.id, r])), quitar = new Set();
    for (const x of res.lecturas || []){
      if (typeof x.id !== "string" || !x.datos) continue;
      const loc = porId.get(x.id);
      if (x.borrado){ if (loc){ quitar.add(x.id); if (loc.foto) o.fotos.del(x.id); } continue; }
      if (loc){
        loc.srv = true;
        if (x.foto && !loc.fotoSrv){ loc.foto = true; loc.fotoSrv = true; cambio = true; }
        if (x.autor && !loc.autor){ loc.autor = x.autor; cambio = true; }   // la hoja sabe quién la capturó
        continue;
      }
      if (st.borrar.includes(x.id)) continue;     // la borraste aquí y el borrado aún no se sube
      const t = Date.parse(x.datos.ts); if (isNaN(t)) continue;
      const r = {...x.datos, id:x.id, ts:new Date(t).toISOString(), srv:true, foto:!!x.foto, fotoSrv:!!x.foto};
      if (x.autor && !r.autor) r.autor = x.autor;
      L.push(o.migrar ? o.migrar(r) : r); cambio = true;
    }
    if (quitar.size){ o.setLecturas(o.lecturas().filter(r => !quitar.has(r.id))); cambio = true; }
    return cambio;
  }

  async function ronda(){
    const cfg = syncConfig();
    if (st.url !== cfg.url) cambioDeHoja(cfg.url);
    // una vez: volver a leer toda la hoja para completar quién capturó las lecturas que ya estaban aquí
    if (!st.autores){ st.cursor = 0; st.autores = 1; }
    let pend = o.lecturas().filter(r => !r.srv), primera = true;
    while (primera || pend.length){
      primera = false;
      const lote = pend.slice(0, 100), borrar = st.borrar.slice(), borrarEq = st.borrarEq.slice();
      const eqs = o.equipos ? o.equipos().filter(e => e.srvUpd === undefined || e.srvUpd !== (e.upd || 0)) : [];
      const res = await llamarScript(cfg, {accion:"sync", bitacora:o.bitacora, desde:st.cursor, borrar, borrarEq,
        subir: lote.map(r => ({id:r.id, autor:r.autor || cfg.autor, datos:sinLocales(r, "srv", "fotoSrv", "foto"), vista:o.fila(r)})),
        equipos: eqs.map(e => ({id:e.id, autor:cfg.autor, datos:sinLocales(e, "srvUpd"), vista:o.filaEquipo(e)}))});
      // las capturadas antes de conectar se suben con tu nombre: el teléfono se queda con el mismo
      lote.forEach(r => { r.srv = true; if (!r.autor && cfg.autor) r.autor = cfg.autor; });
      eqs.forEach(e => e.srvUpd = e.upd || 0);
      st.borrar = st.borrar.filter(id => !borrar.includes(id));
      st.borrarEq = st.borrarEq.filter(id => !borrarEq.includes(id));
      const cambio = aplicar(res);
      st.cursor = Math.max(st.cursor, res.cursor || 0); st.ultima = new Date().toISOString();
      guardarSt();
      if (cambio || lote.length || eqs.length) o.alCambiar();
      pend = pend.slice(100);
    }
    // fotos propias que aún no están en Drive
    for (const r of o.lecturas().filter(r => r.srv && r.foto && !r.fotoSrv)){
      const b = await o.fotos.getLocal(r.id); if (!b) continue;
      await llamarScript(cfg, {accion:"subirFoto", bitacora:o.bitacora, id:r.id, tipo:b.type || "image/jpeg", b64:await blobAB64(b)});
      r.fotoSrv = true; o.alCambiar(); estadoUI();
    }
  }

  /* Después de sincronizar, baja en segundo plano (una por una) las fotos recientes que capturaron otros, para que
     el informe y el historial las tengan al instante y sin señal. Si una falla se detiene; sigue en la próxima. */
  let precargando = false;
  async function precargarFotos(){
    if (precargando) return;
    precargando = true;
    try{
      const desde = Date.now() - 31 * 86400000;
      for (const r of o.lecturas()){
        if (!r.foto || !r.fotoSrv || +new Date(r.ts) < desde || await o.fotos.has(r.id)) continue;
        if (!(await o.fotos.remoto(r.id))) break;
      }
    }finally{ precargando = false; }
  }

  function sincronizar(){
    if (!activo()) return Promise.resolve();
    if (enCurso){ otraVez = true; return enCurso; }
    enCurso = (async () => {
      try{
        do { otraVez = false; await ronda(); } while (otraVez);
        error = "";
        precargarFotos();
      }catch(e){ error = e.message; }
      finally{ enCurso = null; estadoUI(); }
    })();
    estadoUI();
    return enCurso;
  }

  /* Tarjeta de Ajustes */
  const card = $("#syncCard");
  if (card){
    const c = syncConfig();
    card.innerHTML = `<p class="muted" style="margin-top:0">Sube tus lecturas a la hoja de Google Sheets del equipo y recibe las de los demás. Sin señal se guardan aquí y se suben cuando vuelve. La configuración aplica a las dos bitácoras.</p>
      <div class="campos">
        <label for="syUrl">Dirección del script (termina en /exec)</label><input class="plain" id="syUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.url)}">
        <label for="syClave">Clave del equipo</label><input class="plain" id="syClave" type="password" autocomplete="off" value="${esc(c.clave)}">
        <label for="syAutor">Tu nombre (aparece en la hoja como quien capturó)</label><input class="plain" id="syAutor" autocomplete="name" placeholder="Ej. Iridian J." value="${esc(c.autor)}">
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="sySave">Conectar y sincronizar</button>
        <button class="btn sec" id="syOff">Desconectar</button>
      </div>
      <div class="status" id="syStatus"></div>`;
    $("#sySave").onclick = async () => {
      const nueva = {url:$("#syUrl").value.trim(), clave:$("#syClave").value.trim(), autor:$("#syAutor").value.trim()};
      const sts = $("#syStatus");
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(nueva.url) && !/^http:\/\/localhost[:/]/.test(nueva.url)){ estado(sts, "La dirección debe ser la de la implementación del script: https://script.google.com/macros/s/…/exec", true); return; }
      if (!nueva.clave || !nueva.autor){ estado(sts, "Escribe la clave del equipo y tu nombre.", true); return; }
      estado(sts, "Probando la conexión…"); $("#sySave").disabled = true;
      try{ await llamarScript(nueva, {accion:"ping", bitacora:o.bitacora}); }
      catch(e){ estado(sts, e.message, true); $("#sySave").disabled = false; return; }
      escribirLS(SYNC_CFG, nueva); error = "";
      $("#sySave").disabled = false;
      await sincronizar();
    };
    $("#syOff").onclick = () => {
      if (!activo() || !confirm("¿Dejar de compartir en este teléfono? Las lecturas guardadas aquí no se borran.")) return;
      escribirLS(SYNC_CFG, {...syncConfig(), url:"", clave:""}); $("#syUrl").value = ""; $("#syClave").value = ""; estadoUI();
    };
  }
  $("#syncBar")?.addEventListener("click", () => { error = ""; sincronizar(); });

  addEventListener("online", () => sincronizar());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sincronizar(); });
  setInterval(() => { if (document.visibilityState === "visible") sincronizar(); else estadoUI(); }, 120000);

  return {
    sincronizar, estadoUI,
    autor: () => activo() ? syncConfig().autor : undefined,
    /* Borrados que deben llegar a la hoja (solo si la lectura o el equipo ya estaban ahí). */
    borrada(r){ if (r?.srv && !st.borrar.includes(r.id)){ st.borrar.push(r.id); guardarSt(); } },
    equipoBorrado(e){ if (e?.srvUpd !== undefined && !st.borrarEq.includes(e.id)){ st.borrarEq.push(e.id); guardarSt(); } }
  };
}

return {vigilarVersion, $, esc, num, pct, fx, fdate, isoLocal, nowLocal, stamp, download, descargarCSV, estado,
  fotosDB, capturaFoto, visorFotos, DRAFT_KEY, pestanas, grafica, svgGrafica, horaCaptura, marcaHora,
  cssInforme, docInforme, figurasInforme, accionesInforme,
  respaldo, renderUso, revisarEntorno, avisoBorrador, nuevoId, compartir, syncConfig};
})();
