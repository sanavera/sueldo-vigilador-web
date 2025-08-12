/* ===========================
   Sueldo Vigilador (web)
   Lógica clonada de la app Java
   =========================== */

// --- Valores por defecto (los de tu última versión)
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

// Claves para localStorage
const LS = "sv_conf_v1";

// Estado UI
let MODO_HORAS = false;
let DETALLE = "";

// Utilitarios
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function money(v){
  try{
    return (new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2})).format(v);
  }catch(_){
    return "$ " + v.toFixed(2).replace(".",",");
  }
}

// Cargar/guardar configuración
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

// Intento de actualizar desde el blog (graceful degrade por CORS)
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
    console.log("Valores actualizados desde el blog:", patch);
  }catch(e){
    console.log("No se pudieron actualizar valores (CORS/Red). Se usan valores guardados.");
  }
}

// ===== LÓGICA DE CÁLCULO (port de Java) =====
function calcularSalario({
  diasFeriados = 0,
  aniosAntiguedad = 0,
  horasTotales = 0,
  diasNocturnos = 0,
  horasPorDia = 12,
  formaPagoFeriado = 0,
  sindicato = false
}){
  const C = getConf();

  // Feriados → horas 100 exactas según modalidad
  // NOTA: en modalidad (0, 12h): 4h al 100% y 8h "pago normal" quedan en el pool (se decidirán normal/50% con el tope)
  let horasFeriado100 = 0;
  let horasFeriadoPagoNormal = 0; // solo informativa, NO se descuenta del pool ni se paga aparte

  if (horasPorDia === 12 && formaPagoFeriado === 0) {
    horasFeriado100 = diasFeriados * 4;
    horasFeriadoPagoNormal = diasFeriados * 8; // queda en el pool
  } else if (horasPorDia === 12 && formaPagoFeriado === 1) {
    horasFeriado100 = diasFeriados * 12; // se descuenta todo del pool
  } else if (formaPagoFeriado === 2 && (horasPorDia === 8 || horasPorDia === 10)) {
    horasFeriado100 = diasFeriados * horasPorDia; // se descuenta todo del pool
  }

  // Pool de horas que se contrastan contra el tope (no restamos las de "pago normal" del feriado)
  let horasPool = horasTotales - horasFeriado100 + C.HORAS_EXTRA_JORNADA;
  if (horasPool < 0) horasPool = 0;

  const horasNormales = Math.min(horasPool, C.HORAS_EXTRAS_DESDE);
  const horasExtras50 = Math.max(0, horasPool - C.HORAS_EXTRAS_DESDE);

  // Antigüedad aplicada a la hora (factor 1% por año)
  const factorAnt = 1 + 0.01 * Math.max(0, aniosAntiguedad);
  const mult50  = C.V_HORA > 0 ? (C.V_HORA_50 / C.V_HORA)   : 1.5;
  const mult100 = C.V_HORA > 0 ? (C.V_HORA_100 / C.V_HORA)  : 2.0;

  const vHoraAnt      = C.V_HORA * factorAnt;
  const vHora50Ant    = vHoraAnt * mult50;
  const vHora100Ant   = vHoraAnt * mult100;

  // Montos (OJO: no existe "valorFeriadoPagoNormal" aparte; esas horas ya están en horasNormales/extras)
  const valorHorasNormales = horasNormales * vHoraAnt;
  const valorExtras50      = horasExtras50 * vHora50Ant;
  const valorFeriado100    = horasFeriado100 * vHora100Ant;
  const nocturnidad        = diasNocturnos * C.HORAS_NOC_X_DIA * C.V_HORA_NOC;
  const antiguedad         = C.SUELDO_BASICO * aniosAntiguedad * 0.01;

  const bruto = C.SUELDO_BASICO + C.PRESENTISMO + C.VIATICOS + C.PLUS_NR + C.PLUS_ADICIONAL +
                valorHorasNormales + valorExtras50 + valorFeriado100 + nocturnidad + antiguedad;

  // Remunerativo (excluye PLUS_NR)
  const remunerativo = C.SUELDO_BASICO + C.PRESENTISMO + C.PLUS_ADICIONAL +
                       antiguedad + nocturnidad + valorHorasNormales + valorExtras50 + valorFeriado100;

  let descuentos = remunerativo * 0.17; // 11 + 3 + 3
  let sindicatoDesc = 0;
  if (sindicato){
    sindicatoDesc = remunerativo * 0.03;
    descuentos += sindicatoDesc;
  }

  const neto = bruto - descuentos;

  // Detalle
  const hsNoct = diasNocturnos * C.HORAS_NOC_X_DIA;
  const detalle =
`DETALLE DE LIQUIDACIÓN

HORAS TRABAJADAS:
- Normales (incluye no-100% de feriados): ${horasNormales} hs
- Extras 50%: ${horasExtras50} hs
- Feriado 100%: ${horasFeriado100} hs
${horasFeriadoPagoNormal>0?`- Feriado pago normal: ${horasFeriadoPagoNormal} hs (ya prorrateadas en normales/extras)\n`:""}${C.HORAS_EXTRA_JORNADA>0?`- Adicionales: ${C.HORAS_EXTRA_JORNADA} hs\n`:""}${hsNoct>0?`- Nocturnas: ${hsNoct} hs\n`:""}
TARIFAS APLICADAS (con antigüedad ${aniosAntiguedad} años):
- Hora normal ajustada: ${money(vHoraAnt)}
- Hora extra 50% ajustada: ${money(vHora50Ant)}
- Hora extra 100% ajustada: ${money(vHora100Ant)}

HABERES BRUTOS:
- Básico: ${money(C.SUELDO_BASICO)}
- Presentismo: ${money(C.PRESENTISMO)}
- Viáticos: ${money(C.VIATICOS)}
- Plus no remunerativo: ${money(C.PLUS_NR)}
${C.PLUS_ADICIONAL>0?`- Plus adicional: ${money(C.PLUS_ADICIONAL)}\n`:""}- Horas normales: ${money(valorHorasNormales)}
- Extras 50%: ${money(valorExtras50)}
- Feriado 100%: ${money(valorFeriado100)}
${hsNoct>0?`- Nocturnidad: ${money(nocturnidad)}\n`:""}- Antigüedad: ${money(antiguedad)}

TOTAL BRUTO: ${money(bruto)}

DESCUENTOS:
- Jubilación (11%): ${money(remunerativo*0.11)}
- Obra Social (3%): ${money(remunerativo*0.03)}
- PAMI (3%): ${money(remunerativo*0.03)}
${sindicato?`- Sindicato (3%): ${money(sindicatoDesc)}\n`:""}TOTAL DESCUENTOS: ${money(descuentos)}

NETO A COBRAR: ${money(neto)}`;

  return {
    neto, bruto, detalle,
    horasNormales, horasExtras50, horasFeriado100, horasFeriadoPagoNormal
  };
}

