import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  concatTransformationMatrix,
  drawObject,
} from "pdf-lib";
import { huella, base64ABytes } from "../datos/archivos.js";
import { dinero } from "../dominio/compra.js";
import { PAPELES, TIPOS_INFORME, anexoTexto } from "../dominio/informe.js";
import {
  ajusteEfectivo,
  dimensiones,
  geometria,
  orientacionExif,
  planificarAnexos,
} from "../documentos/anexos.js";
/** Versión del motor: con el mismo motor y el mismo modelo, los mismos bytes. */
export const MOTOR_PDF = 10;
const NOMBRE_MONEDA = { NIO: "Córdobas", USD: "Dólares" };
const ESTADO_SOPORTE = {
  presente: "Presentes",
  ausente: "Ausentes",
  pendiente: "Pendientes",
  sin_factura: "Sin factura",
};
export const ESTADO_LIQUIDACION = {
  sin_movimientos: "sin movimientos de dinero",
  pendiente: "pendiente",
  parcial: "parcial",
  liquidada: "liquidada",
};
const TEMAS = {
  ejecutivo: {
    tinta: rgb(0.06, 0.13, 0.1),
    suave: rgb(0.3, 0.36, 0.33),
    acento: rgb(0.12, 0.32, 0.22),
    fondo: rgb(0.92, 0.96, 0.94),
    linea: rgb(0.79, 0.86, 0.82),
    cuerpo: 8.6,
  },
  formal: {
    tinta: rgb(0, 0, 0),
    suave: rgb(0.3, 0.3, 0.3),
    acento: rgb(0, 0, 0),
    fondo: null,
    linea: rgb(0.45, 0.45, 0.45),
    cuerpo: 8.2,
  },
};
export const fechaCorta = (iso) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
const emision = (iso) => {
  const d = new Date(iso);
  const dos = (n) => String(n).padStart(2, "0");
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())} UTC`;
};
/** Texto de una línea del estado financiero, sin términos contables. */
export function textoSaldo(s) {
  switch (s.tipo) {
    case "custodia":
      return `Fondos de ${s.parte} en custodia`;
    case "por_reembolsar":
      return `Por reembolsar al responsable, a cargo de ${s.parte}`;
    case "por_regularizar":
      return `Por regularizar con ${s.parte}: sus fondos pagaron un gasto personal`;
    case "deuda_proveedor":
      return `Pendiente de pago a ${s.proveedor}, deudor ${s.parte}`;
    default:
      return s.tipo;
  }
}
/** Helvetica estándar solo dibuja WinAnsi: lo demás se reemplaza, no rompe el PDF. */
function limpiador(font) {
  const permitidos = new Set(font.getCharacterSet());
  return (texto) =>
    [...String(texto ?? "").replace(/\s+/g, " ")]
      .map((c) => (permitidos.has(c.codePointAt(0)) ? c : "?"))
      .join("");
}
function partir(texto, font, size, ancho) {
  const lineas = [];
  let linea = "";
  for (const palabra0 of texto.split(" ")) {
    let palabra = palabra0;
    while (palabra && font.widthOfTextAtSize(palabra, size) > ancho) {
      let i = 1;
      while (
        i < palabra.length &&
        font.widthOfTextAtSize(palabra.slice(0, i + 1), size) <= ancho
      )
        i++;
      if (linea) lineas.push(linea);
      linea = "";
      lineas.push(palabra.slice(0, i));
      palabra = palabra.slice(i);
    }
    const siguiente = linea ? `${linea} ${palabra}` : palabra;
    if (linea && font.widthOfTextAtSize(siguiente, size) > ancho) {
      lineas.push(linea);
      linea = palabra;
    } else linea = siguiente;
  }
  if (linea || !lineas.length) lineas.push(linea);
  return lineas;
}
async function imagenVerificada(foto, files) {
  const bytes = await files.leer(foto.ruta);
  if ((await huella(bytes)) !== foto.sha256)
    throw new Error("Un comprobante falta o está alterado.");
  return bytes;
}
/**
 * El PDF de una revisión. Con el mismo modelo, el mismo motor y la misma
 * fecha de emisión produce los mismos bytes: una revisión entregada se
 * puede verificar y regenerar.
 */
export async function informePdf(modelo, files) {
  const o = modelo.opciones,
    tema = TEMAS[o.estilo],
    formal = o.estilo === "formal";
  const [W, H] = PAPELES[o.papel],
    M = 42,
    ancho = W - 2 * M,
    pie = 46;
  const doc = await PDFDocument.create();
  const fecha = new Date(o.generado);
  doc.setTitle(`${o.titulo} · ${modelo.codigo}`);
  doc.setSubject(TIPOS_INFORME[modelo.tipo].nombre);
  doc.setProducer("Gastos e Informe de Gastos");
  doc.setCreator("Gastos e Informe de Gastos");
  doc.setCreationDate(fecha);
  doc.setModificationDate(fecha);
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const limpio = limpiador(regular);
  let page, y;
  const nueva = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const texto = (
    t,
    x,
    yy,
    { font = regular, size = tema.cuerpo, color = tema.tinta } = {},
  ) => page.drawText(limpio(t), { x, y: yy, size, font, color });
  const derecha = (t, xDer, yy, opts = {}) => {
    const font = opts.font || regular,
      size = opts.size || tema.cuerpo;
    texto(t, xDer - font.widthOfTextAtSize(limpio(t), size), yy, opts);
  };
  const raya = (yy, grosor = 0.6, color = tema.linea) =>
    page.drawLine({
      start: { x: M, y: yy },
      end: { x: W - M, y: yy },
      thickness: grosor,
      color,
    });
  const espacio = (alto) => {
    if (y - alto < pie) {
      nueva();
      return true;
    }
    return false;
  };
  const titulo = (t) => {
    espacio(40);
    y -= 6;
    texto(t.toUpperCase(), M, y, {
      font: negrita,
      size: 9,
      color: tema.acento,
    });
    y -= 6;
    raya(y, formal ? 0.8 : 1.2, tema.acento);
    y -= 14;
  };
  const parrafo = (
    t,
    { size = 7.4, color = tema.suave, font = regular } = {},
  ) => {
    for (const l of partir(limpio(t), font, size, ancho)) {
      espacio(11);
      texto(l, M, y, { size, color, font });
      y -= size + 2.6;
    }
  };
  const subtitulo = TIPOS_INFORME[modelo.tipo].nombre.toUpperCase();

  // Encabezado
  nueva();
  const logo = o.logotipo
    ? await (o.logotipo.startsWith("data:image/png;")
        ? doc.embedPng(base64ABytes(o.logotipo.split(",")[1]))
        : doc.embedJpg(base64ABytes(o.logotipo.split(",")[1])))
    : null;
  if (formal) {
    texto(o.titulo, M, y - 14, { font: negrita, size: 16 });
    derecha(modelo.codigo, W - M, y - 14, { font: negrita, size: 10 });
    y -= 30;
    texto(subtitulo, M, y, { size: 9, color: tema.suave });
    y -= 10;
    raya(y, 1.4, tema.tinta);
    y -= 18;
  } else {
    const alto = 78;
    page.drawRectangle({
      x: 0,
      y: H - alto,
      width: W,
      height: alto,
      color: tema.acento,
    });
    const blanco = rgb(1, 1, 1);
    texto(subtitulo, M, H - 28, {
      font: negrita,
      size: 8,
      color: rgb(0.7, 0.78, 0.9),
    });
    for (const [i, l] of partir(limpio(o.titulo), negrita, 18, ancho - 150)
      .slice(0, 2)
      .entries())
      texto(l, M, H - 50 - i * 20, { font: negrita, size: 18, color: blanco });
    derecha(modelo.codigo, W - M, H - 28, {
      font: negrita,
      size: 9,
      color: blanco,
    });
    derecha(`Revisión ${o.revision}`, W - M - (logo ? 54 : 0), H - 41, {
      size: 8,
      color: rgb(0.8, 0.85, 0.93),
    });
    y = H - alto - 22;
  }
  if (logo) {
    const proporcion = Math.min(42 / logo.width, 32 / logo.height);
    const baseLogo = formal ? y - 35 : H - 74;
    page.drawRectangle({
      x: W - M - 48,
      y: baseLogo,
      width: 48,
      height: 35,
      color: rgb(1, 1, 1),
    });
    page.drawImage(logo, {
      x: W - M - 45,
      y: baseLogo + 2,
      width: logo.width * proporcion,
      height: logo.height * proporcion,
    });
    if (formal) y -= 42;
  }

  // Datos del alcance, en dos columnas
  const datos = [
    ...modelo.descripcion.lineas,
    ["Responsable", o.responsable || "No indicado"],
    ["Destinatario", o.destinatario || "No indicado"],
    ["Identificador", `${modelo.codigo} · revisión ${o.revision}`],
    ["Corte del informe", fechaCorta(o.corte)],
    ["Emitido", o.generado_local || emision(o.generado)],
  ];
  const col = ancho / 2;
  for (let i = 0; i < datos.length; i += 2) {
    let alto = 0;
    for (const [j, [k, v]] of datos.slice(i, i + 2).entries()) {
      const x = M + j * col;
      texto(k, x, y, { size: 7, color: tema.suave });
      const lineas = partir(limpio(v), negrita, 9.5, col - 12).slice(0, 2);
      lineas.forEach((l, n) =>
        texto(l, x, y - 12 - n * 11, { font: negrita, size: 9.5 }),
      );
      alto = Math.max(alto, 12 + lineas.length * 11);
    }
    y -= alto + 8;
  }

  // Totales por moneda: nunca se suman entre sí
  y -= 4;
  const cajas = modelo.monedas.length ? modelo.monedas : ["NIO"];
  const cajaW = (ancho - 12 * (cajas.length - 1)) / cajas.length,
    cajaH = 50;
  cajas.forEach((m, i) => {
    const x = M + i * (cajaW + 12),
      t = modelo.totales[m];
    if (tema.fondo)
      page.drawRectangle({
        x,
        y: y - cajaH,
        width: cajaW,
        height: cajaH,
        color: tema.fondo,
      });
    else
      page.drawRectangle({
        x,
        y: y - cajaH,
        width: cajaW,
        height: cajaH,
        borderColor: tema.linea,
        borderWidth: 0.8,
      });
    texto(
      `${modelo.tipo === "parte" ? "ASIGNADO" : "TOTAL"} ${NOMBRE_MONEDA[m].toUpperCase()}`,
      x + 10,
      y - 14,
      { font: negrita, size: 7, color: tema.suave },
    );
    texto(dinero(t.importe, m), x + 10, y - 33, {
      font: negrita,
      size: 15,
      color: tema.acento,
    });
    derecha(
      `${t.cantidad} ${t.cantidad === 1 ? "compra" : "compras"}`,
      x + cajaW - 10,
      y - 14,
      { size: 7, color: tema.suave },
    );
  });
  y -= cajaH + 10;
  const fin = modelo.financiero;
  const liquidaciones = fin?.liquidaciones || [];
  parrafo(
    (liquidaciones.length
      ? `Liquidación del dinero al corte: ${liquidaciones.map((l) => `${l.gestion}, ${ESTADO_LIQUIDACION[l.estado]}`).join("; ")}. `
      : fin
        ? "Saldos de dinero al corte: ver el estado financiero. "
        : modelo.financieroLimitado
          ? "Saldos generales no incluidos por el alcance parcial de este informe. "
          : "Liquidación del dinero: sin movimientos de dinero registrados. ") +
      "El cierre de una gestión no equivale a su liquidación, y emitir este informe no equivale a aprobación ni a pago. " +
      "Córdobas y dólares se totalizan por separado, sin conversión." +
      (modelo.tipo === "parte"
        ? " Los importes son la parte asignada a este destinatario; los registros de otros destinos y los personales no se incluyen."
        : ""),
  );

  if (fin?.recepciones?.length) {
    titulo("Dinero recibido");
    parrafo(
      "Las entregas pueden incluir importes aplicados a otras gestiones.",
    );
    for (const r of fin.recepciones)
      parrafo(
        `${fechaCorta(r.fecha)} · ${r.parte} · recibido ${dinero(r.total, r.moneda)} · sin aplicar ${dinero(r.sin_aplicar, r.moneda)}${r.referencia ? ` · Ref. ${r.referencia}` : ""}`,
      );
  } else if (
    ["gestion", "gestiones"].includes(modelo.tipo) &&
    !modelo.financieroLimitado
  ) {
    titulo("Dinero recibido");
    parrafo("No hay entregas de dinero registradas para este alcance.");
  }

  // Tabla de compras
  titulo("Detalle de compras");
  const fijas = { n: 20, fecha: 50, doc: 58, importe: 74, soporte: 70 };
  const libre = ancho - Object.values(fijas).reduce((a, b) => a + b, 0);
  const columnas = [
    ["N.°", fijas.n, "n"],
    ["Fecha", fijas.fecha, "fecha"],
    ["Proveedor", libre * 0.4, "proveedor"],
    ["Documento", fijas.doc, "doc"],
    ["Concepto", libre * 0.6, "concepto"],
    [
      modelo.tipo === "parte" ? "Asignado" : "Importe",
      fijas.importe,
      "importe",
    ],
    ["Soporte", fijas.soporte, "soporte"],
  ];
  const size = tema.cuerpo,
    interlinea = size + 2.6,
    pad = 4;
  const cabecera = () => {
    const alto = 16;
    if (tema.fondo)
      page.drawRectangle({
        x: M,
        y: y - alto,
        width: ancho,
        height: alto,
        color: tema.acento,
      });
    let x = M;
    for (const [nombre, w, clave] of columnas) {
      const color = tema.fondo ? rgb(1, 1, 1) : tema.tinta;
      if (clave === "importe")
        derecha(nombre, x + w - pad, y - 11, {
          font: negrita,
          size: 7.4,
          color,
        });
      else texto(nombre, x + pad, y - 11, { font: negrita, size: 7.4, color });
      x += w;
    }
    y -= alto;
    if (!tema.fondo) raya(y, 0.9, tema.tinta);
  };
  const multiples = ["gestiones", "periodo", "parte", "pendientes"].includes(
    modelo.tipo,
  );
  if (!modelo.filas.length) {
    texto("No hay compras incluidas en este informe.", M, y - 4);
    y -= 18;
  } else cabecera();
  for (const [i, fila] of modelo.filas.entries()) {
    const c = fila.compra;
    const concepto = partir(
      limpio(c.concepto),
      regular,
      size,
      libre * 0.6 - 2 * pad,
    );
    const secundarias = multiples
      ? partir(
          limpio(fila.gestion ? `Gestión: ${fila.gestion}` : "Sin gestión"),
          regular,
          size - 1,
          libre * 0.6 - 2 * pad,
        )
      : [];
    const importe = [dinero(fila.importe, c.moneda)];
    if (
      modelo.tipo !== "parte" &&
      fila.asignado != null &&
      fila.asignado !== c.importe
    )
      importe.push(`de ${dinero(c.importe, c.moneda)}`);
    const celdas = {
      n: [String(fila.numero)],
      fecha: [fechaCorta(c.fecha_compra)],
      proveedor: partir(
        limpio(c.proveedor),
        regular,
        size,
        libre * 0.4 - 2 * pad,
      ),
      doc: partir(
        limpio(c.factura || "No registrado"),
        regular,
        size,
        fijas.doc - 2 * pad,
      ),
      concepto: [...concepto, ...secundarias],
      importe,
      soporte: partir(
        limpio(fila.soporte.texto),
        regular,
        size,
        fijas.soporte - 2 * pad,
      ),
    };
    const alto =
      Math.max(...Object.values(celdas).map((l) => l.length)) * interlinea +
      2 * pad;
    if (espacio(alto + 4)) cabecera();
    if (tema.fondo && i % 2 === 1)
      page.drawRectangle({
        x: M,
        y: y - alto,
        width: ancho,
        height: alto,
        color: tema.fondo,
      });
    let x = M;
    for (const [, w, clave] of columnas) {
      celdas[clave].forEach((l, n) => {
        const yy = y - pad - size - n * interlinea + 1;
        const secundaria =
          (clave === "importe" && n > 0) ||
          (clave === "concepto" && n >= concepto.length);
        const opts = {
          font: clave === "importe" && n === 0 ? negrita : regular,
          size: secundaria ? size - 1 : size,
          color:
            clave === "soporte" && fila.soporte.estado === "ausente"
              ? rgb(0.62, 0.1, 0.1)
              : secundaria
                ? tema.suave
                : tema.tinta,
        };
        if (clave === "importe") derecha(l, x + w - pad, yy, opts);
        else texto(l, x + pad, yy, opts);
      });
      x += w;
    }
    y -= alto;
    raya(y, 0.4);
  }
  // Totales conciliados al pie de la tabla
  for (const m of modelo.monedas) {
    espacio(18);
    y -= 14;
    const t = modelo.totales[m];
    derecha(
      `Total ${NOMBRE_MONEDA[m].toLowerCase()} (${t.cantidad})`,
      M + ancho - fijas.soporte - fijas.importe - pad,
      y,
      { font: negrita, size },
    );
    derecha(dinero(t.importe, m), M + ancho - fijas.soporte - pad, y, {
      font: negrita,
      size,
    });
  }
  y -= 18;

  // Estado financiero al corte, derivado de los movimientos
  if (fin) {
    if (fin.cuentas?.length) {
      titulo("Conciliación económica al corte");
      const campos = [
        ["recibido", "Fondos aplicados"],
        ["usado_fondo", "Pagado con fondos"],
        ["aportado_propio", "Aporte propio"],
        ["por_reembolsar", "Por reembolsar"],
        ["reembolsado", "Reembolso recibido"],
        ["devuelto", "Devuelto"],
        ["traslado_entrada", "Traslado recibido"],
        ["traslado_salida", "Traslado enviado"],
        ["custodia", "En custodia"],
        ["deuda_proveedor", "Deuda a proveedor"],
        ["por_regularizar", "Por regularizar"],
        ["regularizacion_original", "Obligación original por regularizar"],
        ["regularizacion_repuesta", "Repuesto a custodia"],
        ["regularizacion_directa", "Devuelto directamente"],
      ];
      for (const c of fin.cuentas) {
        parrafo(`${c.gestion || "Sin gestión"} · ${c.parte} · ${c.moneda}`);
        for (const [clave, etiqueta] of campos)
          if (
            c[clave] ||
            (clave === "por_regularizar" && c.regularizacion_original) ||
            (clave === "custodia" && (c.recibido || c.usado_fondo))
          ) {
            espacio(16);
            texto(etiqueta, M, y, { size });
            derecha(dinero(c[clave], c.moneda), M + ancho, y, {
              font: negrita,
              size,
            });
            y -= 14;
          }
      }
    }
    if (!fin.cuentas?.length) titulo("Conciliación económica al corte");
    if (!fin.saldos.length) {
      texto("Sin saldos pendientes: lo registrado está liquidado.", M, y);
      y -= 14;
    }
    for (const s of fin.saldos.filter(
      (s) => !fin.cuentas?.length || s.tipo === "deuda_proveedor",
    )) {
      const etiqueta = partir(
        limpio(textoSaldo(s)),
        regular,
        size,
        ancho - 200,
      );
      espacio(etiqueta.length * interlinea + 8);
      etiqueta.forEach((l, n) => texto(l, M, y - n * interlinea, { size }));
      texto(
        partir(limpio(s.gestion || "Sin gestión"), regular, size, 110)[0],
        M + ancho - 190,
        y,
        { size, color: tema.suave },
      );
      derecha(dinero(s.importe, s.moneda), M + ancho, y, {
        font: negrita,
        size,
      });
      // La raya va debajo del último renglón, nunca sobre la fila siguiente.
      const base = y - (etiqueta.length - 1) * interlinea - 4;
      raya(base, 0.3);
      y = base - size - 4;
    }
    y -= 6;
    y -= 4;
  }

  const movimientosAdicionales = (fin?.movimientos || []).filter(
    (m) =>
      !["Pago con fondo", "Pago propio", "Pago directo de tercero"].includes(
        m.tipo,
      ),
  );
  if (movimientosAdicionales.length) {
    espacio(Math.min(160, 45 + movimientosAdicionales.length * 11));
    titulo("Otros movimientos de dinero");
    for (const m of movimientosAdicionales)
      parrafo(
        `${m.fecha ? fechaCorta(m.fecha) : "Fecha no registrada"} · ${m.tipo} · ${m.gestion} · ${m.parte} · ${dinero(m.importe, m.moneda)}${m.referencia ? ` · Ref. ${m.referencia}` : ""}${m.detalle && m.fecha ? ` · ${m.detalle}` : ""}`,
      );
  }
  // Relación de comprobantes
  titulo("Relación de comprobantes");
  const conteo = {};
  for (const f of modelo.filas)
    conteo[f.soporte.estado] = (conteo[f.soporte.estado] || 0) + 1;
  const resumen = Object.keys(ESTADO_SOPORTE)
    .filter((k) => conteo[k])
    .map((k) => `${ESTADO_SOPORTE[k]}: ${conteo[k]}`)
    .join(" · ");
  parrafo(
    resumen
      ? `Compras con comprobante: ${conteo.presente || 0}${Object.entries(
          ESTADO_SOPORTE,
        )
          .filter(([k]) => k !== "presente" && conteo[k])
          .map(([k, v]) => ` · ${v}: ${conteo[k]}`)
          .join("")}`
      : "Sin compras.",
    { font: negrita, color: tema.tinta },
  );
  y -= 4;
  for (const f of modelo.filas.filter((f) => f.soporte.estado !== "presente")) {
    espacio(14);
    texto(
      `Compra ${f.numero} · ${f.compra.proveedor} · ${f.soporte.texto}`,
      M + 8,
      y,
    );
    y -= interlinea + 1;
  }
  if (modelo.anexos.length) {
    espacio(14);
    texto(
      `Los comprobantes se adjuntan como anexos ${anexoTexto(1)} a ${anexoTexto(modelo.anexos.length)}, en el orden de la tabla.`,
      M,
      y,
      { color: tema.suave },
    );
    y -= 14;
  } else if (!o.incluirFotos && modelo.filas.some((f) => f.cantidadFotos)) {
    espacio(14);
    texto("Esta revisión se emitió sin anexos fotográficos.", M, y, {
      color: tema.suave,
    });
    y -= 14;
  }

  // Observaciones
  if (modelo.observaciones.length) {
    titulo("Observaciones");
    for (const t of modelo.observaciones)
      parrafo(`· ${t}`, { size, color: tema.tinta });
    y -= 6;
  }

  // Revisión y conformidad (modo formal)
  if (formal) {
    titulo("Revisión y conformidad");
    espacio(70);
    const firmas = ["Elaborado por", "Revisado por", "Fecha de revisión"];
    const fw = (ancho - 24) / 3;
    firmas.forEach((k, i) => {
      const x = M + i * (fw + 12);
      page.drawLine({
        start: { x, y: y - 36 },
        end: { x: x + fw, y: y - 36 },
        thickness: 0.6,
        color: tema.tinta,
      });
      texto(k, x, y - 48, { size: 7.4, color: tema.suave });
    });
    y -= 74;
    texto("Observaciones:", M, y, { size: 7.4, color: tema.suave });
    raya(y - 14);
    raya(y - 30);
    y -= 40;
  }

  // Anexos: según su tamaño, dos por página, una entera o en tramos
  const preparados = [];
  for (const anexo of modelo.anexos) {
    const bytes = await imagenVerificada(anexo.foto, files);
    const dims = anexo.dims || dimensiones(bytes, anexo.foto.tipo);
    const ajuste =
      anexo.ajuste ||
      ajusteEfectivo(null, orientacionExif(bytes, anexo.foto.tipo));
    preparados.push({ ...anexo, bytes, dims, ajuste });
  }
  const area = H - M - pie;
  const incrustadas = new Map();
  for (const colocaciones of planificarAnexos(preparados, {
    ancho,
    alto: area,
  })) {
    nueva();
    for (const { anexo, caja, cabeceraY, tramo } of colocaciones) {
      const c = anexo.compra;
      const top = pie + cabeceraY;
      texto(
        `ANEXO ${String(anexo.numero).padStart(2, "0")}${tramo ? ` · PARTE ${tramo.parte} DE ${tramo.de}` : ""}`,
        M,
        top - 10,
        { font: negrita, size: 8, color: tema.suave },
      );
      texto(anexo.titulo, M, top - 25, { font: negrita, size: 12 });
      const importeAnexo =
        modelo.tipo === "parte"
          ? modelo.filas.find((f) => f.numero === anexo.fila)?.importe
          : c.importe;
      derecha(dinero(importeAnexo ?? 0, c.moneda), W - M, top - 25, {
        font: negrita,
        size: 12,
        color: tema.acento,
      });
      texto(
        `Compra ${anexo.fila} · ${fechaCorta(c.fecha_compra)} · ${c.proveedor} · ${c.concepto}`.slice(
          0,
          150,
        ),
        M,
        top - 37,
        { size: 7.6, color: tema.suave },
      );
      raya(top - 43);
      let img = incrustadas.get(anexo.foto.id);
      if (!img) {
        img =
          anexo.foto.tipo === "image/png"
            ? await doc.embedPng(anexo.bytes)
            : await doc.embedJpg(anexo.bytes);
        incrustadas.set(anexo.foto.id, img);
      }
      const g = geometria(
        anexo.dims,
        anexo.ajuste,
        { ...caja, x: M + caja.x, y: pie + caja.y },
        tramo,
      );
      const nombre = page.node.newXObject("Image", img.ref);
      page.pushOperators(
        pushGraphicsState(),
        rectangle(g.visible.x, g.visible.y, g.visible.w, g.visible.h),
        clip(),
        endPath(),
        concatTransformationMatrix(...g.matriz),
        drawObject(nombre),
        popGraphicsState(),
      );
    }
  }

  // Pie en cada página
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    page = p;
    raya(pie - 14, 0.5);
    texto(
      `${modelo.codigo} · Revisión ${o.revision} · Corte ${fechaCorta(o.corte)}`,
      M,
      pie - 26,
      { size: 7, color: tema.suave },
    );
    derecha(`Página ${i + 1} de ${paginas.length}`, W - M, pie - 26, {
      size: 7,
      color: tema.suave,
    });
  });
  return new Uint8Array(await doc.save());
}
