import { centavos, dinero } from "../../dominio/compra.js";
import { prepararCompraFinanciera } from "../flujo-financiero.js";

/** Pasos del registro guiado, en orden. */
export const PASOS = [
  { id: "camara", nombre: "Fotos" },
  { id: "fotos", nombre: "Revisar fotos" },
  { id: "importe", nombre: "Importe" },
  { id: "donde", nombre: "Dónde" },
  { id: "quien", nombre: "Para quién" },
  { id: "pago", nombre: "Pago" },
  { id: "revisar", nombre: "Revisar" },
];

const claro = {
  warnBg: "#FBEFD9",
  warnInk: "#7A4206",
  infoBg: "#E4EDF9",
  infoInk: "#1F4E8C",
  dangerInk: "#A3261B",
  borde: "1px",
};
const oscuro = {
  warnBg: "#3A2A12",
  warnInk: "#F5C27A",
  infoBg: "#17283D",
  infoInk: "#9CC8F5",
  dangerInk: "#FF8A80",
  borde: "1px",
};
const M = "Manrope, system-ui, sans-serif";

/** Temas de la interfaz guiada. Solo cambian el aspecto, nunca los datos. */
export const TEMAS = {
  bosque: {
    ...claro,
    nombre: "Bosque",
    desc: "Verde sereno",
    font: M,
    r: "16px",
    bg: "#F2F5F3",
    sur: "#FFFFFF",
    sur2: "#E4E9E6",
    ink: "#13201A",
    ink2: "#4B5A53",
    line: "#DCE3DF",
    acc: "#1C5A45",
    onAcc: "#FFFFFF",
    accSoft: "#E2EFE8",
    accSoftInk: "#1C5A45",
  },
  noche: {
    ...oscuro,
    nombre: "Noche",
    desc: "Oscuro, descansa la vista",
    font: M,
    r: "16px",
    bg: "#0F1419",
    sur: "#1A222B",
    sur2: "#252F3A",
    ink: "#EEF2F5",
    ink2: "#A9B6C2",
    line: "#2E3946",
    acc: "#5CC8A0",
    onAcc: "#0B1A14",
    accSoft: "#18352C",
    accSoftInk: "#7FE0BC",
  },
  contraste: {
    ...claro,
    nombre: "Alto contraste",
    desc: "Para leer al sol",
    font: "system-ui, sans-serif",
    r: "8px",
    borde: "2px",
    bg: "#FFFFFF",
    sur: "#FFFFFF",
    sur2: "#EDEDED",
    ink: "#000000",
    ink2: "#1F1F1F",
    line: "#000000",
    acc: "#0039A6",
    onAcc: "#FFFFFF",
    accSoft: "#DCE6FF",
    accSoftInk: "#002780",
    warnBg: "#FFE9A8",
    warnInk: "#4A3000",
    infoInk: "#002780",
  },
  oceano: {
    ...claro,
    nombre: "Océano",
    desc: "Azules frescos",
    font: M,
    r: "18px",
    bg: "#EEF4FA",
    sur: "#FFFFFF",
    sur2: "#DDE7F2",
    ink: "#0E1E2E",
    ink2: "#46586B",
    line: "#D3DFEB",
    acc: "#1557B0",
    onAcc: "#FFFFFF",
    accSoft: "#DCE9F9",
    accSoftInk: "#0F4590",
  },
  arcilla: {
    ...claro,
    nombre: "Arcilla",
    desc: "Cálido, tierra",
    font: M,
    r: "20px",
    bg: "#FAF4EE",
    sur: "#FFFDFB",
    sur2: "#F0E4D8",
    ink: "#2B1A12",
    ink2: "#6A4E40",
    line: "#EADBCC",
    acc: "#A84A24",
    onAcc: "#FFFFFF",
    accSoft: "#F7E1D5",
    accSoftInk: "#8E3D1D",
  },
  lavanda: {
    ...claro,
    nombre: "Lavanda",
    desc: "Suave y tranquilo",
    font: M,
    r: "22px",
    bg: "#F5F3FB",
    sur: "#FFFFFF",
    sur2: "#E8E4F5",
    ink: "#1D1830",
    ink2: "#544C6E",
    line: "#E0DBEF",
    acc: "#5B3FC4",
    onAcc: "#FFFFFF",
    accSoft: "#EAE4FB",
    accSoftInk: "#44299E",
  },
  arena: {
    ...claro,
    nombre: "Arena",
    desc: "Sobrio, blanco y negro",
    font: M,
    r: "6px",
    bg: "#F4F1EA",
    sur: "#FFFFFF",
    sur2: "#E7E2D6",
    ink: "#1F1D18",
    ink2: "#5A554A",
    line: "#D9D2C2",
    acc: "#2F2B24",
    onAcc: "#F4F1EA",
    accSoft: "#E7E2D6",
    accSoftInk: "#2F2B24",
  },
  grafito: {
    ...oscuro,
    nombre: "Grafito",
    desc: "Oscuro con lima",
    font: M,
    r: "14px",
    bg: "#121212",
    sur: "#1E1E1E",
    sur2: "#2A2A2A",
    ink: "#F2F2F2",
    ink2: "#B3B3B3",
    line: "#333333",
    acc: "#C6F432",
    onAcc: "#141A00",
    accSoft: "#2C3612",
    accSoftInk: "#D8FF6A",
  },
  sol: {
    ...claro,
    nombre: "Sol",
    desc: "Amarillo con energía",
    font: M,
    r: "24px",
    bg: "#FFF9E8",
    sur: "#FFFFFF",
    sur2: "#FCEFC4",
    ink: "#241C00",
    ink2: "#5E5122",
    line: "#F1E4B5",
    acc: "#F2B705",
    onAcc: "#241C00",
    accSoft: "#FCEFC4",
    accSoftInk: "#6B4E00",
  },
  rosa: {
    ...claro,
    nombre: "Rosa",
    desc: "Alegre",
    font: M,
    r: "20px",
    bg: "#FDF2F5",
    sur: "#FFFFFF",
    sur2: "#F8E1E8",
    ink: "#2A1119",
    ink2: "#6B4651",
    line: "#F2D9E1",
    acc: "#C2185B",
    onAcc: "#FFFFFF",
    accSoft: "#FADDE7",
    accSoftInk: "#970F45",
  },
};

