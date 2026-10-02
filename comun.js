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
const fdate = iso => { const d = new Date(iso); return isNaN(d) ? iso : fmtFecha.format(d); };
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
  async function get(k){
    const db = await ready; if (!db) return null;
    const v = await new Promise(res=>{ try{ const r=db.transaction("fotos").objectStore("fotos").get(k); r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null); }catch{ res(null); } });
    if (!v) return null;
    if (v instanceof Blob) return v;                       // fotos guardadas por la versión anterior
    return v.buf ? new Blob([v.buf], {type:v.type}) : null;
  }
  async function has(k){
    const db = await ready; if (!db) return false;
    return new Promise(res=>{ try{ const r=db.transaction("fotos").objectStore("fotos").count(k); r.onsuccess=()=>res(r.result>0); r.onerror=()=>res(false); }catch{ res(false); } });
  }
  async function del(k){
    const db = await ready; if (!db) return;
    await new Promise(res=>{ try{ const t=db.transaction("fotos","readwrite"); t.objectStore("fotos").delete(k); t.oncomplete=res; t.onerror=res; }catch{ res(); } });
  }
  return {ready, put, get, has, del};
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

/* ================= gráfica de tendencias =================
   series: [{name, color, dash, pts:[{t, v}]}] */
const fmtDia = new Intl.DateTimeFormat("es-MX", {day:"2-digit", month:"short"});
function grafica(series, {lim = null, fmt, min0 = false, label}){
  let t0=Infinity, t1=-Infinity, v0=Infinity, v1=-Infinity;
  for (const s of series) for (const p of s.pts){ if (p.t<t0) t0=p.t; if (p.t>t1) t1=p.t; if (p.v<v0) v0=p.v; if (p.v>v1) v1=p.v; }
  if (t0===t1){ t0-=43200000; t1+=43200000; }
  if (lim!==null){ v1=Math.max(v1,lim); v0=Math.min(v0,lim); }
  const pad=(v1-v0)*0.12 || Math.abs(v1)*0.05 || 1; v0-=pad; v1+=pad; if (min0) v0=Math.max(0,v0);
  const W=700,H=320,L=56,R=14,T=14,B=40;
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R), Y=v=>T+(1-(v-v0)/(v1-v0))*(H-T-B);
  const g = [];
  for (let i=0;i<=4;i++){ const v=v0+(v1-v0)*i/4; g.push(`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" font-size="12" fill="var(--muted)">${fmt(v)}</text>`); }
  for (let i=0;i<=3;i++){ const t=t0+(t1-t0)*i/3; g.push(`<text x="${X(t)}" y="${H-14}" text-anchor="middle" font-size="12" fill="var(--muted)">${fmtDia.format(t)}</text>`); }
  if (lim!==null) g.push(`<line x1="${L}" x2="${W-R}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="var(--bad)" stroke-dasharray="6 5"/><text x="${W-R}" y="${Y(lim)-5}" text-anchor="end" font-size="12" fill="var(--bad)">Límite ${fmt(lim)}</text>`);
  for (const s of series){
    const dash = s.dash ? ` stroke-dasharray="8 4"` : "";
    if (s.pts.length>1) g.push(`<polyline fill="none" stroke="${s.color}" stroke-width="2.5"${dash} points="${s.pts.map(p=>X(p.t)+","+Y(p.v)).join(" ")}"/>`);
    for (const p of s.pts) g.push(`<circle cx="${X(p.t)}" cy="${Y(p.v)}" r="4" fill="${s.color}"><title>${esc(s.name)}: ${fmt(p.v)} (${fdate(p.t)})</title></circle>`);
  }
  $("#chartBox").innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g.join("")}</svg>`;
  $("#legend").innerHTML = series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("");
}

/* ================= informe ================= */
function cssInforme(css){ const st = document.createElement("style"); st.textContent = css; document.head.append(st); }
const docInforme = (titulo, css, html) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title><style>body{margin:0;padding:12px;background:#eef1f4}${css}@media print{body{background:#fff;padding:0}.rep{border:0;padding:0}@page{size:letter;margin:12mm}}</style></head><body>${html}</body></html>`;
/* Carga en paralelo las fotos [{id, alt, pie}] y devuelve las <figure> del informe. */
async function figurasInforme(fotos, lista){
  const urls = await Promise.all(lista.map(async f => { const b = await fotos.get(f.id); return b ? blobToDataURL(b) : null; }));
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
      rep = await generar();
      if (!rep){ estado(st, vacio, true); $("#rep").innerHTML=""; $("#repAcc").classList.add("hidden"); return; }
      $("#rep").innerHTML = rep.html; $("#repAcc").classList.remove("hidden");
      $("#repShare").classList.toggle("hidden", !navigator.share);
      estado(st, "Informe listo.");
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

/* Revisa almacenamiento, registra el modo sin señal y muestra los avisos en #storeNote. */
async function revisarEntorno({lsOk, persist, fotos, sinFotos}){
  const notes = [], pr = location.protocol;
  if (pr === "file:" || pr === "content:") notes.push("Estás usando la app como archivo local. Los datos quedan ligados a esta dirección exacta: si la abres por otro camino (WhatsApp, Drive, otra carpeta) aparecerá vacía. Usa la versión publicada o respalda al terminar cada ronda.");
  if ("serviceWorker" in navigator && (pr === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(()=>{});
  if (!lsOk || !persist()) notes.push("Este navegador no permite guardar datos al abrir el archivo así: la información se perderá al cerrar.");
  const db = await fotos.ready;
  if (!db) notes.push(sinFotos);
  else { try{ await fotos.put("__prueba__", new Blob(["x"],{type:"text/plain"})); await fotos.del("__prueba__"); }catch{ notes.push("El almacenamiento de fotos de este navegador falló la prueba de escritura. Las fotos podrían no guardarse."); } }
  if (notes.length){ const n=$("#storeNote"); n.innerHTML = notes.map(esc).join("<br>"); n.classList.remove("hidden"); }
  try{ navigator.storage?.persist?.(); }catch{}
}

function avisoBorrador(){ const n=$("#draftNote"); n.textContent="Se recuperó la captura que tenías en proceso."; n.classList.remove("hidden"); setTimeout(()=>n.classList.add("hidden"),6000); }
const nuevoId = letra => letra + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

return {$, esc, num, pct, fx, fdate, isoLocal, nowLocal, stamp, download, descargarCSV, estado,
  fotosDB, capturaFoto, visorFotos, DRAFT_KEY, pestanas, grafica,
  cssInforme, docInforme, figurasInforme, accionesInforme,
  respaldo, renderUso, revisarEntorno, avisoBorrador, nuevoId};
})();
