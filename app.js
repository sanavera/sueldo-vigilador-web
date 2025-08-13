/* ===========================
   Sueldo Vigilador (web)
   Regla feriado 12h (opción 0) — FINAL:
   - Pool para corte 208:
       · Modo DÍAS: dias*horasDia - (feriados*4)
       · Modo HORAS: horasTotales - (feriados*4)
   - Feriado 12h (opción 0): 4h al 100% + 8h feriado normal (renglón aparte)
   - No se agregan horas “extra” al pool por feriado
   =========================== */

// ===== Escalas precargadas (JUL/AGO/SEP 2025) =====
const SCALES = {
  "2025-07": {
    SUELDO_BASICO: 745030,
    PRESENTISMO:   153600,
    VIATICOS:      435580,
    PLUS_NR:       25000,
    V_HORA:        4583.01,
    V_HORA_50:     6874.52,
    V_HORA_100:    9166.03,
    V_HORA_NOC:    751.74,   // 0,1% del básico por hora (tu valor)
    HORAS_EXTRAS_DESDE: 208,
    HORAS_NOC_X_DIA: 9,
    PLUS_ADICIONAL: 0,
    HORAS_EXTRA_JORNADA: 0
  },
  "2025-08": {
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
  },
  "2025-09": { // por ahora igual a Agosto hasta confirmar
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
  }
};

// --- Defaults = Agosto (si no hay nada guardado)
const DEFAULTS = { ...SCALES["2025-08"] };

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
function setConf(fullObj){
  // Guardamos EXACTAMENTE lo que nos pasan (sin mezclar), para no pisar escalas
  localStorage.setItem(LS, JSON.stringify(fullObj));
  return fullObj;
}
function resetConfToScaleKey(key){
  if (SCALES[key]) setConf(SCALES[key]);
}
function resetConf(){
  setConf(DEFAULTS);
}

// Escala vigente por fecha
function getAutoScaleKey(d=new Date()){
  const y = d.getFullYear(), m = d.getMonth()+1;
  if (y > 2025 || (y === 2025 && m >= 9)) return "2025-09";
  if (y === 2025 && m >= 8) return "2025-08";
  return "2025-07";
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

  // ----- Feriados (pagos separados)
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

  // Pool (no incluye feriado 100 ni feriado normal)
  const horasNoFeriado = Math.max(0, horasPool);

  const horasNormales = Math.min(horasNoFeriado, C.HORAS_EXTRAS_DESDE);
  const horasExtras50 = Math.max(0, horasNoFeriado - C.HORAS_EXTRAS_DESDE);

  // Montos
  const valorExtras50       = horasExtras50       * vHora50Ant;
  const valorFeriado100     = horasFeriado100     * vHora100Ant;
  const valorFeriadoNormal  = horasFeriadoNormal  * vHoraAnt;   // remunerativo
  const nocturnidad         = diasNocturnos * C.HORAS_NOC_X_DIA * C.V_HORA_NOC;
  const antiguedad          = C.SUELDO_BASICO * aniosAntiguedad * 0.01;

  const bruto = C.SUELDO_BASICO + C.PRESENTISMO + C.VIATICOS + C.PLUS_NR + C.PLUS_ADICIONAL
              + valorExtras50 + valorFeriado100 + valorFeriadoNormal
              + nocturnidad + antiguedad;

  const remunerativo = C.SUELDO_BASICO + C.PRESENTISMO + C.PLUS_ADICIONAL
                     + antiguedad + nocturnidad + valorExtras50 + valorFeriado100 + valorFeriadoNormal;

  let descuentos = remunerativo * 0.17; // 11 + 3 + 3
  if (sindicato){
    descuentos += remunerativo * 0.03;
  }

  // APOS 3% sobre suma no remunerativa
  const aposDesc = C.PLUS_NR * 0.03;
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
window.addEventListener("DOMContentLoaded", () => {
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

  // ===== Opciones avanzadas
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
  const openOpc = ()=>{ fillOpc(); syncScaleSelectFromConf(); $("#modal-opciones").classList.add("show"); };
  $("#btn-opciones").onclick = openOpc;
  $("#btn-opciones-2").onclick = openOpc;

  $("#btn-cancelar-opc").onclick = ()=>$("#modal-opciones").classList.remove("show");
  $("#btn-reset").onclick = ()=>{
    const key = getAutoScaleKey(new Date());
    resetConfToScaleKey(key);
    fillOpc();
    const sel = $("#scaleSelect"); if (sel) sel.value = key;
  };
  $("#btn-guardar-opc").onclick = ()=>{
    const next = {
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
    };
    setConf(next);
    $("#modal-opciones").classList.remove("show");
  };

  // Cambiar escala salarial desde el spinner (aplica INMEDIATO a los campos)
  $("#scaleSelect")?.addEventListener("change", (e)=>{
    const key = e.target.value;
    if (SCALES[key]) {
      setConf(SCALES[key]); // guardamos EXACTO
      fillOpc();            // refrescamos inputs
    }
  });

  function syncScaleSelectFromConf(){
    const C = getConf();
    const found = Object.entries(SCALES).find(([k,v]) =>
      v.SUELDO_BASICO === C.SUELDO_BASICO &&
      v.PLUS_NR === C.PLUS_NR &&
      v.V_HORA === C.V_HORA &&
      v.V_HORA_100 === C.V_HORA_100
    );
    const key = found ? found[0] : getAutoScaleKey(new Date());
    const sel = $("#scaleSelect"); if (sel) sel.value = key;
  }

  // ===== Detalle
  const openDetalle = ()=>{ $("#detalle-pre").textContent = DETALLE; $("#modal-detalle").classList.add("show"); };
  $("#btn-detalle-dias").onclick = openDetalle;
  $("#btn-detalle-horas").onclick = openDetalle;
  $("#btn-cerrar-detalle").onclick = ()=>$("#modal-detalle").classList.remove("show");
  $("#btn-copiar").onclick = async ()=>{
    try{ await navigator.clipboard.writeText($("#detalle-pre").textContent); alert("Detalle copiado"); }catch(_){}
  };

  // ===== Calcular (modo DÍAS)
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

  // ===== Calcular (modo HORAS)
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

  // Bootstrap inicial: si no hay LS, setear escala vigente
  if (!localStorage.getItem(LS)) {
    resetConfToScaleKey(getAutoScaleKey(new Date()));
  }
});
