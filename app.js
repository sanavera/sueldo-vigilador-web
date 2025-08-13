/* ===========================
   Sueldo Vigilador (web)
   Regla feriado 12h (opción 0) — FINAL:
   - Pool para corte 208:
       · Modo DÍAS: dias*horasDia - (feriados*4)
       · Modo HORAS: horasTotales - (feriados*4)
   - Feriado 12h (opción 0): 4h al 100% + 8h feriado normal (renglón aparte)
   - No se agregan horas “extra” al pool por feriado
   =========================== */

// ===== Escalas incrustadas (Jul/Ag 2025 con valores DISTINTOS)
const ESCALAS = {
  "2025-07": {
    label: "Julio 2025",
    fuente: "Voz del Vigilador / UPSRA",
    SUELDO_BASICO: 745030,
    PRESENTISMO:   153600,
    VIATICOS:      435580,
    PLUS_NR:        25000,
    VALOR_HORA_NORMAL: 4583.01,
    VALOR_HORA_EXTRA_50: 6874.52,
    VALOR_HORA_EXTRA_100: 9166.03
    // V_HORA_NOC = 0,1% del básico por hora (se calcula más abajo)
  },
  "2025-08": {
    label: "Agosto 2025",
    fuente: "Voz del Vigilador / UPSRA",
    SUELDO_BASICO: 751735,
    PRESENTISMO:   153600,
    VIATICOS:      443215,
    PLUS_NR:        50000,
    VALOR_HORA_NORMAL: 4526.68,
    VALOR_HORA_EXTRA_50: 6790.01,
    VALOR_HORA_EXTRA_100: 9053.35
  }
};

function ymNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function pickEscalaParaHoy() {
  const keys = Object.keys(ESCALAS).sort(); // asc
  const today = ymNow();
  let pick = keys[0];
  for (const k of keys) if (k <= today) pick = k;
  return pick;
}
function labelEscala(ym) {
  const e = ESCALAS[ym];
  return e?.label || ym;
}

// --- Valores por defecto (en localStorage)
const DEFAULTS = {
  SUELDO_BASICO: 751735,
  PRESENTISMO:   153600,
  VIATICOS:      443215,
  PLUS_NR:       50000,
  V_HORA:        4526.68,
  V_HORA_50:     6790.01,
  V_HORA_100:    9053.35,
  V_HORA_NOC:     751.74,  // 0,1% del básico por hora
  HORAS_EXTRAS_DESDE: 208,
  HORAS_NOC_X_DIA: 9,
  PLUS_ADICIONAL: 0,
  HORAS_EXTRA_JORNADA: 0
};

// Claves LS
const LS = "sv_conf_v1";
const LS_MODE = "sv_mode";                    // "scale" | "advanced"
const LS_SCALE_SELECTED = "sv_scale_selected";// "YYYY-MM"

// Estado
let DETALLE = "";

// Utils
const $ = sel => document.querySelector(sel);
function num(v, def=0){ const n = Number(v); return Number.isFinite(n) ? n : def; }
function money(v){
  try{
    return (new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2})).format(v);
  }catch(_){
    return "$ " + Number(v||0).toFixed(2).replace(".",",");
  }
}

// Config
function getConf(){
  const saved = JSON.parse(localStorage.getItem(LS) || "{}");
  return {...DEFAULTS, ...saved};
}
function setConf(partial){
  const next = {...getConf(), ...partial};
  localStorage.setItem(LS, JSON.stringify(next));
  refreshTagEscala();
  return next;
}
function resetConf(){
  localStorage.setItem(LS, JSON.stringify(DEFAULTS));
}

