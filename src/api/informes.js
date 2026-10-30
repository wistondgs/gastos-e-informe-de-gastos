import { huella, base64ABytes } from "../datos/archivos.js";
import { verificarImagen } from "../dominio/operaciones.js";
import {
  calcularSaldos,
  indexar,
  liquidacion,
  vigente,
  compraVigente,
} from "../dominio/finanzas.js";
import { fechaValida } from "../dominio/gestion.js";
import { estadoCuentas } from "../dominio/estado-cuentas.js";
import {
  claveAlcance,
  codigoInforme,
  prepararInforme,
  TIPOS_INFORME,
} from "../dominio/informe.js";
import {
  ajusteEfectivo,
  dimensiones,
  orientacionExif,
} from "../documentos/anexos.js";
import {
  informePdf,
  MOTOR_PDF,
  fechaCorta,
} from "../exportaciones/informe-pdf.js";
import { informeExcel } from "../exportaciones/informe-excel.js";
import { ErrorApi, noEncontrado, validacion, estado } from "./errores.js";
const DESCRIPCION_OBSERVACION = {
  origen_sin_detallar: "pagada al contado sin detallar el origen del dinero",
  pago_propio_sin_cargo:
    "pagada con dinero propio sin asignación: no genera reembolso",
  pago_personal: "pago propio de la parte personal",
};
/** Arma, desde los datos guardados, todo lo que va en un informe. */
async function contexto(
  repo,
  files,
  alcance,
  { corte, compras: elegidas, incluirFotos },
) {
  const datos = await repo.cargarTodo();
  const fotosPosteriores = new Set();
  for (const e of datos.eventos.filter(
    (x) => x.entidad === "compra" && x.fecha.slice(0, 10) > corte,
  )) {
    if (e.tipo === "adjuntar") {
      let ids;
      try {
        ids = JSON.parse(e.datos).fotos;
      } catch {
        throw new ErrorApi(
          "INTEGRIDAD",
          "No se puede reconstruir el historial de comprobantes.",
        );
      }
      if (!Array.isArray(ids))
        throw new ErrorApi(
          "INTEGRIDAD",
          "No se puede reconstruir el historial de comprobantes.",
        );
      for (const id of ids) fotosPosteriores.add(id);
    }
    if (e.tipo === "comprobante") {
      const anterior = JSON.parse(e.datos).estado_anterior;
      const compra = datos.compras.find((c) => c.id === e.entidad_id);
      if (compra && anterior) compra.estado = anterior;
    }
  }
  datos.fotos = datos.fotos.filter((foto) => !fotosPosteriores.has(foto.id));
  function ajusteAlCorte(fotoId) {
    let ajuste = datos.anexos.find((a) => a.foto_id === fotoId) || null;
    const eventos = datos.eventos
      .filter(
        (e) =>
          e.entidad === "anexo" &&
          e.entidad_id === fotoId &&
          e.tipo === "ajustar" &&
          e.fecha.slice(0, 10) > corte,
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (const evento of eventos) {
      try {
        ajuste = JSON.parse(evento.datos).antes;
      } catch {
        throw new ErrorApi(
          "INTEGRIDAD",
          "No se puede reconstruir un ajuste histórico.",
        );
      }
      if (!ajuste || typeof ajuste !== "object")
        throw new ErrorApi(
          "INTEGRIDAD",
          "No se puede reconstruir un ajuste histórico.",
        );
    }
    return ajuste?.actualizado?.slice(0, 10) > corte ? null : ajuste;
  }
  // Las correcciones descriptivas registran el antes: retrocederlas en orden
  // inverso permite presentar los valores que estaban vigentes al corte.
  for (const e of datos.eventos
    .filter(
      (x) =>
        x.fecha.slice(0, 10) > corte &&
        ((x.entidad === "compra" && x.tipo === "corregir") ||
          (x.entidad === "parte" && x.tipo === "editar")),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha))) {
    let antes;
    try {
      antes = JSON.parse(e.datos).antes;
    } catch {
      throw new ErrorApi(
        "INTEGRIDAD",
        "No se puede reconstruir una corrección histórica.",
      );
    }
    if (!antes || typeof antes !== "object")
      throw new ErrorApi(
        "INTEGRIDAD",
        "No se puede reconstruir una corrección histórica.",
      );
    const fila = (e.entidad === "compra" ? datos.compras : datos.partes).find(
      (x) => x.id === e.entidad_id,
    );
    if (fila) Object.assign(fila, antes);
  }
  const gestiones = new Map(datos.gestiones.map((g) => [g.id, g]));
  const partes = new Map(datos.partes.map((p) => [p.id, p]));
  const nombreParte = (id) =>
    id ? partes.get(id)?.nombre || "Parte no disponible" : "Personal";
  const exigirGestiones = (ids) => {
    if (!Array.isArray(ids) || !ids.length)
      throw validacion("Elegí al menos una gestión.", "gestion_ids");
    for (const id of ids)
      if (!gestiones.has(id))
        throw validacion("Una gestión elegida no existe.", "gestion_ids");
    return ids;
  };
  let lineas, deAlcance, gestionesAlcance;
  const vigentes = datos.compras.filter(
    (c) => compraVigente(c, corte, datos.eventos) && c.fecha_compra <= corte,
  );
  switch (alcance?.tipo) {
    case "gestion": {
      const g = gestiones.get(alcance.gestion_id);
      if (!g) throw noEncontrado("la gestión");
      if (corte < g.fecha_inicio)
        throw validacion(
          "El corte no puede ser anterior al inicio de la gestión.",
          "corte",
        );
      lineas = [
        ["Gestión", g.nombre],
        [
          "Apertura y cierre",
          `${fechaCorta(g.fecha_inicio)} — ${g.fecha_fin ? fechaCorta(g.fecha_fin) : "abierta"}`,
        ],
        ...(g.descripcion ? [["Descripción", g.descripcion]] : []),
      ];
      gestionesAlcance = [g.id];
      deAlcance = (c) => c.gestion_id === g.id;
      break;
    }
    case "gestiones": {
      exigirGestiones(alcance.gestion_ids);
      const gs = alcance.gestion_ids.map((id) => gestiones.get(id));
      lineas = [["Gestiones", gs.map((g) => g.nombre).join(", ")]];
      gestionesAlcance = alcance.gestion_ids;
      deAlcance = (c) => alcance.gestion_ids.includes(c.gestion_id);
      break;
    }
    case "periodo": {
      if (
        !fechaValida(alcance.desde) ||
        !fechaValida(alcance.hasta) ||
        alcance.desde > alcance.hasta
      )
        throw validacion("Revisá las fechas del período.", "desde");
      lineas = [
        [
          "Período",
          `${fechaCorta(alcance.desde)} — ${fechaCorta(alcance.hasta)}`,
        ],
      ];
      deAlcance = (c) =>
        c.fecha_compra >= alcance.desde && c.fecha_compra <= alcance.hasta;
      gestionesAlcance = [
        ...new Set(
          vigentes
            .filter(deAlcance)
            .map((c) => c.gestion_id)
            .filter(Boolean),
        ),
      ];
      break;
    }
    case "parte": {
      const p = partes.get(alcance.parte_id);
      if (!p) throw noEncontrado("la persona o empresa");
      if (alcance.gestion_ids?.length) exigirGestiones(alcance.gestion_ids);
      lineas = [
        ["Empresa o persona", p.nombre],
        [
          "Gestiones",
          alcance.gestion_ids?.length
            ? alcance.gestion_ids
                .map((id) => gestiones.get(id).nombre)
                .join(", ")
            : "Todas",
        ],
      ];
      const conCargo = new Set(
        datos.asignaciones
          .filter((a) => vigente(a, corte) && a.parte_id === p.id)
          .map((a) => a.compra_id),
      );
      deAlcance = (c) =>
        conCargo.has(c.id) &&
        (!alcance.gestion_ids?.length ||
          alcance.gestion_ids.includes(c.gestion_id));
      const ixParte = indexar(datos, corte);
      gestionesAlcance = [
        ...new Set(
          [
            ...vigentes.filter(deAlcance).map((c) => c.gestion_id),
            ...ixParte.aplicaciones
              .filter(
                (a) =>
                  ixParte.recepciones.get(a.recepcion_id)?.parte_id === p.id,
              )
              .map((a) => a.gestion_id),
          ].filter(
            (id) =>
              id &&
              (!alcance.gestion_ids?.length ||
                alcance.gestion_ids.includes(id)),
          ),
        ),
      ];
      break;
    }
    case "pendientes": {
      if (alcance.gestion_ids?.length) exigirGestiones(alcance.gestion_ids);
      lineas = [
        [
          "Gestiones",
          alcance.gestion_ids?.length
            ? alcance.gestion_ids
                .map((id) => gestiones.get(id).nombre)
                .join(", ")
            : "Todas",
        ],
      ];
      const conFoto = new Set(datos.fotos.map((f) => f.compra_id));
      deAlcance = (c) =>
        (c.estado === "pendiente" ||
          (c.estado === "factura" && !conFoto.has(c.id))) &&
        (!alcance.gestion_ids?.length ||
          alcance.gestion_ids.includes(c.gestion_id));
      gestionesAlcance = [
        ...new Set(
          vigentes
            .filter(deAlcance)
            .map((c) => c.gestion_id)
            .filter(Boolean),
        ),
      ];
      break;
    }
    default:
      throw validacion("Tipo de informe desconocido.", "tipo");
  }
  const repartoPosterior = datos.eventos.some(
    (e) =>
      e.entidad === "compra" &&
      e.tipo === "asignar" &&
      e.fecha.slice(0, 10) > corte &&
      vigentes.some(
        (c) =>
          c.id === e.entidad_id &&
          deAlcance(c) &&
          (!Array.isArray(elegidas) || elegidas.includes(c.id)),
      ),
  );
  if (repartoPosterior)
    throw estado(
      "No se puede reconstruir con certeza el reparto histórico para este corte; consultá una revisión emitida anteriormente.",
    );
  let elegibles = vigentes.filter(deAlcance);
  if (Array.isArray(elegidas)) {
    const ids = new Set(elegidas);
    elegibles = elegibles.filter((c) => ids.has(c.id));
  }
  const items = [];
  const ixDetalle = indexar(datos, corte);
  const { saldos, observaciones } = calcularSaldos(datos, { corte });
  for (const compra of elegibles) {
    const fotos = datos.fotos
      .filter((f) => f.compra_id === compra.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    const asig = datos.asignaciones.filter(
      (a) => vigente(a, corte) && a.compra_id === compra.id,
    );
    const item = {
      compra,
      fotos,
      gestion: gestiones.get(compra.gestion_id)?.nombre || null,
    };
    if (["gestion", "gestiones"].includes(alcance.tipo)) {
      const pagos = ixDetalle.pagos.filter((p) => p.compra_id === compra.id);
      item.pagosResumen = {
        fondo: pagos
          .filter((p) => p.origen === "fondo")
          .reduce((n, p) => n + p.importe, 0),
        propio: pagos
          .filter((p) => p.origen === "propio")
          .reduce((n, p) => n + p.importe, 0),
        tercero: pagos
          .filter((p) => p.origen === "tercero")
          .reduce((n, p) => n + p.importe, 0),
        credito: saldos
          .filter(
            (s) => s.tipo === "deuda_proveedor" && s.compra_id === compra.id,
          )
          .reduce((n, s) => n + s.importe, 0),
      };
    }
    if (alcance.tipo === "parte") {
      const propias = asig.filter((a) => a.parte_id === alcance.parte_id);
      item.asignado = propias.reduce((t, a) => t + a.importe, 0);
      item.compartida = asig.some((a) => a.parte_id !== alcance.parte_id);
      item.asignaciones = [
        { destino: nombreParte(alcance.parte_id), importe: item.asignado },
      ];
    } else
      item.asignaciones = asig.map((a) => ({
        destino: nombreParte(a.parte_id),
        importe: a.importe,
      }));
    if (incluirFotos) {
      item.ajustes = {};
      item.dims = {};
      for (const f of fotos) {
        const bytes = await files.leer(f.ruta);
        if ((await huella(bytes)) !== f.sha256)
          throw new ErrorApi(
            "INTEGRIDAD",
            "Un comprobante falta o está alterado.",
          );
        item.dims[f.id] = dimensiones(bytes, f.tipo);
        item.ajustes[f.id] = ajusteEfectivo(
          ajusteAlCorte(f.id),
          orientacionExif(bytes, f.tipo),
        );
      }
    }
    items.push(item);
  }
  // Estado financiero al corte: solo de las gestiones del alcance (y, por destinatario, solo sus saldos).
  const propios = (s) =>
    (gestionesAlcance.includes(s.gestion_id) ||
      (alcance.tipo === "parte" &&
        s.gestion_id === null &&
        !alcance.gestion_ids?.length)) &&
    (alcance.tipo !== "parte" || s.parte_id === alcance.parte_id);
  const liquidaciones = ["gestion", "gestiones"].includes(alcance.tipo)
    ? gestionesAlcance.map((id) => ({
        gestion: gestiones.get(id).nombre,
        estado: liquidacion(datos, id, { corte }).estado,
      }))
    : [];
  const lineasSaldo = saldos.filter(propios).map((s) => ({
    tipo: s.tipo,
    gestion: gestiones.get(s.gestion_id)?.nombre || null,
    parte: nombreParte(s.parte_id),
    proveedor: s.proveedor || null,
    moneda: s.moneda,
    importe: s.importe,
  }));
  const hubo =
    liquidaciones.some((l) => l.estado !== "sin_movimientos") ||
    lineasSaldo.length > 0;
  const parcial =
    Array.isArray(elegidas) &&
    elegibles.length < vigentes.filter(deAlcance).length;
  const completoGestion =
    !parcial && ["gestion", "gestiones"].includes(alcance.tipo);
  const movimientosInforme = [];
  const recepcionesInforme = [];
  if (alcance.tipo === "parte" && !parcial) {
    const ix = indexar(datos, corte);
    for (const r of ix.recepciones.values()) {
      if (r.parte_id !== alcance.parte_id) continue;
      const aplicaciones = ix.aplicaciones.filter(
        (a) => a.recepcion_id === r.id,
      );
      if (
        alcance.gestion_ids?.length &&
        !aplicaciones.some((a) => alcance.gestion_ids.includes(a.gestion_id))
      )
        continue;
      recepcionesInforme.push({
        id: r.id,
        fecha: r.fecha,
        parte: nombreParte(r.parte_id),
        moneda: r.moneda,
        total: r.importe,
        sin_aplicar:
          r.importe - aplicaciones.reduce((n, a) => n + a.importe, 0),
        referencia: r.referencia || "",
      });
    }
  }
  if (completoGestion) {
    const ix = indexar(datos, corte);
    const vistosRecepcion = new Set();
    for (const a of ix.aplicaciones) {
      if (!gestionesAlcance.includes(a.gestion_id)) continue;
      const r = ix.recepciones.get(a.recepcion_id);
      if (!r) continue;
      const eventoAplicacion = datos.eventos.find(
        (e) =>
          e.entidad === "aplicacion" &&
          e.entidad_id === a.id &&
          e.tipo === "aplicar",
      );
      movimientosInforme.push({
        fecha: eventoAplicacion?.fecha?.slice(0, 10) || null,
        tipo: a.destino === "anticipo" ? "Aplicación" : "Reembolso",
        gestion: gestiones.get(a.gestion_id)?.nombre || "",
        parte: nombreParte(r.parte_id),
        moneda: r.moneda,
        importe: a.importe,
        referencia: r.referencia || "",
        detalle: eventoAplicacion ? "" : "Fecha de aplicación no registrada",
      });
      if (vistosRecepcion.has(r.id)) continue;
      vistosRecepcion.add(r.id);
      const aplicadoTotal = ix.aplicaciones
        .filter((x) => x.recepcion_id === r.id)
        .reduce((n, x) => n + x.importe, 0);
      recepcionesInforme.push({
        id: r.id,
        fecha: r.fecha,
        parte: nombreParte(r.parte_id),
        moneda: r.moneda,
        total: r.importe,
        sin_aplicar: r.importe - aplicadoTotal,
        referencia: r.referencia || "",
      });
      if (r.finalidad || r.beneficiario_id)
        lineas.push([
          "Encargo de " + nombreParte(r.parte_id),
          `Beneficiario: ${r.beneficiario_id ? nombreParte(r.beneficiario_id) : "No indicado"}; finalidad: ${r.finalidad || "No indicada"}`,
        ]);
    }
    for (const pago of ix.pagos) {
      const compra = ix.compras.get(pago.compra_id);
      if (!compra || !gestionesAlcance.includes(compra.gestion_id)) continue;
      movimientosInforme.push({
        fecha: pago.fecha,
        tipo:
          pago.origen === "fondo"
            ? "Pago con fondo"
            : pago.origen === "propio"
              ? "Pago propio"
              : "Pago directo de tercero",
        gestion: gestiones.get(compra.gestion_id)?.nombre || "",
        parte: pago.parte_id ? nombreParte(pago.parte_id) : "Responsable",
        moneda: compra.moneda,
        importe: pago.importe,
        referencia: compra.factura || "",
        detalle: compra.concepto,
      });
    }
    for (const r of datos.regularizaciones || []) {
      if (!vigente(r, corte) || r.fecha > corte) continue;
      const pago = ix.pagos.find((p) => p.id === r.pago_id);
      const compra = pago && ix.compras.get(pago.compra_id);
      if (!compra || !gestionesAlcance.includes(compra.gestion_id)) continue;
      movimientosInforme.push({
        fecha: r.fecha,
        tipo:
          r.modalidad === "reposicion"
            ? "Reposición a custodia"
            : "Devolución directa",
        gestion: gestiones.get(compra.gestion_id)?.nombre || "",
        parte: nombreParte(pago.parte_id),
        moneda: compra.moneda,
        importe: r.importe,
        referencia: r.id,
        detalle: `Reintegro por ${nombreParte(r.pagador_id)}; pago ${pago.id}`,
      });
    }
    for (const m of ix.movimientos) {
      if (
        !gestionesAlcance.includes(m.gestion_id) &&
        !gestionesAlcance.includes(m.gestion_destino_id)
      )
        continue;
      movimientosInforme.push({
        fecha: m.fecha,
        tipo: m.tipo === "devolucion" ? "Devolución" : "Traslado",
        gestion: gestiones.get(m.gestion_id)?.nombre || "",
        parte: nombreParte(m.parte_id),
        moneda: m.moneda,
        importe: m.importe,
        referencia: m.id,
        detalle:
          m.tipo === "traslado"
            ? `Destino: ${gestiones.get(m.gestion_destino_id)?.nombre || "No disponible"}`
            : "",
      });
    }
    movimientosInforme.sort(
      (a, b) =>
        (a.fecha || "").localeCompare(b.fecha || "") ||
        a.tipo.localeCompare(b.tipo),
    );
    for (const id of gestionesAlcance) {
      const g = gestiones.get(id);
      if (g?.responsable_id)
        lineas.push([
          "Responsable de " + g.nombre,
          nombreParte(g.responsable_id),
        ]);
    }
  }
  const cuentas = completoGestion
    ? estadoCuentas(datos, null, { corte })
        .filter((c) => gestionesAlcance.includes(c.gestion_id))
        .map((c) => ({
          ...c,
          gestion: gestiones.get(c.gestion_id)?.nombre || null,
          parte: nombreParte(c.parte_id),
        }))
    : [];
  recepcionesInforme.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
  );
  const textos = [];
  if (parcial)
    textos.push(
      "Selección parcial: los saldos generales de la gestión no se atribuyen a estas compras.",
    );
  if (["periodo", "pendientes"].includes(alcance.tipo))
    textos.push(
      "El detalle es parcial; no se presentan saldos generales de gestión como si pertenecieran a estas compras.",
    );
  const enAlcance = new Set(items.map((i) => i.compra.id));
  for (const ob of observaciones) {
    if (
      ob.compra_id &&
      enAlcance.has(ob.compra_id) &&
      DESCRIPCION_OBSERVACION[ob.tipo] &&
      alcance.tipo !== "parte"
    ) {
      const c = datos.compras.find((x) => x.id === ob.compra_id);
      textos.push(
        `${c.concepto} (${c.proveedor}): ${DESCRIPCION_OBSERVACION[ob.tipo]}.`,
      );
    }
  }
  if (["gestion", "gestiones"].includes(alcance.tipo))
    for (const c of datos.compras.filter(
      (c) => c.anulada && deAlcance(c) && c.anulada.slice(0, 10) <= corte,
    )) {
      const ev = datos.eventos.find(
        (e) =>
          e.entidad === "compra" &&
          e.entidad_id === c.id &&
          e.tipo === "anular",
      );
      textos.push(
        `Compra anulada: ${c.concepto} (${c.proveedor}), motivo: ${ev?.motivo || "no indicado"}.`,
      );
    }
  return {
    alcance,
    descripcion: { titulo: TIPOS_INFORME[alcance.tipo].nombre, lineas },
    items,
    financieroLimitado:
      parcial || ["periodo", "pendientes"].includes(alcance.tipo),
    financiero:
      !parcial &&
      !["periodo", "pendientes"].includes(alcance.tipo) &&
      (hubo || cuentas.length || recepcionesInforme.length)
        ? {
            saldos: lineasSaldo,
            liquidaciones,
            cuentas,
            movimientos: movimientosInforme,
            recepciones: recepcionesInforme,
          }
        : null,
    observaciones: textos,
  };
}
const sinDatos = ({ datos, ...r }) => r;
export function servicioInformes({
  repo,
  files,
  informesPrivados,
  informesCompartidos,
  reloj,
  uuid,
}) {
  async function armar(alcance, opciones, revision) {
    const o = {
      incluirFotos: true,
      incluirCompartidos: false,
      responsable: "",
      destinatario: "",
      ...opciones,
    };
    if (!fechaValida(o.corte))
      throw validacion("Fecha de corte inválida.", "corte");
    if (o.logotipo) {
      const coincidencia =
        /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          o.logotipo,
        );
      if (!coincidencia || o.logotipo.length > 1400000)
        throw validacion(
          "Elegí un logotipo PNG o JPEG de hasta 1 MB.",
          "logotipo",
        );
      verificarImagen(base64ABytes(coincidencia[2]), coincidencia[1]);
    }
    if (o.destinatario_id) {
      const persona = await repo.una("partes", o.destinatario_id);
      if (!persona)
        throw validacion(
          "El destinatario seleccionado no existe.",
          "destinatario_id",
        );
      o.destinatario = persona.nombre;
    }
    const ctx = await contexto(repo, files, alcance, o);
    if (!o.responsable.trim() && alcance.tipo === "gestion") {
      const indice = ctx.descripcion.lineas.findIndex(([etiqueta]) =>
        etiqueta.startsWith("Responsable de "),
      );
      if (indice >= 0)
        o.responsable = ctx.descripcion.lineas.splice(indice, 1)[0][1];
    }
    const generado = reloj().toISOString();
    const modelo = prepararInforme(ctx, {
      titulo: o.titulo,
      responsable: o.responsable,
      destinatario: o.destinatario,
      destinatario_id: o.destinatario_id || null,
      corte: o.corte,
      papel: o.papel,
      estilo: o.estilo,
      incluirFotos: !!o.incluirFotos,
      incluirCompartidos: !!o.incluirCompartidos,
      logotipo: o.logotipo || null,
      revision,
      generado,
      generado_local: new Intl.DateTimeFormat("es-NI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(generado)),
      codigo: codigoInforme(alcance, revision),
    });
    return { modelo, bytes: await informePdf(modelo, files) };
  }
  async function registro(id) {
    const r = await repo.una("informes", id);
    if (!r) throw noEncontrado("el informe");
    return r;
  }
  async function estadoArchivo(almacen, nombre, sha) {
    if (!nombre) return "ausente";
    try {
      return (await huella(await almacen.leer(nombre))) === sha
        ? "verificado"
        : "alterado";
    } catch {
      return "ausente";
    }
  }
  async function regenerar(r) {
    if (r.motor !== MOTOR_PDF)
      throw estado(
        "La revisión se emitió con otra versión del motor de PDF: su copia privada es la referencia.",
      );
    const modelo = JSON.parse(r.datos);
    // Las rutas cambian al restaurar un respaldo: cada foto se busca por su id y su huella.
    const fotos = new Map((await repo.todas("fotos")).map((f) => [f.id, f]));
    for (const anexo of modelo.anexos) {
      const actual = fotos.get(anexo.foto.id);
      if (!actual || actual.sha256 !== anexo.foto.sha256)
        throw new ErrorApi(
          "INTEGRIDAD",
          "Falta un comprobante de esta revisión.",
        );
      anexo.foto = { ...anexo.foto, ruta: actual.ruta };
    }
    const bytes = await informePdf(modelo, files);
    if ((await huella(bytes)) !== r.sha256)
      throw new ErrorApi(
        "INTEGRIDAD",
        "La copia regenerada no coincide con la revisión emitida.",
      );
    return bytes;
  }
  const servicio = {
    /** Genera el PDF sin registrarlo: para la vista previa. */
    async previsualizar({ alcance, opciones }) {
      const revision = await repo.siguienteRevision(claveAlcance(alcance));
      const { modelo, bytes } = await armar(alcance, opciones, revision);
      return {
        codigo: modelo.codigo,
        revision,
        totales: modelo.totales,
        filas: modelo.filas.length,
        anexos: modelo.anexos.length,
        financiero: modelo.financiero,
        financieroLimitado: modelo.financieroLimitado,
        bytes,
      };
    },
    /**
     * Emite una revisión nueva e inmutable: copia privada verificada, registro
     * con huella y, si se pide, copia en la carpeta compartida.
     */
    async emitir({ alcance, opciones, exportar = true }) {
      const clave = claveAlcance(alcance);
      const revision = await repo.siguienteRevision(clave);
      const { modelo, bytes } = await armar(alcance, opciones, revision);
      const id = uuid(),
        sha256 = await huella(bytes);
      const privado = await informesPrivados.guardar(`${id}.pdf`, bytes);
      let archivo = null;
      try {
        if (exportar) {
          const nombre = (await informesCompartidos.existe(
            `${modelo.codigo}.pdf`,
          ))
            ? `${modelo.codigo}-${id.slice(0, 8)}.pdf`
            : `${modelo.codigo}.pdf`;
          archivo = await informesCompartidos.guardar(nombre, bytes);
        }
        const fila = {
          id,
          clave,
          alcance: JSON.stringify(alcance),
          gestion_id: alcance.tipo === "gestion" ? alcance.gestion_id : null,
          revision,
          codigo: modelo.codigo,
          fecha_corte: modelo.opciones.corte,
          generado: modelo.opciones.generado,
          papel: modelo.opciones.papel,
          estilo: modelo.opciones.estilo,
          con_fotos: modelo.opciones.incluirFotos ? 1 : 0,
          motor: MOTOR_PDF,
          datos: JSON.stringify(modelo),
          sha256,
          archivo,
          privado,
        };
        await repo.registrarInforme(fila);
        return { informe: sinDatos(fila), bytes };
      } catch (e) {
        await informesPrivados.borrar(privado).catch(() => {});
        if (archivo) await informesCompartidos.borrar(archivo).catch(() => {});
        throw new ErrorApi(
          e.codigo || "VALIDACION",
          `No se registró la revisión: ${e.message}`,
        );
      }
    },
    /** Las revisiones emitidas, con el estado de sus archivos; sin el modelo completo. */
    async listar({ clave = null, gestion_id = null } = {}) {
      const todas = (await repo.informes(clave)).filter(
        (r) => !gestion_id || r.gestion_id === gestion_id,
      );
      const r = [];
      for (const i of todas)
        r.push({
          ...sinDatos(i),
          alcance: JSON.parse(i.alcance),
          privado_estado: await estadoArchivo(
            informesPrivados,
            i.privado,
            i.sha256,
          ),
          compartido_estado: await estadoArchivo(
            informesCompartidos,
            i.archivo,
            i.sha256,
          ),
        });
      return r;
    },
    /** PDF entregable: la copia privada verificada, la compartida o una regenerada idéntica. */
    async abrir(id) {
      const r = await registro(id);
      for (const [almacen, nombre, origen] of [
        [informesPrivados, r.privado, "privado"],
        [informesCompartidos, r.archivo, "compartido"],
      ])
        if ((await estadoArchivo(almacen, nombre, r.sha256)) === "verificado")
          return {
            bytes: await almacen.leer(nombre),
            origen,
            nombre: `${r.codigo}.pdf`,
          };
      return {
        bytes: await regenerar(r),
        origen: "regenerado",
        nombre: `${r.codigo}.pdf`,
      };
    },
    async regenerar(id) {
      return { bytes: await regenerar(await registro(id)) };
    },
    /** Copia una revisión a la carpeta compartida (Documentos). */
    async exportar(id) {
      const r = await registro(id);
      const { bytes } = await servicio.abrir(id);
      if (
        r.archivo &&
        (await estadoArchivo(informesCompartidos, r.archivo, r.sha256)) ===
          "verificado"
      )
        return { archivo: r.archivo, nuevo: false };
      const nombre = (await informesCompartidos.existe(`${r.codigo}.pdf`))
        ? `${r.codigo}-${r.id.slice(0, 8)}.pdf`
        : `${r.codigo}.pdf`;
      await informesCompartidos.guardar(nombre, bytes);
      await repo.aplicar({
        cambios: [{ tabla: "informes", id, campos: { archivo: nombre } }],
      });
      return { archivo: nombre, nuevo: true };
    },
    /** El Excel de la misma revisión, desde su modelo guardado. */
    async excel(id) {
      const r = await registro(id);
      if (![3, 4, 5, 6, 7, 8, 9, MOTOR_PDF].includes(r.motor))
        throw estado(
          "La revisión se emitió con otra versión: no tiene modelo para Excel.",
        );
      const modelo = JSON.parse(r.datos);
      if (
        r.motor < 9 &&
        modelo.tipo === "parte" &&
        modelo.filas.some((f) => f.compartida)
      )
        throw estado(
          "Esta revisión anterior puede revelar importes de otras partes. Emití una nueva revisión para exportar Excel con privacidad.",
        );
      return {
        bytes: await informeExcel(modelo),
        nombre: `${r.codigo}.xlsx`,
      };
    },
    /** Los PDF de la carpeta compartida que no corresponden a ninguna revisión registrada. */
    async sinRegistro() {
      const conocidos = new Set((await repo.informes()).map((r) => r.archivo));
      return (await informesCompartidos.listar()).filter(
        (n) => !conocidos.has(n),
      );
    },
  };
  return servicio;
}
