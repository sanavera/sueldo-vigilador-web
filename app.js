/* =========================================================
   Sueldo Vigilador (web) — JavaScript
   Autor: Sebastián Sanavera
   Descripción: lógica de escalas, cálculo y UI.
   ========================================================= */

/* === Escalas (2025) — solo montos fijos por mes === */
const SCALES = {
  "2025-07": { label: "Julio 2025",      SUELDO_BASICO: 745030, PRESENTISMO: 153600, VIATICOS: 435580, PLUS_NR: 25000 },
  "2025-08": { label: "Agosto 2025",     SUELDO_BASICO: 751735, PRESENTISMO: 153600, VIATICOS: 443215, PLUS_NR: 50000 },
  "2025-09": { label: "Septiembre 2025", SUELDO_BASICO: 808600, PRESENTISMO: 153600, VIATICOS: 448800, PLUS_NR: 0 },
  "2025-10": { label: "Octubre 2025",    SUELDO_BASICO: 817500, PRESENTISMO: 159600, VIATICOS: 473800, PLUS_NR: 0 },
  "2025-11": { label: "Noviembre 2025",  SUELDO_BASICO: 825600, PRESENTISMO: 159600, VIATICOS: 473800, PLUS_NR: 0 },
  "2025-12": { label: "Diciembre 2025",  SUELDO_BASICO: 833600, PRESENTISMO: 159600, VIATICOS: 473800, PLUS_NR: 25000 }
};
const SCALE_KEYS = ["2025-07","2025-08","2025-09", "2025-10", "2025-11", "2025-12"];

/* === Helpers de números/horas === */
function round2(n){ return Math.round((+n + Number.EPSILON) * 100) / 100; }
function computeRatesFromBasic(basico){
  // Hora base: convenio (aprox.) = básico / 166
  const V_HORA     = basico / 166;
  const V_HORA_50  = V_HORA * 1.5;
  const V_HORA_100 = V_HORA * 2.0;
  // Nocturna: 0,1% del básico POR HORA
  const V_HORA_NOC = basico * 0.001;
  return {
    V_HORA:      round2(V_HORA),
    V_HORA_50:   round2(V_HORA_50),
    V_HORA_100:  round2(V_HORA_100),
    V_HORA_NOC:  round2(V_HORA_NOC)
  };
}
function pickActiveScaleKey(d = new Date()){
  const currentKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  // Devuelve la escala más reciente que no sea futura
  let bestKey = SCALE_KEYS[0];
  for (const key of SCALE_KEYS) {
    if (key <= currentKey) {
      bestKey = key;
    } else {
      break;
    }
  }
  return bestKey;
}


/* === Defaults (se pisan con la escala o el guardado) === */
const DEFAULTS = {
  SUELDO_BASICO: 817500,
  PRESENTISMO:   159600,
  VIATICOS:      473800,
  PLUS_NR:       0,
  V_HORA:        4924.70,
  V_HORA_50:     7387.05,
  V_HORA_100:    9849.40,
  V_HORA_NOC:    817.50,
  HORAS_EXTRAS_DESDE: 208,
  HORAS_NOC_X_DIA: 9,
  PLUS_ADICIONAL: 0,
  HORAS_EXTRA_JORNADA: 0
};
const LS = "sv_conf_v1";

/* === Estado y utilidades UI === */
let DETALLE = "";
const $ = sel => document.querySelector(sel);
function num(v, def=0){ const n = Number(v); return Number.isFinite(n) ? n : def; }
function money(v){
  try{
    return (new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2})).format(v);
  }catch(_){
    return "$ " + Number(v||0).toFixed(2).replace(".",",");
  }
}

/* === Config en localStorage === */
function getConf(){
  const saved = JSON.parse(localStorage.getItem(LS) || "{}");
  return {...DEFAULTS, ...saved};
}
function setConf(partial){
  const next = {...getConf(), ...partial};
  localStorage.setItem(LS, JSON.stringify(next));
  return next;
}
function resetConf(){
  localStorage.setItem(LS, JSON.stringify(DEFAULTS));
}
function setScale(key){
  const base = SCALES[key];
  if(!base) return;
  const rates = computeRatesFromBasic(base.SUELDO_BASICO);
  // Al cambiar escala con el selector, no marcamos como override manual.
  // Solo se marca override al guardar cambios en Opciones Avanzadas.
  const currentConf = getConf();
  setConf({ ...base, ...rates, SCALE_KEY: key, USER_OVERRIDE: currentConf.USER_OVERRIDE });
}