// Intento de actualización desde el blog (graceful por CORS)
async function tryUpdateFromBlog(){
  const BLOG_URL = "https://sanaverasebastian.blogspot.com/2025/07/valores-sueldo-vigilador-actualizados.html";
  try{
    const res = await fetch(BLOG_URL, {mode:"cors"});
    const html = await res.text();
    const m = html.match(/<pre>([\s\S]*?)<\/pre>/i);
    if(!m) return;
    const lines = m[1].split("\n").map(s=>s.trim()).filter(Boolean);
    const patch = {};
    for(const ln of lines){
      const [k, raw] = ln.split("=").map(s=>s?.trim());
      if(!k || !raw) continue;
      const v = Number(raw);
      if(Number.isFinite(v)){
        if(k==="SUELDO_BASICO") patch.SUELDO_BASICO = v;
        if(k==="PRESENTISMO")   patch.PRESENTISMO   = v;
        if(k==="VIATICOS")      patch.VIATICOS      = v;
        if(k==="PLUS_NO_REMUNERATIVO") patch.PLUS_NR = v;
        if(k==="VALOR_HORA_NORMAL")    patch.V_HORA  = v;
        if(k==="VALOR_HORA_EXTRA_50")  patch.V_HORA_50 = v;
        if(k==="VALOR_HORA_EXTRA_100") patch.V_HORA_100 = v;
        if(k==="VALOR_HORA_NOCTURNA")  patch.V_HORA_NOC = v;
        if(k==="HORAS_NOCTURNAS_X_DIA") patch.HORAS_NOC_X_DIA = v|0;
      }
    }
    setConf(patch);
  }catch(e){
    // seguimos con local si falla
  }
}

// ===== Escalas
function aplicarEscala(ym){
  const e = ESCALAS[ym];
  if(!e) return false;
  const vNoc = Number((e.SUELDO_BASICO * 0.001).toFixed(2)); // 0,1% del básico por hora
  setConf({
    SUELDO_BASICO: e.SUELDO_BASICO,
    PRESENTISMO:   e.PRESENTISMO,
    VIATICOS:      e.VIATICOS,
    PLUS_NR:       e.PLUS_NR,
    V_HORA:        e.VALOR_HORA_NORMAL,
    V_HORA_50:     e.VALOR_HORA_EXTRA_50,
    V_HORA_100:    e.VALOR_HORA_EXTRA_100,
    V_HORA_NOC:    vNoc
  });
  localStorage.setItem(LS_SCALE_SELECTED, ym);
  refreshTagEscala();
  return true;
}
function refreshTagEscala(){
  const tag = $("#tag-escala");
  const mode = getMode();
  if(mode === "advanced"){
    tag.textContent = "Usando Opciones avanzadas";
    tag.className = "pill pill-adv";
    return;
  }
  const sel = localStorage.getItem(LS_SCALE_SELECTED);
  if(!sel){
    tag.textContent = "Escala: (sin seleccionar)";
    tag.className = "pill";
    return;
  }
  tag.textContent = `Escala: ${labelEscala(sel)}`;
  tag.className = "pill";
}

// ===== Modo (switch simple)
function getMode(){
  return localStorage.getItem(LS_MODE) || "scale";
}
function setMode(mode){
  localStorage.setItem(LS_MODE, mode);
  const scaleMode = mode === "scale";
  $("#btn-escalas").disabled = !scaleMode;
  refreshTagEscala();
}

function openModal(id){ $(id).classList.add("show"); }
function closeModal(id){ $(id).classList.remove("show"); }

