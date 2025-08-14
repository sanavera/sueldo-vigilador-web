/* =========================================================
   Sueldo Vigilador (web) — JavaScript
   Autor: Sebastián Sanavera
   Descripción: lógica de escalas, cálculo y UI.
   ========================================================= */

/* === Escalas (2025) — solo montos fijos por mes === */
const SCALES = {
  "2025-07": { label: "Julio 2025",      SUELDO_BASICO: 745030, PRESENTISMO: 153600, VIATICOS: 435580, PLUS_NR: 25000 },
  "2025-08": { label: "Agosto 2025",     SUELDO_BASICO: 751735, PRESENTISMO: 153600, VIATICOS: 443215, PLUS_NR: 50000 },
  "2025-09": { label: "Septiembre 2025", SUELDO_BASICO: 808600, PRESENTISMO: 153600, VIATICOS: 448800, PLUS_NR:     0 }
};
const SCALE_KEYS = ["2025-07","2025-08","2025-09"];

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
  const y = d.getFullYear(), m = d.getMonth()+1;
  if (y < 2025 || (y === 2025 && m <= 7)) return "2025-07";
  if (y === 2025 && m === 8) return "2025-08";
  return "2025-09"; // desde septiembre en adelante
}

/* === Defaults (se pisan con la escala o el guardado) === */
const DEFAULTS = {
  SUELDO_BASICO: 751735,
  PRESENTISMO:   153600,
  VIATICOS:      443215,
  PLUS_NR:       50000,
  V_HORA:        4526.68,
  V_HORA_50:     6790.01,
  V_HORA_100:    9053.35,
  V_HORA_NOC:    751.74,  // 0,1% del básico de referencia
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
  setConf({ ...base, ...rates, SCALE_KEY: key, USER_OVERRIDE: false });
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

  // Feriados (12h opción 0: 4 al 100 + 8 normales)
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

  // APOS 3% sobre NO remunerativo
  const aposDesc = (C.PLUS_NR || 0) * 0.03;

  const descuentos = descLegales + aposDesc;
  const neto = bruto - descuentos;

  // Detalle
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
    neto, bruto, descuentos, detalle,
    horasNormales, horasExtras50, horasFeriado100, horasFeriadoNormal
  };
}

/* === UI/Flujo === */
window.addEventListener("DOMContentLoaded", () => {
  // Si no hay override manual, al abrir toma escala vigente por fecha
  const C0 = getConf();
  if (!C0.USER_OVERRIDE) setScale(pickActiveScaleKey(new Date()));

  // Modos
  $("#btn-modo-dias").onclick  = () => { $("#modal-modo").classList.remove("show"); $("#form-dias").classList.remove("hide"); };
  $("#btn-modo-horas").onclick = () => { $("#modal-modo").classList.remove("show"); $("#form-horas").classList.remove("hide"); };

  // Acerca de
  $("#btn-acerca").onclick = () => { $("#modal-acerca").classList.add("show"); };
  $("#btn-cerrar-acerca").onclick = () => { $("#modal-acerca").classList.remove("show"); };

  // Nuevo
  $("#btn-nuevo").onclick = () => location.reload();

  // Noche (modo días)
  $("#turnoNocheDias").addEventListener("change", (e)=>{
    $("#diasNocturnosWrap").classList.toggle("hide", !e.target.checked);
    if(e.target.checked){
      const v = parseInt($("#diasTrabajados").value||"0",10);
      $("#diasNocturnosDias").value = v>0? v : "";
    }else{
      $("#diasNocturnosDias").value = "";
    }
  });

  /* --- Opciones avanzadas (modal) --- */
  const escalaSel = $("#escalaMes");

  function fillScaleOptionsOnce(){
    if (!escalaSel || escalaSel.dataset.inited === "1") return;
    escalaSel.innerHTML = "";
    for (const k of SCALE_KEYS){
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = SCALES[k].label;
      escalaSel.appendChild(opt);
    }
    escalaSel.dataset.inited = "1";
  }
  function syncScaleSelection(){
    if (!escalaSel) return;
    const C = getConf();
    escalaSel.value = C.SCALE_KEY || pickActiveScaleKey(new Date());
  }
  function attachScaleListenerOnce(){
    if (!escalaSel || escalaSel.dataset.listen === "1") return;
    escalaSel.addEventListener("change", ()=>{
      setScale(escalaSel.value);
      fillOpcFields();
    });
    escalaSel.dataset.listen = "1";
  }

  function fillOpcFields(){
    const C = getConf();
    if (escalaSel) syncScaleSelection();
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
    fillScaleOptionsOnce();
    attachScaleListenerOnce();
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
      USER_OVERRIDE: true
    });
    $("#modal-opciones").classList.remove("show");
  };

  /* --- Detalle --- */
  const openDetalle = ()=>{ $("#detalle-pre").textContent = DETALLE; $("#modal-detalle").classList.add("show"); };
  $("#btn-detalle-dias").onclick = openDetalle;
  $("#btn-detalle-horas").onclick = openDetalle;
  $("#btn-cerrar-detalle").onclick = ()=>$("#modal-detalle").classList.remove("show");
  $("#btn-copiar").onclick = async ()=>{
    try{ await navigator.clipboard.writeText($("#detalle-pre").textContent); alert("Detalle copiado"); }catch(_){}
  };

  /* --- Calcular (DÍAS) — pool = días*horasDia - (feriados*4) --- */
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
    $("#alt-dias").textContent   = "Descuentos: " + money(r.descuentos);
  };

  /* --- Calcular (HORAS) — pool = horasTotales - (feriados*4) --- */
  $("#btn-calcular-horas").onclick = ()=>{
    const horasTot = parseInt($("#horasTotales").value||"0",10);
    const diasFeri = parseInt($("#diasFeriadosHoras").value||"0",10);
    const diasNoc  = parseInt($("#diasNocturnos").value||"0",10);
    const aniosAnt = parseInt($("#aniosAntHoras").value||"0",10);
    const sind     = $("#sindicatoHoras").checked;

    const horasPool = Math.max(0, horasTot - (diasFeri * 4));
    const horasDia = 12, formaF = 0;

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
    $("#alt-horas").textContent   = "Descuentos: " + money(r.descuentos);
  };
});


/* ==================================================================================================================
// // Idea: pausar/reanudar al cambiar de pestaña (descartado)
// // document.addEventListener("visibilitychange", ()=>{
// //   if(document.visibilityState === "hidden"){ /* pause */ 
// //   else { /* play if wasPlaying */ }
// // });

// // Ensayo: redondeo bancario (no lo usamos al final)
// // function roundBankers(n){
// //   const f = Math.floor(n*100);
// //   const r = n*100 - f;
// //   if (r === 0.5) return (f % 2 === 0) ? f/100 : (f+1)/100;
// //   return Math.round(n*100)/100;
// // }

// // Protoboard: otra fórmula para hora base (descartada por convenio)
// // function horaBaseAlt(basico){ return basico / 170; }

// // Simulador de feriado alternativo (12h todo al 100) — hoy manejado por formaPagoFeriado=1
// // function feriado12Completo(dias){ return dias * 12; } */