/* === Cálculo principal === */
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

  // Antigüedad sobre valores hora
  const factorAnt = 1 + 0.01 * Math.max(0, aniosAntiguedad);
  const mult50  = C.V_HORA > 0 ? (C.V_HORA_50  / C.V_HORA) : 1.5;
  const mult100 = C.V_HORA > 0 ? (C.V_HORA_100 / C.V_HORA) : 2.0;

  const vHoraAnt    = C.V_HORA * factorAnt;
  const vHora50Ant  = vHoraAnt * mult50;
  const vHora100Ant = vHoraAnt * mult100;

  // Feriados
  let horasFeriado100 = 0;
  let horasFeriadoNormal = 0;
  if (horasPorDia === 12 && formaPagoFeriado === 0) {
    horasFeriado100    = diasFeriados * 4;
    horasFeriadoNormal = diasFeriados * 8;
  } else if (horasPorDia === 12 && formaPagoFeriado === 1) {
    horasFeriado100 = diasFeriados * 12;
  } else if ((horasPorDia === 8 || horasPorDia === 10) && formaPagoFeriado === 2) {
    horasFeriado100 = diasFeriados * horasPorDia;
  }

  // Corte 208
  const horasNoFeriado = Math.max(0, horasPool + C.HORAS_EXTRA_JORNADA);
  const horasNormales = Math.min(horasNoFeriado, C.HORAS_EXTRAS_DESDE);
  const horasExtras50 = Math.max(0, horasNoFeriado - C.HORAS_EXTRAS_DESDE);

  // Montos
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

  // Descuentos (11 + 3 + 3) y sindicato opcional
  let descLegales = remunerativo * 0.17;
  if (sindicato) descLegales += remunerativo * 0.03;

  const aposDesc = (C.PLUS_NR || 0) * 0.03;
  const descuentos = descLegales + aposDesc;
  const neto = bruto - descuentos;

  // Detalle (...omitted for brevity, same as original...)
  const hsNoct = diasNocturnos * C.HORAS_NOC_X_DIA;
  const lineasFeriadoHoras =
    (horasPorDia===12 && formaPagoFeriado===0 && diasFeriados>0)
      ? `- Feriado 100%: ${horasFeriado100} hs\n- Feriado pago normal: ${horasFeriadoNormal} hs\n`
      : (horasFeriado100>0 ? `- Feriado 100%: ${horasFeriado100} hs\n` : "");
  const lineasFeriadoHaberes =
    (horasPorDia===12 && formaPagoFeriado===0 && diasFeriados>0)
      ? `${valorFeriado100>0?`- Feriado 100%: ${money(valorFeriado100)}\n`:""}- Feriado pago normal (8h x feriado): ${money(valorFeriadoNormal)}\n`
      : `${valorFeriado100>0?`- Feriado 100%: ${money(valorFeriado100)}\n`:""}`;
  const sindicatoLinea = sindicato ? `- Sindicato (3%): ${money(remunerativo*0.03)}\n` : "";

  const detalle =
`DETALLE DE LIQUIDACIÓN

HORAS TRABAJADAS:
- Normales (pool para corte 208): ${horasNormales} hs
- Extras 50%: ${horasExtras50} hs
${lineasFeriadoHoras}${hsNoct>0?`- Nocturnas: ${hsNoct} hs\n`:""}
TARIFAS APLICADAS (con antigüedad ${aniosAntiguedad} años):
- Hora normal ajustada: ${money(vHoraAnt)}
- Hora extra 50% ajustada: ${money(vHora50Ant)}
- Hora extra 100% ajustada: ${money(vHora100Ant)}

HABERES BRUTOS:
- Básico: ${money(C.SUELDO_BASICO)}
- Presentismo: ${money(C.PRESENTISMO)}
- Viáticos: ${money(C.VIATICOS)}
- Plus no remunerativo: ${money(C.PLUS_NR)}
${C.PLUS_ADICIONAL>0?`- Plus adicional: ${money(C.PLUS_ADICIONAL)}\n`:""}- Extras 50%: ${money(valorExtras50)}
${lineasFeriadoHaberes}${hsNoct>0?`- Nocturnidad: ${money(nocturnidad)}\n`:""}- Antigüedad: ${money(antiguedad)}

TOTAL BRUTO: ${money(bruto)}

DESCUENTOS:
- Jubilación (11%): ${money(remunerativo*0.11)}
- Obra Social (3%): ${money(remunerativo*0.03)}
- PAMI (3%): ${money(remunerativo*0.03)}
${sindicatoLinea}- AP O.S. 3% sobre suma no remunerativa: ${money(aposDesc)}
TOTAL DESCUENTOS: ${money(descuentos)}

NETO A COBRAR: ${money(neto)}`;


  return { neto, bruto, descuentos, detalle };
}