/* ===== LÓGICA DE CÁLCULO (incluye APOS 3%) ===== */
function calcularSalario({
  diasFeriados = 0,
  aniosAntiguedad = 0,
  horasPool = 0,
  diasNocturnos = 0,
  horasPorDia = 12,
  formaPagoFeriado = 0,
  sindicato = false
}){
  const C = getConf();

  const factorAnt = 1 + 0.01 * Math.max(0, aniosAntiguedad);
  const mult50  = C.V_HORA > 0 ? (C.V_HORA_50  / C.V_HORA) : 1.5;
  const mult100 = C.V_HORA > 0 ? (C.V_HORA_100 / C.V_HORA) : 2.0;

  const vHoraAnt    = C.V_HORA * factorAnt;
  const vHora50Ant  = vHoraAnt * mult50;
  const vHora100Ant = vHoraAnt * mult100;

  let horasFeriado100 = 0;
  let horasFeriadoNormal = 0;

  if (horasPorDia === 12 && formaPagoFeriado === 0) {
    horasFeriado100    = diasFeriados * 4;
    horasFeriadoNormal = diasFeriados * 8;
  } else if (horasPorDia === 12 && formaPagoFeriado === 1) {
    horasFeriado100    = diasFeriados * 12;
  } else if ((horasPorDia === 8 || horasPorDia === 10) && formaPagoFeriado === 2) {
    horasFeriado100    = diasFeriados * horasPorDia;
  }

  const horasNoFeriado = Math.max(0, horasPool + C.HORAS_EXTRA_JORNADA);

  const horasNormales = Math.min(horasNoFeriado, C.HORAS_EXTRAS_DESDE);
  const horasExtras50 = Math.max(0, horasNoFeriado - C.HORAS_EXTRAS_DESDE);

  const valorExtras50       = horasExtras50       * vHora50Ant;
  const valorFeriado100     = horasFeriado100     * vHora100Ant;
  const valorFeriadoNormal  = horasFeriadoNormal  * vHoraAnt;
  const nocturnidad         = diasNocturnos * C.HORAS_NOC_X_DIA * C.V_HORA_NOC;
  const antiguedad          = C.SUELDO_BASICO * aniosAntiguedad * 0.01;

  const bruto = C.SUELDO_BASICO + C.PRESENTISMO + C.VIATICOS + C.PLUS_NR + C.PLUS_ADICIONAL
              + valorExtras50 + valorFeriado100 + valorFeriadoNormal
              + nocturnidad + antiguedad;

  const remunerativo = C.SUELDO_BASICO + C.PRESENTISMO + C.PLUS_ADICIONAL
                     + antiguedad + nocturnidad + valorExtras50 + valorFeriado100 + valorFeriadoNormal;

  let descuentos = remunerativo * 0.17;
  if (sindicato){ descuentos += remunerativo * 0.03; }

  const aposDesc = C.PLUS_NR * 0.03; // APOS 3% sobre no remunerativo
  descuentos += aposDesc;

  const neto = bruto - descuentos;

  const hsNoct = diasNocturnos * C.HORAS_NOC_X_DIA;

  const lineasFeriadoHoras =
    (horasPorDia===12 && formaPagoFeriado===0 && diasFeriados>0)
      ? `- Feriado 100%: ${horasFeriado100} hs
- Feriado pago normal: ${horasFeriadoNormal} hs
`
      : (horasFeriado100>0 ? `- Feriado 100%: ${horasFeriado100} hs
` : "");

  const lineasFeriadoHaberes =
    (horasPorDia===12 && formaPagoFeriado===0 && diasFeriados>0)
      ? `${valorFeriado100>0?`- Feriado 100%: ${money(valorFeriado100)}
`:""}- Feriado pago normal (8h x feriado): ${money(valorFeriadoNormal)}
`
      : `${valorFeriado100>0?`- Feriado 100%: ${money(valorFeriado100)}
`:""}`;

  const sindicatoLinea = sindicato ? `- Sindicato (3%): ${money(remunerativo*0.03)}
` : "";

  const detalle =
`DETALLE DE LIQUIDACIÓN

HORAS TRABAJADAS:
- Normales (pool para corte 208): ${horasNormales} hs
- Extras 50%: ${horasExtras50} hs
${lineasFeriadoHoras}${hsNoct>0?`- Nocturnas: ${hsNoct} hs
`:""}
TARIFAS APLICADAS (con antigüedad ${aniosAntiguedad} años):
- Hora normal ajustada: ${money(vHoraAnt)}
- Hora extra 50% ajustada: ${money(vHora50Ant)}
- Hora extra 100% ajustada: ${money(vHora100Ant)}

HABERES BRUTOS:
- Básico: ${money(C.SUELDO_BASICO)}
- Presentismo: ${money(C.PRESENTISMO)}
- Viáticos: ${money(C.VIATICOS)}
- Plus no remunerativo: ${money(C.PLUS_NR)}
${C.PLUS_ADICIONAL>0?`- Plus adicional: ${money(C.PLUS_ADICIONAL)}
`:""}- Extras 50%: ${money(valorExtras50)}
${lineasFeriadoHaberes}${hsNoct>0?`- Nocturnidad: ${money(nocturnidad)}
`:""}- Antigüedad: ${money(antiguedad)}

TOTAL BRUTO: ${money(bruto)}

DESCUENTOS:
- Jubilación (11%): ${money(remunerativo*0.11)}
- Obra Social (3%): ${money(remunerativo*0.03)}
- PAMI (3%): ${money(remunerativo*0.03)}
${sindicatoLinea}- AP O.S. 3% sobre suma no remunerativa: ${money(aposDesc)}
TOTAL DESCUENTOS: ${money(descuentos)}

NETO A COBRAR: ${money(neto)}`;

  return {
    neto, bruto, detalle,
    horasNormales, horasExtras50, horasFeriado100, horasFeriadoNormal
  };
}

