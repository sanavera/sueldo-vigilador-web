/* ===========================
   Sueldo Vigilador (web)
   Regla feriado 12h (opción 0) — FINAL:
   - Pool para corte 208:
       · Modo DÍAS: dias*horasDia - (feriados*4)
       · Modo HORAS: horasTotales - (feriados*4)
   - Feriado 12h (opción 0): 4h al 100% + 8h feriado normal (renglón aparte)
   - No se agregan horas “extra” al pool por feriado
   =========================== */

/* ===== Escalas oficiales — 2025 (UPSRA) ===== */
const SCALES = {
  "2025-07": {
    label: "Julio 2025",
    SUELDO_BASICO: 745030,
    PRESENTISMO:   153600,
    VIATICOS:      435580,
    PLUS_NR:       25000
  },
  "2025-08": {
    label: "Agosto 2025",
    SUELDO_BASICO: 751735,
    PRESENTISMO:   153600,
    VIATICOS:      443215,
    PLUS_NR:       50000
  },
  "2025-09": {
    label: "Septiembre 2025",
    SUELDO_BASICO: 808600,
    PRESENTISMO:   153600,
    VIATICOS:      448800,
    PLUS_NR:       0
  }
};
const SCALE_KEYS = ["2025-07","2025-08","2025-09"];

function round2(n){ return Math.round((+n + Number.EPSILON) * 100) / 100; }
function computeRatesFromBasic(basico){
  const V_HORA     = basico / 166;      // base
  const V_HORA_50  = V_HORA * 1.5;
  const V_HORA_100 = V_HORA * 2.0;
  const V_HORA_NOC = basico * 0.001;    // 0,1% del básico
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
  return "2025-09"; // desde septiembre en adelante hasta nueva escala
}

// --- Valores por defecto (se pisan con escala al iniciar/guardar)
const DEFAULTS = {
  SUELDO_BASICO: 751735,
  PRESENTISMO:   153600,
  VIATICOS:      443215,
  PLUS_NR:       50000,
  V_HORA:        4526.68,
  V_HORA_50:     6790.01,
  V_HORA_100:    9053.35,
  V_HORA_NOC:    751.74,
  HORAS_EXTRAS_DESDE: 208,
  HORAS_NOC_X_DIA: 9,
  PLUS_ADICIONAL: 0,
  HORAS_EXTRA_JORNADA: 0
};

// Clave de configuración
const LS = "sv_conf_v1";

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
  return next;
}
function resetConf(){
  localStorage.setItem(LS, JSON.stringify(DEFAULTS));
}

// Guarda la escala elegida y recalcula valores-hora
function setScale(key){
  const base = SCALES[key];
  if(!base) return;
  const rates = computeRatesFromBasic(base.SUELDO_BASICO);
  setConf({
    ...base,
    ...rates,
    SCALE_KEY: key,
    USER_OVERRIDE: false
  });
}

/* ===== LÓGICA DE CÁLCULO ===== */
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

  // Antigüedad aplicada a los valores hora
  const factorAnt = 1 + 0.01 * Math.max(0, aniosAntiguedad);
  const mult50  = C.V_HORA > 0 ? (C.V_HORA_50  / C.V_HORA) : 1.5;
  const mult100 = C.V_HORA > 0 ? (C.V_HORA_100 / C.V_HORA) : 2.0;

  const vHoraAnt    = C.V_HORA * factorAnt;
  const vHora50Ant  = vHoraAnt * mult50;
  const vHora100Ant = vHoraAnt * mult100;

  // ----- Feriados
  let horasFeriado100 = 0;
  let horasFeriadoNormal = 0; // 8h por feriado (12h opción 0)

  if (horasPorDia === 12 && formaPagoFeriado === 0) {
    horasFeriado100    = diasFeriados * 4;
    horasFeriadoNormal = diasFeriados * 8;
  } else if (horasPorDia === 12 && formaPagoFeriado === 1) {
    horasFeriado100    = diasFeriados * 12;
  } else if ((horasPorDia === 8 || horasPorDia === 10) && formaPagoFeriado === 2) {
    horasFeriado100    = diasFeriados * horasPorDia;
  }

  // Pool para corte 208
  const horasNoFeriado = Math.max(0, horasPool + C.HORAS_EXTRA_JORNADA);
  const horasNormales = Math.min(horasNoFeriado, C.HORAS_EXTRAS_DESDE);
  const horasExtras50 = Math.max(0, horasNoFeriado - C.HORAS_EXTRAS_DESDE);

  // Montos
  const valorExtras50       = horasExtras50       * vHora50Ant;
  const valorFeriado100     = horasFeriado100     * vHora100Ant;
  const valorFeriadoNormal  = horasFeriadoNormal  * vHoraAnt;   // remunerativo
  const nocturnidad         = diasNocturnos * C.HORAS_NOC_X_DIA * C.V_HORA_NOC;
  const antiguedad          = C.SUELDO_BASICO * aniosAntiguedad * 0.01;

  // Bruto
  const bruto = C.SUELDO_BASICO + C.PRESENTISMO + C.VIATICOS + C.PLUS_NR + C.PLUS_ADICIONAL
              + valorExtras50 + valorFeriado100 + valorFeriadoNormal
              + nocturnidad + antiguedad;

  // Remunerativo (para aportes)
  const remunerativo = C.SUELDO_BASICO + C.PRESENTISMO + C.PLUS_ADICIONAL
                     + antiguedad + nocturnidad + valorExtras50 + valorFeriado100 + valorFeriadoNormal;

  // Descuentos legales + sindicato
  let descuentos = remunerativo * 0.17; // 11 + 3 + 3
  if (sindicato){
    descuentos += remunerativo * 0.03;
  }

  // APOS 3% sobre suma no remunerativa
  const aposDesc = (getConf().PLUS_NR || 0) * 0.03;
  const totalDescuentos = descuentos + aposDesc;

  const neto = bruto - totalDescuentos;

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
TOTAL DESCUENTOS: ${money(totalDescuentos)}

