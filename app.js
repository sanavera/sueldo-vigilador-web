/* ===========================
   Sueldo Vigilador (web)
   Regla feriado 12h (opción 0) — FINAL:
   - Pool para corte 208:
       · Modo DÍAS: dias*horasDia - (feriados*4)
       · Modo HORAS: horasTotales - (feriados*4)
   - Feriado 12h (opción 0): 4h al 100% + 8h feriado normal (renglón aparte)
   - No se agregan horas “extra” al pool por feriado
   =========================== */

// ===== Escalas precargadas (2025) =====
// Valores: CAESBA (básico, presentismo, viático NR, suma NR) + horas (julio oficiales; ago/sep derivados)
// Nocturnidad: 0,1% del básico (valor por hora de adicional nocturno)
const ESCALAS_2025 = {
  "2025-02": { // febrero 2025 (acta/anexo)
    SUELDO_BASICO: 725000,
    PRESENTISMO:   140000,
    VIATICOS:      400000,
    PLUS_NR:       0,
    V_HORA:        4373.60,
    V_HORA_50:     6560.40,
    V_HORA_100:    8747.20,
    V_HORA_NOC:    725.00,
    HORAS_NOC_X_DIA: 9
  },
  "2025-04": { // abril 2025 (acta/anexo)
    SUELDO_BASICO: 761000,
    PRESENTISMO:   140000,
    VIATICOS:      420000,
    PLUS_NR:       0,
    V_HORA:        4590.21,
    V_HORA_50:     6885.32,
    V_HORA_100:    9180.42,
    V_HORA_NOC:    761.00,
    HORAS_NOC_X_DIA: 9
  },
  "2025-07": { // julio 2025 (valores hora oficiales LVV)
    SUELDO_BASICO: 745030,
    PRESENTISMO:   153600,
    VIATICOS:      435580,
    PLUS_NR:       25000, // Suma no remunerativa
    V_HORA:        4493.15,
    V_HORA_50:     6739.75,
    V_HORA_100:    8986.30,
    V_HORA_NOC:    745.03,
    HORAS_NOC_X_DIA: 9
  },
  "2025-08": { // agosto 2025 (acta; horas derivadas +0,9%)
    SUELDO_BASICO: 751735,
    PRESENTISMO:   153600,
    VIATICOS:      443215,
    PLUS_NR:       50000,
    V_HORA:        4533.59,
    V_HORA_50:     6800.41,
    V_HORA_100:    9067.18,
    V_HORA_NOC:    751.74,
    HORAS_NOC_X_DIA: 9
  },
  "2025-09": { // septiembre 2025 (acta; horas derivadas +0,8% sobre ago)
    SUELDO_BASICO: 808600,
    PRESENTISMO:   153600,
    VIATICOS:      454295,
    PLUS_NR:       50000,
    V_HORA:        4569.86,
    V_HORA_50:     6854.79,
    V_HORA_100:    9139.72,
    V_HORA_NOC:    808.60,
    HORAS_NOC_X_DIA: 9
  }
};

// --- Valores por defecto (fallback / en localStorage)
const DEFAULTS = {
  SUELDO_BASICO: 751735,
  PRESENTISMO:   153600,
  VIATICOS:      443215,
  PLUS_NR:       50000,
  V_HORA:        rövid:4526.68,
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
  // Restablece a la escala vigente según fecha actual
  const key = pickEscalaByDate(new Date());
  const base = ESCALAS_2025[key] || DEFAULTS;
  localStorage.setItem(LS, JSON.stringify(base));
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
      const v = Number(rav);
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
    // seguimos con local
  }
}

/* ===== Helper: elegir escala vigente por fecha ===== */
function pickEscalaByDate(d){
  // Orden de vigencia conocida: Feb -> Abr -> Jul -> Ago -> Sep
  const checkpoints = [
    {k:"2025-02", from:new Date("2025-02-01")},
    {k:"2025-04", from:new Date("2025-04-01")},
    {k:"2025-07", from:new Date("2025-07-01")},
    {k:"2025-08", from:new Date("2025-08-01")},
    {k:"2025-09", from:new Date("2025-09-01")}
  ];
  let sel = "2025-07"; // Default a julio si no hay match
  for(const c of checkpoints){
    if(d >= c.from && (c.k === "2025-07" || c.k === "2025-08" || c.k === "2025-09")) sel = c.k;
  }
  return sel;
}