// ===== UI wiring =====
window.addEventListener("DOMContentLoaded", async () => {
  await tryUpdateFromBlog();

  // Modo switch simple
  const initMode = localStorage.getItem(LS_MODE) || "scale";
  $("#chk-advanced").checked = (initMode === "advanced");
  setMode(initMode);

  $("#chk-advanced").addEventListener("change", (e)=>{
    setMode(e.target.checked ? "advanced" : "scale");
  });

  // Escala inicial
  let sel = localStorage.getItem(LS_SCALE_SELECTED);
  if(!sel){ sel = pickEscalaParaHoy(); }
  aplicarEscala(sel);

  // Llenar select escalas
  const selEscala = $("#sel-escala");
  selEscala.innerHTML = "";
  Object.keys(ESCALAS).sort().reverse().forEach(key=>{
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = ESCALAS[key].label || key;
    if(key === sel) opt.selected = true;
    selEscala.appendChild(opt);
  });
  refreshTagEscala();

  // Abrir modales
  $("#btn-escalas").onclick = ()=> openModal("#modal-escalas");
  $("#btn-opciones").onclick = ()=> openModal("#modal-opciones");
  $("#btn-opciones-2").onclick = ()=> openModal("#modal-opciones");

  // Modal escalas
  $("#btn-cerrar-escalas").onclick = ()=> closeModal("#modal-escalas");
  $("#btn-aplicar-escala").onclick = ()=>{
    const ym = $("#sel-escala").value;
    aplicarEscala(ym);
    closeModal("#modal-escalas");
  };

  // Modal modo de cálculo
  $("#btn-modo-dias").onclick  = () => { $("#modal-modo").classList.remove("show"); $("#form-dias").classList.remove("hide"); };
  $("#btn-modo-horas").onclick = () => { $("#modal-modo").classList.remove("show"); $("#form-horas").classList.remove("hide"); };
  $("#btn-acerca").onclick = () => {
    alert(
"Sueldo Vigilador (versión web)\n" +
"Adaptado desde la aplicación Android original.\n" +
"Calcula:\n" +
"- Horas extras al 50% y 100%\n" +
"- Nocturnidad y adicionales (0,1% del básico por hora)\n" +
"- Antigüedad (1% por año)\n" +
"- Modalidad por días u horas\n" +
"\n" +
"Desarrollado por Sebastián Sanavera.\n" +
"Código libre en GitHub.\n" +
"Tel: 11 3947 6360"
    );
  };

  // Nuevo cálculo
  $("#btn-nuevo").onclick = () => location.reload();

  // Turno noche (modo días)
  $("#turnoNocheDias").addEventListener("change", (e)=>{
    $("#diasNocturnosWrap").classList.toggle("hide", !e.target.checked);
    if(e.target.checked){
      const v = parseInt($("#diasTrabajados").value||"0",10);
      $("#diasNocturnosDias").value = v>0? v : "";
    }else{
      $("#diasNocturnosDias").value = "";
    }
  });

  // Detalle
  const openDetalle = ()=>{ $("#detalle-pre").textContent = DETALLE; $("#modal-detalle").classList.add("show"); };
  $("#btn-detalle-dias").onclick = openDetalle;
  $("#btn-detalle-horas").onclick = openDetalle;
  $("#btn-cerrar-detalle").onclick = ()=>$("#modal-detalle").classList.remove("show");
  $("#btn-copiar").onclick = async ()=>{
    try{ await navigator.clipboard.writeText($("#detalle-pre").textContent); alert("Detalle copiado"); }catch(_){}
  };

  // Guardar opciones avanzadas
  const fillOpc = ()=>{
    const C = getConf();
    $("#horasExtrasDesde").value = String(C.HORAS_EXTRAS_DESDE);
    $("#vHora").value = C.V_HORA;
    $("#vHora50").value = C.V_HORA_50;
    $("#vHora100").value = C.V_HORA_100;
    $("#vHoraNoc").value = C.V_HORA_NOC;
    $("#plusAdi").value = C.PLUS_ADICIONAL;
    $("#plusNR").value = C.PLUS_NR;
    $("#extraJornada").value = C.HORAS_EXTRA_JORNADA;
    $("#sBasico").value = C.SUELDO_BASICO;
    $("#presentismo").value = C.PRESENTISMO;
    $("#viaticos").value = C.VIATICOS;
    $("#horasNocXD").value = C.HORAS_NOC_X_DIA;
  };
  const openOpc = ()=>{ fillOpc(); $("#modal-opciones").classList.add("show"); };
  $("#btn-opciones").onclick = openOpc;
  $("#btn-opciones-2").onclick = openOpc;

  $("#btn-cancelar-opc").onclick = ()=>$("#modal-opciones").classList.remove("show");
  $("#btn-reset").onclick = ()=>{ resetConf(); fillOpc(); };
  $("#btn-guardar-opc").onclick = ()=>{
    setConf({
      HORAS_EXTRAS_DESDE: parseInt($("#horasExtrasDesde").value,10),
      V_HORA:     num($("#vHora").value, DEFAULTS.V_HORA),
      V_HORA_50:  num($("#vHora50").value, DEFAULTS.V_HORA_50),
      V_HORA_100: num($("#vHora100").value, DEFAULTS.V_HORA_100),
      V_HORA_NOC: num($("#vHoraNoc").value, DEFAULTS.V_HORA_NOC),
      PLUS_ADICIONAL: num($("#plusAdi").value, 0),
      PLUS_NR: num($("#plusNR").value, DEFAULTS.PLUS_NR),
      HORAS_EXTRA_JORNADA: parseInt($("#extraJornada").value||0,10),
      SUELDO_BASICO: num($("#sBasico").value, DEFAULTS.SUELDO_BASICO),
      PRESENTISMO:   num($("#presentismo").value, DEFAULTS.PRESENTISMO),
      VIATICOS:      num($("#viaticos").value, DEFAULTS.VIATICOS),
      HORAS_NOC_X_DIA: parseInt($("#horasNocXD").value||DEFAULTS.HORAS_NOC_X_DIA,10)
    });
    $("#modal-opciones").classList.remove("show");
  };

  // Calcular (modo DÍAS) — pool = días*horasDia - (feriados*4)
  $("#btn-calcular-dias").onclick = ()=>{
    const diasTrab = parseInt($("#diasTrabajados").value||"0",10);
    const diasFeri = parseInt($("#diasFeriados").value||"0",10);
    const aniosAnt = parseInt($("#aniosAnt").value||"0",10);
    const horasDia = parseInt($("#horasPorDia").value,10);
    const formaF   = parseInt($("#pagoFeriado").value,10);
    const turnoNoc = $("#turnoNocheDias").checked;
    const diasNoc  = turnoNoc ? parseInt($("#diasNocturnosDias").value||String(diasTrab)||"0",10) : 0;
    const sind     = $("#sindicatoDias").checked;

    const horasPool = Math.max(0, (diasTrab * horasDia) - (diasFeri * 4));

    const r = calcularSalario({
      diasFeriados: diasFeri,
      aniosAntiguedad: aniosAnt,
      horasPool,
      diasNocturnos: diasNoc,
      horasPorDia: horasDia,
      formaPagoFeriado: formaF,
      sindicato: sind
    });

    DETALLE = r.detalle;

    $("#resultado-dias").classList.remove("hide");
    $("#neto-dias").textContent  = "NETO A COBRAR: " + money(r.neto);
    $("#bruto-dias").textContent = "Bruto: " + money(r.bruto);
    $("#alt-dias").textContent   = "Resultado alternativo: " + money(r.neto);
  };

  // Calcular (modo HORAS) — pool = horasTotales - (feriados*4)
  $("#btn-calcular-horas").onclick = ()=>{
    const horasTot = parseInt($("#horasTotales").value||"0",10);
    const diasFeri = parseInt($("#diasFeriadosHoras").value||"0",10);
    const diasNoc  = parseInt($("#diasNocturnos").value||"0",10);
    const aniosAnt = parseInt($("#aniosAntHoras").value||"0",10);
    const sind     = $("#sindicatoHoras").checked;

    const horasPool = Math.max(0, horasTot - (diasFeri * 4));

    const horasDia = 12;
    const formaF   = 0;

    const r = calcularSalario({
      diasFeriados: diasFeri,
      aniosAntiguedad: aniosAnt,
      horasPool,
      diasNocturnos: diasNoc,
      horasPorDia: horasDia,
      formaPagoFeriado: formaF,
      sindicato: sind
    });

    DETALLE = r.detalle;

    $("#resultado-horas").classList.remove("hide");
    $("#neto-horas").textContent  = "NETO A COBRAR: " + money(r.neto);
    $("#bruto-horas").textContent = "Bruto: " + money(r.bruto);
  };
});