/** Variables CSS del tema para el contenedor de la interfaz guiada. */
export function variablesTema(id) {
  const t = TEMAS[id] || TEMAS.bosque;
  return Object.fromEntries(
    Object.entries(t)
      .filter(([k]) => !["nombre", "desc"].includes(k))
      .map(([k, v]) => [`--g-${k}`, v]),
  );
}

const CLAVES = {
  guiada: "gastos.interfaz-guiada",
  aprendizaje: "gastos.modo-aprendizaje",
  tema: "gastos.tema",
};

/** Preferencias del teléfono. Sin almacenamiento disponible, se usan los valores iniciales. */
export function leerPreferencias(storage) {
  const leer = (clave, inicial) => {
    try {
      const v = storage?.getItem(clave);
      return v === null || v === undefined ? inicial : v;
    } catch {
      return inicial;
    }
  };
  const tema = leer(CLAVES.tema, "bosque");
  return {
    guiada: leer(CLAVES.guiada, "1") !== "0",
    aprendizaje: leer(CLAVES.aprendizaje, "1") !== "0",
    tema: TEMAS[tema] ? tema : "bosque",
  };
}

export function guardarPreferencias(storage, prefs) {
  try {
    storage?.setItem(CLAVES.guiada, prefs.guiada ? "1" : "0");
    storage?.setItem(CLAVES.aprendizaje, prefs.aprendizaje ? "1" : "0");
    storage?.setItem(CLAVES.tema, TEMAS[prefs.tema] ? prefs.tema : "bosque");
  } catch {
    // Sin almacenamiento la preferencia dura hasta cerrar la app.
  }
}

/** Mantiene la primera versión de cada persona sin fusionar identidades. */
export function partesUnicas(...listas) {
  const vistos = new Set();
  return listas.flat().filter((p) => {
    if (vistos.has(p.id)) return false;
    vistos.add(p.id);
    return true;
  });
}

/** Índice dentro de una lista circular: después de la última vuelve a la primera. */
export function indiceCircular(i, n) {
  if (!n) return 0;
  return ((i % n) + n) % n;
}

/** Devuelve una copia de la lista con el elemento movido de posición. */
export function moverFoto(lista, de, a) {
  if (de === a || de < 0 || a < 0 || de >= lista.length || a >= lista.length)
    return lista.slice();
  const copia = lista.slice();
  const [x] = copia.splice(de, 1);
  copia.splice(a, 0, x);
  return copia;
}