// ===== UI wiring =====
window.addEventListener("DOMContentLoaded", async () => {
  await tryUpdateFromBlog();

  // modal modo
  $("#btn-modo-dias").onclick = () => { MODO_HORAS=false; $("#modal-modo").classList.remove("show"); $("#form-dias").classList.remove("hide"); };
  $("#btn-modo-horas").onclick = () => { MODO_HORAS=true;  $("#modal-modo").classList.remove("show"); $("#form-horas").classList.remove("hide"); };
  $("#btn-acerca").onclick = () => {
    alert(
  "Sueldo Vigilador (versión web)\n" +
  "Adaptado desde la aplicación Android original.\n" +
  "Permite calcular el sueldo de un vigilador con opciones avanzadas:\n" +
  "- Horas normales y extras (50% y 100%)\n" +
  "- Horas nocturnas y adicionales\n" +
  "- Plus remunerativo y no remunerativo\n" +
  "- Cálculo por días o por horas trabajadas\n" +
  "\n" +
  "Desarrollado por Sebastián Sanavera\n" +
  "Código libre y disponible en GitHub.\n" +
  "Si querés el código para verlo, editarlo o aprender, escribime:\n" +
  "Tel: 11 3947 6360"
);  };

  // “Nuevo cálculo”
  $("#btn-nuevo").onclick = () => location.reload();

  // Mostrar/ocultar días nocturnos en modo días
  $("#turnoNocheDias").addEventListener("change", (e)=>{
    $("#diasNocturnosWrap").classList.toggle("hide", !e.target.checked);
    if(e.target.checked){
      const v = parseInt($("#diasTrabajados").value||"0",10);
      $("#diasNocturnosDias").value = v>0? v : "";
    }else{
      $("#diasNocturnosDias").value = "";
    }
  });

  // Opciones avanzadas (carga de valores)
  const loadOpciones = ()=>{
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
  const openOpc = ()=>{ loadOpciones(); $("#modal-opciones").classList.add("show"); };
  $("#btn-opciones").onclick = openOpc;
  $("#btn-opciones-2").onclick = openOpc;

  $("#btn-cancelar-opc").onclick = ()=>$("#modal-opciones").classList.remove("show");
  $("#btn-reset").onclick = ()=>{ resetConf(); loadOpciones(); };

  $("#btn-guardar-opc").onclick = ()=>{
    setConf({
      HORAS_EXTRAS_DESDE: parseInt($("#horasExtrasDesde").value,10),
      V_HORA:     parseFloat($("#vHora").value||DEFAULTS.V_HORA),
      V_HORA_50:  parseFloat($("#vHora50").value||DEFAULTS.V_HORA_50),
      V_HORA_100: parseFloat($("#vHora100").value||DEFAULTS.V_HORA_100),
      V_HORA_NOC: parseFloat($("#vHoraNoc").value||DEFAULTS.V_HORA_NOC),
      PLUS_ADICIONAL: parseFloat($("#plusAdi").value||0),
      PLUS_NR: parseFloat($("#plusNR").value||DEFAULTS.PLUS_NR),
      HORAS_EXTRA_JORNADA: parseInt($("#extraJornada").value||0,10),
      SUELDO_BASICO: parseFloat($("#sBasico").value||DEFAULTS.SUELDO_BASICO),
      PRESENTISMO: parseFloat($("#presentismo").value||DEFAULTS.PRESENTISMO),
      VIATICOS: parseFloat($("#viaticos").value||DEFAULTS.VIATICOS),
      HORAS_NOC_X_DIA: parseInt($("#horasNocXD").value||DEFAULTS.HORAS_NOC_X_DIA,10)
    });
    $("#modal-opciones").classList.remove("show");
  };

  // Detalle modal
  const openDetalle = ()=>{ $("#detalle-pre").textContent = DETALLE; $("#modal-detalle").classList.add("show"); };
  $("#btn-detalle-dias").onclick = openDetalle;
  $("#btn-detalle-horas").onclick = openDetalle;
  $("#btn-cerrar-detalle").onclick = ()=>$("#modal-detalle").classList.remove("show");
  $("#btn-copiar").onclick = async ()=>{
    try{ await navigator.clipboard.writeText($("#detalle-pre").textContent); alert("Detalle copiado"); }catch(_){ }
  };

  // Calcular (modo días)
  $("#btn-calcular-dias").onclick = ()=>{
    const diasTrab = parseInt($("#diasTrabajados").value||"0",10);
    const diasFeri = parseInt($("#diasFeriados").value||"0",10);
    const aniosAnt = parseInt($("#aniosAnt").value||"0",10);
    const horasDia = parseInt($("#horasPorDia").value,10);
    const formaF   = parseInt($("#pagoFeriado").value,10);
    const turnoNoc = $("#turnoNocheDias").checked;
    const diasNoc  = turnoNoc ? parseInt($("#diasNocturnosDias").value||String(diasTrab)||"0",10) : 0;
    const sind     = $("#sindicatoDias").checked;

    // 🔧 CAMBIO: horas totales SON los días totales * horas/día (NO sumamos los feriados)
    const horasTot = diasTrab * horasDia;

    const r = calcularSalario({
      diasFeriados: diasFeri,
      aniosAntiguedad: aniosAnt,
      horasTotales: horasTot,
      diasNocturnos: diasNoc,
      horasPorDia: horasDia,
      formaPagoFeriado: formaF,
      sindicato: sind
    });

    DETALLE = r.detalle;

    $("#resultado-dias").classList.remove("hide");
    $("#neto-dias").textContent  = "NETO A COBRAR: " + money(r.neto);
    $("#bruto-dias").textContent = "Bruto: " + money(r.bruto);

    $("#alt-dias").textContent = "Resultado alternativo: " + money(r.neto);
  };

  // Calcular (modo horas)
  $("#btn-calcular-horas").onclick = ()=>{
    const horasTot = parseInt($("#horasTotales").value||"0",10);
    const diasFeri = parseInt($("#diasFeriadosHoras").value||"0",10);
    const diasNoc  = parseInt($("#diasNocturnos").value||"0",10);
    const aniosAnt = parseInt($("#aniosAntHoras").value||"0",10);
    const sind     = $("#sindicatoHoras").checked;

    // En modo horas: usamos 12h por defecto para regla de feriados (igual que antes)
    const horasDia = 12;
    const formaF   = 0;

    const r = calcularSalario({
      diasFeriados: diasFeri,
      aniosAntiguedad: aniosAnt,
      horasTotales: horasTot,
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