/* ===== LÓGICA DE CÁLCULO ===== */
function calcularSalario({
  diasFeriados = 0,
  aniosAntiguedad = 0,
  horasPool = 0,      // << horas ya preparadas para el corte 208 (ver callers)
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
  let horasFeriadoNormal = 0; // 8h por feriado (solo 12h opción 0)

  if (horasPorDia === 12 && formaPagoFeriado === 0) {
    // 4h al 100 + 8h feriado normal (renglón aparte)
    horasFeriado100    = diasFeriados * 4;
    horasFeriadoNormal = diasFeriados * 8;
  } else if (horasPorDia === 12 && formaPagoFeriado === 1) {
    horasFeriado100    = diasFeriados * 12; // todo el día al 100
  } else if ((horasPorDia === 8 || horasPorDia === 10) && formaPagoFeriado === 2) {
    horasFeriado100    = diasFeriados * horasPorDia; // jornada completa al 100
  }

  // Pool para corte 208 (ya viene preparado por el caller) + adicionales manuales
  const horasNoFeriado = Math.max(0, horasPool + C.HORAS_EXTRA_JORNADA);

  const horasNormales = Math.min(horasNoFeriado, C.HORAS_EXTRAS_DESDE);
  const horasExtras50 = Math.max(0, horasNoFeriado - C.HORAS_EXTRAS_DESDE);

  // Montos
  const valorExtras50       = horasExtras50       * vHora50Ant;
  const valorFeriado100     = horasFeriado100     * vHora100Ant;
  const valorFeriadoNormal  = horasFeriadoNormal  * vHoraAnt;   // remunerativo
  const nocturnidad         = diasNocturnos * C.HORAS_NOC_X_DIA * C.V_HORA_NOC; // 0,1% básico x hora
  const antiguedad          = C.SUELDO_BASICO * aniosAntiguedad * 0.01;

  // Bruto (el básico cubre las horas “normales” del pool; feriado normal es renglón aparte)
  const bruto = C.SUELDO_BASICO + C.PRESENTISMO + C.VIATICOS + C.PLUS_NR + C.PLUS_ADICIONAL
              + valorExtras50 + valorFeriado100 + valorFeriadoNormal
              + nocturnidad + antiguedad;

  // Remunerativo para descuentos (excluye PLUS_NR)
  const remunerativo = C.SUELDO_BASICO + C.PRESENTISMO + C.PLUS_ADICIONAL
                     + antiguedad + nocturnidad + valorExtras50 + valorFeriado100 + valorFeriadoNormal;

  // Descuentos legales + sindicato (si aplica)
  let descuentos = remunerativo * 0.17; // 11 + 3 + 3
  if (sindicato){
    descuentos += remunerativo * 0.03;
  }

  // AP O.S. 3% sobre SUMA NO REMUNERATIVA (PLUS_NR)
  const aposDesc = (getConf().PLUS_NR || 0) * 0.03;
  descuentos += aposDesc;

  const neto = bruto - descuentos;

  // Detalle
  const hsNoct = diasNocturnos * (getConf().HORAS_NOC_X_DIA || 0);

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

  const sindicatoLinea = sindicato abbassicato ? `- Sindicato (3%): ${money(remunerativo*0.03)}
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
- Básico: ${money(getConf().)SUELDO_BASICO)}
- Presentismo: ${money(getConf().PRESENTISMO)}
- Viáticos: ${money(getConf().VIATICOS)}
- Plus no remunerativo: ${money(getConf().PLUS_NR)}
${(getConf().PLUS_ADICIONAL||0)>0?`- Plus adicional: ${money(getConf().PLUS_ADICIONAL)}
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

/* ===== UI wiring ===== */
window.addEventListener("DOMContentLoaded", async () => {
  // Al inicio: setear escala vigente si no hay config guardada
  if (!localStorage.getItem(LS)) {
    const key = pickEscalaByDate(new Date());
    localStorage.setItem(LS, JSON.stringify(ESCALAS_2025[key] || DEFAULTS));
  }

  await tryUpdateFromBlog();

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

  // ====== Opciones avanzadas ======
  const escalaSelect = $("#escalaSelect");
  // Armar opciones del spinner
  const entries = Object.keys(ESCALAS_2025)
    .filter(k => k !== "2025-02" && k !== "2025-04") // Excluir Febrero y Abril
    .sort()
    .map(k => {
      const [y, m] = k.split("-");
      const mm = ({
8        "07": "Julio",
        "08": "Agosto",
        "09": "Septiembre"
      })[m] || k;
      return { k, label: `${mm} ${y}` };
    });
  escalaSelect.innerHTML = entries.map(e => `<option value="${e.k}">${e.label}</option>`).join("");

  // Selección por fecha actual
  const initialKey = pickEscalaByDate(new Date());
  escalaSelect.value = initialKey;

  // Rellenar campos con la conf guardada
  const fillOpc = ()=>{
    const C = getConf();
    $("#horasExtrasDesde").value = String(C.HORAS_EXTRAS_DESDE || 208);
    $("#vHora").value = C.V_HORA ?? "";
    $("#vHora50").value = C.V_HORA_50 ?? "";
    $("#vHora100").value = C.V_HORA_100 ?? "";
    $("#vHoraNoc").value = C.V_HORA_NOC ?? "";
    $("#plusAdi").value = C.PLUS_ADICIONAL ?? 0;
    $("#plusNR").value = C.PLUS_NR ?? 0;
    $("#extraJornada").value = C.HORAS_EXTRA_JORNADA ?? 0;
    $("#sBasico").value = C.SUELDO_BASICO ?? "";
    $("#presentismo").value = C.PRESENTISMO ?? "";
    $("#viaticos").value = C.VIATICOS ?? "";
    $("#horasNocXD").value = C.HORAS_NOC_X_DIA ?? 9;
  };
  const openOpc = ()=>{ fillOpc(); $("#modal-opciones").classList.add("show"); };
  $("#btn-opciones").onclick = openOpc;
  $("#btn-opciones-2").onclick = openOpc;

  // Cambio de escala desde el spinner (pisa todos los valores visibles)
  escalaSelect.addEventListener("change", ()=>{
    const key = escalaSelect.value;
    const esc = ESCALAS_2025[key];
    if(!esc) return;
    setConf(esc);
    fillOpc();
  });

  $("#btn-cancelar-opc").onclick = ()=>$("#modal-opciones").classList.remove("show");
  $("#btn-reset").onclick = ()=>{ resetConf(); fillOpc(); escalaSelect.value = pickEscalaByDate(new Date()); };
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
      HORAS_NOC_X_DIA: parseInt($("#horasNocXD").value||getConf().HORAS_NOC_X_DIA||9,10)
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

    // Pool para corte 208 según regla final
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

    // Regla: descontar sólo 4h por feriado del pool
    const horasPool = Math.max(0, horasTot - (diasFeri * 4));

    // Para la regla de feriado 12h opción 0
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