/**
 * Traduce las respuestas simples del asistente a la selección que espera
 * `prepararCompraFinanciera`. No calcula saldos: eso lo hace la API.
 */
export function seleccionDePago({
  quien,
  pagado,
  origen,
  monto = "",
  reparto = [],
  pagador_id = "",
  propietario_id = "",
  monto_fondo = "",
}) {
  if (quien === "varios" && pagado === "si")
    return {
      tipo: "avanzado",
      forma_pago: "contado",
      asignaciones: reparto.map((r) => ({
        parte_id: r.parte_id === "personal" ? null : r.parte_id,
        monto: r.monto,
      })),
      pagos: reparto.map((r, i) => ({
        origen: r.origen,
        parte_id: r.pagador_id || null,
        monto: r.monto,
        asignacion: i,
      })),
    };
  if (pagado === "nose") return { tipo: "sin_detalle" };
  if (quien === "personal") {
    if (pagado === "si") return { tipo: "personal" };
    return { tipo: "sin_detalle" };
  }
  if (pagado === "credito") return { tipo: "credito", parte_id: quien };
  if (pagado === "si" && origen === "propio")
    return { tipo: "propio", parte_id: quien };
  if (pagado === "si" && origen === "combinado") {
    const propio = (centavos(monto) - centavos(monto_fondo)) / 100;
    return {
      tipo: "avanzado",
      forma_pago: "contado",
      asignaciones: [{ parte_id: quien, monto }],
      pagos: [
        {
          origen: "fondo",
          parte_id: propietario_id,
          monto: monto_fondo,
          asignacion: 0,
        },
        { origen: "propio", monto: propio.toFixed(2), asignacion: 0 },
      ],
    };
  }
  if (pagado === "si" && origen === "fondo")
    return {
      tipo: "avanzado",
      forma_pago: "contado",
      asignaciones: [{ parte_id: quien, monto: monto }],
      pagos: [
        {
          origen: "fondo",
          parte_id: propietario_id,
          monto: monto,
          asignacion: 0,
        },
      ],
    };
  if (pagado === "si" && origen === "tercero")
    return { tipo: "tercero", parte_id: quien, pagador_id };
  return { tipo: "" };
}

/** Mensaje que explica qué falta en el paso; vacío si se puede seguir. */
export function faltaEnPaso(paso, d) {
  if (paso === "fotos" && !d.fotos.length && d.comprobante === "factura")
    return "Sacá al menos una foto, o volvé y tocá «No tengo factura».";
  if (paso === "importe") {
    try {
      if (centavos(d.monto) <= 0) return "Escribí el total para seguir.";
    } catch {
      return "Escribí el total para seguir.";
    }
  }
  if (paso === "donde") {
    if (!d.proveedor?.trim()) return "Escribí el nombre del negocio.";
    if (!d.concepto?.trim()) return "Escribí qué compraste.";
  }
  if (paso === "quien" && !d.quien) return "Elegí para quién es el gasto.";
  if (paso === "quien" && d.quien === "varios") {
    const reparto = d.reparto || [];
    if (reparto.length < 2 || reparto.some((r) => !r.parte_id || !r.monto))
      return "Agregá al menos dos destinos con sus importes.";
    try {
      if (
        reparto.reduce((n, r) => n + centavos(r.monto), 0) !== centavos(d.monto)
      )
        return "Los importes deben sumar el total de la compra.";
    } catch {
      return "Revisá los importes del reparto.";
    }
  }
  if (paso === "pago") {
    if (!d.pagado) return "Contestá si ya se pagó.";
    if (d.quien === "varios") {
      if (d.pagado !== "si")
        return "Para este reparto indicá los pagos realizados o usá la opción avanzada.";
      for (const r of d.reparto || []) {
        if (!r.origen) return "Elegí el origen del pago para cada parte.";
        if (r.origen === "fondo" && !r.pagador_id)
          return "Elegí el dueño del fondo para cada pago.";
        if (r.origen === "tercero" && !r.pagador_id)
          return "Elegí quién pagó directamente.";
      }
      return "";
    }
    if (
      d.pagado === "si" &&
      ["fondo", "combinado"].includes(d.origen) &&
      !d.propietario_id
    )
      return "Elegí el dueño del fondo.";
    if (d.pagado === "si" && d.origen === "combinado") {
      try {
        const usado = centavos(d.monto_fondo);
        if (usado <= 0 || usado >= centavos(d.monto))
          return "Indicá un importe del fondo menor que el total de la compra.";
      } catch {
        return "Indicá cuánto se pagó con el fondo.";
      }
    }
    if (d.pagado === "si" && d.origen === "tercero" && !d.pagador_id)
      return "Elegí quién pagó directamente.";
    if (d.pagado === "si" && d.quien !== "personal" && !d.origen)
      return "Elegí con qué plata se pagó.";
  }
  return "";
}