NETO A COBRAR: ${money(neto)}`;

  return {
    neto, bruto, detalle,
    horasNormales, horasExtras50, horasFeriado100, horasFeriadoNormal
  };
}

/* ===== UI wiring ===== */
window.addEventListener("DOMContentLoaded", () => {
  // Al iniciar: si no hay override manual, cargar escala vigente según fecha
  const C0 = getConf();
  if (!C0.USER_OVERRIDE) {
    setScale(pickActiveScaleKey(new Date()));
  }

  // Modo de cálculo
  $("#btn-modo-dias").onclick  = () => { $("#modal-modo").classList.remove("show"); $("#form-dias").classList.remove("hide"); };
  $("#btn-modo-horas").onclick = () => { $("#modal-modo").classList.remove("show"); $("#form-horas").classList.remove("hide"); };
  $("#btn-acerca").onclick = () => {
    alert(
"Sueldo Vigilador (versión web)\n" +
"Adaptado desde la aplicación Android original.\n" +
"Calcula:\n" +
"- Horas extras al 50% y 100%\n" +
"- Nocturnidad y adicionales\n" +
"- Antigüedad (1% por año)\n" +
"- Modalidad por días u horas\n" +
"\n" +
"Desarrollado por Sebastián Sanavera.\n" +
"Código libre en GitHub.\n" +
"Si querés el código para verlo/editarlo/aprender, escribime:\n" +
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

  /* ----- Opciones avanzadas ----- */
  const escalaSel = $("#escalaMes");
  function fillScaleOptionsOnce(){
    if (!escalaSel) return;
    if (escalaSel.dataset.inited === "1") return;
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
    if (!escalaSel) return;
    if (escalaSel.dataset.listen === "1") return;
    escalaSel.addEventListener("change", ()=>{
      setScale(escalaSel.value);
      fillOpcFields(); // refrescar campos visibles con la escala
    });
    escalaSel.dataset.listen = "1";
  }

  // Completar campos del modal con los valores actuales
  function fillOpcFields(){
    const C = getConf();
    if (escalaSel) syncScaleSelection();

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
  }

  const openOpc = ()=>{
    fillScaleOptionsOnce();   // crea opciones solo 1 vez
    attachScaleListenerOnce();// listener 1 vez
    fillOpcFields();          // refleja valores actuales
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

  // Detalle
  const openDetalle = ()=>{ $("#detalle-pre").textContent = DETALLE; $("#modal-detalle").classList.add("show"); };
  $("#btn-detalle-dias").onclick = openDetalle;
  $("#btn-detalle-horas").onclick = openDetalle;
  $("#btn-cerrar-detalle").onclick = ()=>$("#modal-detalle").classList.remove("show");
  $("#btn-copiar").onclick = async ()=>{
    try{ await navigator.clipboard.writeText($("#detalle-pre").textContent); alert("Detalle copiado"); }catch(_){}
  };

  // Calcular (modo DÍAS) — pool = días*horasDia - (feriados*4)
  $("#btn-calcular-dias").onclick = ()=>{
    const diasTrab = parseInt($("#diasTrabajados").value||"0",10); // totales (incluye feriados)
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
    const horasTot = parseInt($("#horasTotales").value||"0",10);   // total ingresado (incluye feriados)
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