/* === UI/Flujo === */
window.addEventListener("DOMContentLoaded", () => {
  const escalaSelInicio = $("#escalaMesInicio");
  const escalaSelOpc = $("#escalaMes");

  // --- Lógica del Asistente Virtual ---
  const overlay = $('#svb-overlay');
  const closeBtn = $('#svb-close');
  const frame = $('#svb-frame');
  const BOT_B64 = "aHR0cHM6Ly9sbG0tY2hhdC1hcHAtdGVtcGxhdGUuc2FuYXZlcmE3OC53b3JrZXJzLmRldi8=";
  let assistantLoaded = false;

  function ensureAssistantLoaded(){
    if(assistantLoaded) return;
    try { frame.src = atob(BOT_B64); assistantLoaded = true; } catch(e) { console.error("Error al cargar el asistente:", e); }
  }
  function openAssistant(){
    ensureAssistantLoaded();
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeAssistant(){
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  $("#btn-asistente").addEventListener('click', openAssistant);
  closeBtn.addEventListener('click', closeAssistant);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) closeAssistant(); });

  // --- Lógica de Escalas Salariales Sincronizadas ---
  function fillAllScaleOptions(){
    [escalaSelInicio, escalaSelOpc].forEach(sel => {
        if (!sel || sel.dataset.inited === "1") return;
        sel.innerHTML = "";
        for (const k of SCALE_KEYS){
          const opt = document.createElement("option");
          opt.value = k;
          opt.textContent = SCALES[k].label;
          sel.appendChild(opt);
        }
        sel.dataset.inited = "1";
    });
  }

  function syncAllScaleSelections(){
    const C = getConf();
    const key = C.SCALE_KEY || pickActiveScaleKey(new Date());
    if (escalaSelInicio) escalaSelInicio.value = key;
    if (escalaSelOpc) escalaSelOpc.value = key;
  }

  function handleScaleChange(e){
      const newKey = e.target.value;
      setScale(newKey);
      syncAllScaleSelections();
      if ($("#modal-opciones").classList.contains("show")) {
          fillOpcFields();
      }
  }

  fillAllScaleOptions();

  const C0 = getConf();
  if (!C0.USER_OVERRIDE) {
    setScale(pickActiveScaleKey(new Date()));
  }
  syncAllScaleSelections();

  escalaSelInicio.addEventListener("change", handleScaleChange);
  escalaSelOpc.addEventListener("change", handleScaleChange);

  // --- Eventos de UI Generales ---
  $("#btn-modo-dias").onclick  = () => { $("#modal-modo").classList.remove("show"); $("#form-dias").classList.remove("hide"); };
  $("#btn-modo-horas").onclick = () => { $("#modal-modo").classList.remove("show"); $("#form-horas").classList.remove("hide"); };
  $("#btn-acerca").onclick = () => { $("#modal-acerca").classList.add("show"); };
  $("#btn-cerrar-acerca").onclick = () => { $("#modal-acerca").classList.remove("show"); };
  $("#btn-nuevo").onclick = () => location.reload();

  $("#turnoNocheDias").addEventListener("change", (e)=>{
    $("#diasNocturnosWrap").classList.toggle("hide", !e.target.checked);
    if(e.target.checked){
      const v = parseInt($("#diasTrabajados").value||"0",10);
      $("#diasNocturnosDias").value = v > 0 ? v : "";
    } else {
      $("#diasNocturnosDias").value = "";
    }
  });

  /* --- Opciones avanzadas --- */
  function fillOpcFields(){
    const C = getConf();
    syncAllScaleSelections();
    $("#horasExtrasDesde").value = String(C.HORAS_EXTRAS_DESDE);
    $("#vHora").value     = C.V_HORA;
    $("#vHora50").value   = C.V_HORA_50;
    $("#vHora100").value  = C.V_HORA_100;
    $("#vHoraNoc").value  = C.V_HORA_NOC;
    $("#plusAdi").value   = C.PLUS_ADICIONAL;
    $("#plusNR").value    = C.PLUS_NR;
    $("#extraJornada").value = C.HORAS_EXTRA_JORNADA;
    $("#sBasico").value   = C.SUELDO_BASICO;
    $("#presentismo").value = C.PRESENTISMO;
    $("#viaticos").value  = C.VIATICOS;
    $("#horasNocXD").value = C.HORAS_NOC_X_DIA;
  }

  const openOpc = ()=>{
    fillOpcFields();
    $("#modal-opciones").classList.add("show");
  };
  $("#btn-opciones").onclick = openOpc;
  $("#btn-opciones-2").onclick = openOpc;

  $("#btn-cancelar-opc").onclick = ()=>$("#modal-opciones").classList.remove("show");
  $("#btn-reset").onclick = ()=>{
    resetConf();
    setScale(pickActiveScaleKey(new Date()));
    fillOpcFields();
    syncAllScaleSelections();
  };
  $("#btn-guardar-opc").onclick = ()=>{
    setConf({
      HORAS_EXTRAS_DESDE: parseInt($("#horasExtrasDesde").value,10),
      V_HORA:     num($("#vHora").value, getConf().V_HORA),
      V_HORA_50:  num($("#vHora50").value, getConf().V_HORA_50),
      V_HORA_100: num($("#vHora100").value, getConf().V_HORA_100),
      V_HORA_NOC: num($("#vHoraNoc").value, getConf().V_HORA_NOC),
      PLUS_ADICIONAL: num($("#plusAdi").value, 0),
      PLUS_NR: num($("#plusNR").value, getConf().PLUS_NR),
      HORAS_EXTRA_JORNADA: parseInt($("#extraJornada").value||0,10),
      SUELDO_BASICO: num($("#sBasico").value, getConf().SUELDO_BASICO),
      PRESENTISMO:   num($("#presentismo").value, getConf().PRESENTISMO),
      VIATICOS:      num($("#viaticos").value, getConf().VIATICOS),
      HORAS_NOC_X_DIA: parseInt($("#horasNocXD").value||getConf().HORAS_NOC_X_DIA,10),
      SCALE_KEY: escalaSelOpc.value,
      USER_OVERRIDE: true
    });
    syncAllScaleSelections();
    $("#modal-opciones").classList.remove("show");
  };

  /* --- Detalle --- */
  const openDetalle = ()=>{ $("#detalle-pre").textContent = DETALLE; $("#modal-detalle").classList.add("show"); };
  $("#btn-detalle-dias").onclick = openDetalle;
  $("#btn-detalle-horas").onclick = openDetalle;
  $("#btn-cerrar-detalle").onclick = ()=>$("#modal-detalle").classList.remove("show");
  $("#btn-copiar").onclick = async ()=>{
    const btn = $("#btn-copiar");
    const originalText = btn.textContent;
    try{
        await navigator.clipboard.writeText($("#detalle-pre").textContent);
        btn.textContent = "¡Copiado!";
    } catch(err) {
        btn.textContent = "Error al copiar";
        console.error("Error al copiar:", err);
    } finally {
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  };

  /* --- Calcular (DÍAS) --- */
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

    const r = calcularSalario({ diasFeriados: diasFeri, aniosAntiguedad: aniosAnt, horasPool, diasNocturnos: diasNoc, horasPorDia: horasDia, formaPagoFeriado: formaF, sindicato: sind });

    DETALLE = r.detalle;
    $("#resultado-dias").classList.remove("hide");
    $("#neto-dias").textContent  = "NETO A COBRAR: " + money(r.neto);
    $("#bruto-dias").textContent = "Bruto: " + money(r.bruto);
    $("#alt-dias").textContent   = "Descuentos: " + money(r.descuentos);
  };

  /* --- Calcular (HORAS) --- */
  $("#btn-calcular-horas").onclick = ()=>{
    const horasTot = parseInt($("#horasTotales").value||"0",10);
    const diasFeri = parseInt($("#diasFeriadosHoras").value||"0",10);
    const diasNoc  = parseInt($("#diasNocturnos").value||"0",10);
    const aniosAnt = parseInt($("#aniosAntHoras").value||"0",10);
    const sind     = $("#sindicatoHoras").checked;

    const horasPool = Math.max(0, horasTot - (diasFeri * 4));

    const r = calcularSalario({ diasFeriados: diasFeri, aniosAntiguedad: aniosAnt, horasPool, diasNocturnos: diasNoc, horasPorDia: 12, formaPagoFeriado: 0, sindicato: sind });

    DETALLE = r.detalle;
    $("#resultado-horas").classList.remove("hide");
    $("#neto-horas").textContent  = "NETO A COBRAR: " + money(r.neto);
    $("#bruto-horas").textContent = "Bruto: " + money(r.bruto);
    $("#alt-horas").textContent   = "Descuentos: " + money(r.descuentos);
  };
});