/** Arma la entrada de `api.compras.registrar` con las respuestas del asistente. */
export function prepararCompraGuiada(d, fecha) {
  const compra = {
    id: d.id,
    gestion_id: d.gestion_id || null,
    fecha_compra: d.fecha || fecha,
    fecha_registro: new Date().toISOString(),
    concepto: d.concepto.trim(),
    proveedor: d.proveedor.trim(),
    importe: centavos(d.monto),
    moneda: d.moneda,
    factura: d.factura || "",
    estado: d.comprobante,
    catalogos: [],
  };
  const faltaQuien = faltaEnPaso("quien", d),
    faltaPago = faltaEnPaso("pago", d);
  if (faltaQuien || faltaPago) throw new Error(faltaQuien || faltaPago);
  return prepararCompraFinanciera(compra, seleccionDePago(d));
}

/** Presenta las mismas fuentes que se enviarán a la API. */
export function resumenPagoCombinado(d, fecha, nombre) {
  try {
    const entrada = prepararCompraGuiada(d, fecha);
    const fondo = entrada.pagos.find((p) => p.origen === "fondo");
    const propio = entrada.pagos.find((p) => p.origen === "propio");
    if (!fondo || !propio) return "Completá las dos fuentes del pago.";
    return `Del fondo de ${nombre}: ${dinero(fondo.importe, entrada.moneda)}; de mi dinero: ${dinero(propio.importe, entrada.moneda)}.`;
  } catch {
    return "Completá las dos fuentes del pago.";
  }
}

/** Explicaciones del modo aprendizaje, en palabras simples. */
export const AYUDA = {
  camara: {
    pasos: [
      "Poné la factura sobre una mesa, donde haya luz.",
      "Acercá el teléfono hasta que la factura se vea entera.",
      "Tocá el botón grande «Sacar foto».",
      "Si tenés el voucher de la tarjeta, sacale foto también.",
      "Cuando termines, tocá «Listo».",
    ],
    porque: "Las fotos van en el informe como prueba del gasto.",
  },
  fotos: {
    pasos: [
      "Mirá la foto grande. ¿Se leen los números? Si no, tocá «Quitar» y sacala otra vez.",
      "Tocá qué es: «Factura» es la hoja del negocio; «Voucher» es el papelito de la tarjeta.",
      "Para ver la otra foto, pasá el dedo hacia un lado o tocá las flechas.",
    ],
    porque: "Si la factura es larga y salió en partes, dejalas en orden.",
  },
  importe: {
    pasos: [
      "Mirá tu factura y buscá donde dice TOTAL.",
      "Escribí ese número con los botones. Si te equivocás, tocá ⌫ para borrar.",
      "Si pagaste en dólares, tocá primero «Dólares».",
    ],
    ejemplo: "si dice TOTAL 4,250.75, tocá 4, 2, 5, 0, el punto, 7 y 5.",
    porque: "Así se sabe cuánto se gastó.",
  },
  donde: {
    pasos: [
      "Escribí el nombre del negocio, como sale arriba en la factura.",
      "Después escribí qué compraste, con pocas palabras.",
    ],
    ejemplo: "«Ferretería del Centro» y «Materiales».",
    porque: "Así encontrás el gasto después y sale claro en el informe.",
  },
  quien: {
    pasos: [
      "Pensá quién te tiene que devolver esta plata.",
      "Si fue para una empresa o persona, tocala. Si fue para vos, tocá «Es un gasto mío».",
    ],
    porque: "Así la app sabe a quién le corresponde el gasto.",
  },
  pago: {
    pasos: [
      "Primero contestá: ¿ya se pagó, o quedó debiendo?",
      "Si ya se pagó, contestá con qué plata se pagó.",
    ],
    ejemplo:
      "pagaste vos en efectivo: tocá «Sí, ya se pagó» y después «Con mi plata».",
    porque: "Así la app te dice cuánto te tienen que devolver.",
  },
  revisar: {
    pasos: [
      "Leé cada línea despacio.",
      "Si algo está mal, tocá «Cambiar» al lado.",
      "Si todo está bien, tocá «Guardar el gasto».",
    ],
    porque:
      "Después de guardar no se borra: si hay un error, se anula con un motivo.",
  },
};

/* ------------------------- Recibir dinero ------------------------- */

export function textoAnticipoRecibido(monto, parte, gestion) {
  return `Este anticipo de ${monto} de ${parte} se asigna a ${gestion}. El disponible se calcula con todos los movimientos de la gestión.`;
}

export const PASOS_RECIBIR = [
  { id: "quien", nombre: "Quién" },
  { id: "cuanto", nombre: "Cuánto" },
  { id: "para", nombre: "Para qué" },
  { id: "revisar", nombre: "Revisar" },
];

/**
 * Arma las aplicaciones de una recepción con las respuestas simples.
 * Todo el importe va a una sola gestión; «no sé» lo deja sin aplicar.
 */
export function aplicacionesDeRecepcion({ para, gestion_id, monto }) {
  if (para === "nose" || !para) return [];
  if (!gestion_id) throw new Error("Elegí la gestión.");
  return [
    {
      gestion_id,
      destino: para === "devolucion" ? "reembolso" : "anticipo",
      importe: centavos(monto),
    },
  ];
}

export function faltaEnRecibir(paso, d) {
  if (paso === "quien" && !d.parte_id) return "Elegí quién te dio la plata.";
  if (paso === "cuanto") {
    try {
      if (centavos(d.monto) <= 0) return "Escribí cuánto te dieron.";
    } catch {
      return "Escribí cuánto te dieron.";
    }
  }
  if (paso === "para") {
    if (!d.para) return "Elegí para qué es la plata.";
    if (d.para !== "nose" && !d.gestion_id)
      return "Elegí en qué gestión va esta plata.";
  }
  return "";
}

export const AYUDA_RECIBIR = {
  quien: {
    pasos: [
      "Tocá el nombre de la empresa o persona que te dio la plata.",
      "Si no está, tocá «No está en la lista» y escribí su nombre.",
    ],
    porque: "Así se sabe de quién es esa plata.",
  },
  cuanto: {
    pasos: [
      "Contá la plata o mirá el depósito.",
      "Escribí el número con los botones. Si te equivocás, tocá ⌫.",
    ],
    ejemplo: "te depositaron 2,650.75: tocá 2, 6, 5, 0, el punto, 7 y 5.",
    porque: "Así queda anotado cuánto entró.",
  },
  para: {
    pasos: [
      "Si te están devolviendo lo que vos pusiste de tu bolsa, tocá «Me están devolviendo».",
      "Si te la dieron para comprar cosas, tocá «Me la dieron para gastar».",
      "Después elegí en qué gestión va.",
    ],
    ejemplo:
      "pagaste C$ 1,200 de gasolina y la empresa te los devuelve: «Me están devolviendo».",
    porque:
      "La plata para gastar no es tuya: la app la guarda aparte hasta que la gastés o la devolvás.",
  },
  revisar: {
    pasos: [
      "Leé cada línea.",
      "Si algo está mal, tocá «Cambiar».",
      "Si está bien, tocá «Guardar».",
    ],
    porque: "Después de guardar no se borra; si hay un error, se anula.",
  },
};

/**
 * Guardado diferido del borrador. Al guardar el registro definitivo se
 * detiene: un guardado pendiente no puede resucitar el borrador ya
 * descartado (E-16).
 */
// Una pantalla nueva espera la operación anterior, incluso si la primera se desmontó.
let guardadoGuiadoActivo = Promise.resolve();
export function esperarGuardadoGuiado() {
  return guardadoGuiadoActivo;
}
export function ejecutarGuardadoGuiado(accion) {
  const operacion = guardadoGuiadoActivo.then(accion);
  guardadoGuiadoActivo = operacion.then(
    () => {},
    () => {},
  );
  return operacion;
}

export function crearGuardadoDiferido(guardar, espera = 400) {
  let temporizador = null;
  let detenido = false;
  let pendiente = null;
  let turno = Promise.resolve();
  const ejecutar = () => {
    if (!pendiente || detenido) return turno;
    const datos = pendiente();
    pendiente = null;
    turno = turno.catch(() => {}).then(() => guardar(datos));
    return turno;
  };
  return {
    programar(datos) {
      if (detenido) return;
      pendiente = datos;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        ejecutar().catch(() => {});
      }, espera);
    },
    detener() {
      detenido = true;
      clearTimeout(temporizador);
      temporizador = null;
      pendiente = null;
      return turno;
    },
    vaciar() {
      clearTimeout(temporizador);
      temporizador = null;
      const terminado = ejecutar();
      detenido = true;
      return terminado;
    },
    reanudar() {
      detenido = false;
    },
  };
}

/* --------------------------- Informe --------------------------- */

export const PASOS_INFORME = [
  { id: "que", nombre: "De qué" },
  { id: "para", nombre: "Para quién" },
  { id: "como", nombre: "Cómo" },
  { id: "revisar", nombre: "Revisar" },
];

/** Alcance y fecha de corte del informe según las respuestas simples. */
export function alcanceDeInforme(d, gestiones, hoy) {
  if (d.tipo === "gestiones") {
    const ids = [...new Set(d.gestion_ids || [])];
    if (ids.length < 2) throw new Error("Elegí al menos dos gestiones.");
    const elegidas = ids.map((id) => gestiones.find((g) => g.id === id));
    if (elegidas.some((g) => !g))
      throw new Error("Revisá las gestiones elegidas.");
    const corte = elegidas.reduce((fecha, g) => {
      const fin = g.fecha_fin || (hoy < g.fecha_inicio ? g.fecha_inicio : hoy);
      return fin > fecha ? fin : fecha;
    }, hoy);
    return { alcance: { tipo: "gestiones", gestion_ids: ids }, corte };
  }
  if (d.tipo === "gestion") {
    const g = gestiones.find((x) => x.id === d.gestion_id);
    if (!g) throw new Error("Elegí la gestión.");
    const corte = g.fecha_fin || (hoy < g.fecha_inicio ? g.fecha_inicio : hoy);
    return { alcance: { tipo: "gestion", gestion_id: g.id }, corte };
  }
  if (d.tipo === "parte") {
    if (!d.parte_id) throw new Error("Elegí la empresa o persona.");
    return { alcance: { tipo: "parte", parte_id: d.parte_id }, corte: hoy };
  }
  if (d.tipo === "periodo") {
    if (!d.desde || !d.hasta) throw new Error("Elegí desde y hasta qué día.");
    if (d.desde > d.hasta)
      throw new Error("La fecha «desde» tiene que ser antes que «hasta».");
    return {
      alcance: { tipo: "periodo", desde: d.desde, hasta: d.hasta },
      corte: d.hasta,
    };
  }
  throw new Error("Elegí de qué es el informe.");
}

export function faltaEnInforme(paso, d, gestiones = [], hoy = "") {
  if (paso === "que") {
    try {
      alcanceDeInforme(d, gestiones, hoy);
    } catch (e) {
      return e.message;
    }
  }
  if (paso === "para" && !d.destinatario?.trim())
    return "Escribí para quién es el informe.";
  return "";
}

export const AYUDA_INFORME = {
  que: {
    pasos: [
      "Si te pidieron cuentas de un encargo o viaje, tocá «De una gestión».",
      "Para reunir varios encargos, tocá «De varias gestiones» y elegilos.",
      "Si una empresa quiere ver solo lo suyo, tocá «De una empresa o persona».",
      "Si te pidieron lo de unos días, tocá «De unas fechas».",
    ],
    porque: "Así el informe lleva solo lo que corresponde.",
  },
  para: {
    pasos: [
      "Escribí el nombre de quien va a recibir el informe.",
      "Revisá que tu nombre esté bien escrito como responsable.",
    ],
    ejemplo: "«Empresa de ejemplo S.A.» y tu nombre completo.",
    porque: "Esos nombres salen arriba, en la primera hoja.",
  },
  como: {
    pasos: [
      "Si van a revisar las facturas, dejá «Con las fotos».",
      "Elegí el papel: Carta es el más común en Nicaragua.",
    ],
    porque: "Sin fotos el archivo pesa menos y se manda más rápido.",
  },
  revisar: {
    pasos: [
      "Mirá los totales: córdobas y dólares van por separado.",
      "Si querés verlo antes, tocá «Ver cómo queda».",
      "Si está bien, tocá «Hacer el informe».",
    ],
    porque:
      "Cada informe queda guardado tal cual. Si después cambia algo, se hace otro nuevo.",
  },
};
