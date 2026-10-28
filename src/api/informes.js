import { huella } from "../datos/archivos.js";
import { calcularSaldos, liquidacion } from "../dominio/finanzas.js";
import { fechaValida } from "../dominio/gestion.js";
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
  const vigentes = datos.compras.filter((c) => !c.anulada);
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
          .filter((a) => !a.anulada && a.parte_id === p.id)
          .map((a) => a.compra_id),
      );
      deAlcance = (c) =>
        conCargo.has(c.id) &&
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
  let elegibles = vigentes.filter(deAlcance);
  if (Array.isArray(elegidas)) {
    const ids = new Set(elegidas);
    elegibles = elegibles.filter((c) => ids.has(c.id));
  }
  const items = [];
  for (const compra of elegibles) {
    const fotos = datos.fotos
      .filter((f) => f.compra_id === compra.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    const asig = datos.asignaciones.filter(
      (a) => !a.anulada && a.compra_id === compra.id,
    );
    const item = {
      compra,
      fotos,
      gestion: gestiones.get(compra.gestion_id)?.nombre || null,
    };
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
          datos.anexos.find((a) => a.foto_id === f.id),
          orientacionExif(bytes, f.tipo),
        );
      }
    }
    items.push(item);
  }
  // Estado financiero al corte: solo de las gestiones del alcance (y, por destinatario, solo sus saldos).
  const { saldos, observaciones } = calcularSaldos(datos, { corte });
  const propios = (s) =>
    gestionesAlcance.includes(s.gestion_id) &&
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
  const textos = [];
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
    financiero: hubo ? { saldos: lineasSaldo, liquidaciones } : null,
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
    const ctx = await contexto(repo, files, alcance, o);
    const generado = reloj().toISOString();
    const modelo = prepararInforme(ctx, {
      titulo: o.titulo,
      responsable: o.responsable,
      destinatario: o.destinatario,
      corte: o.corte,
      papel: o.papel,
      estilo: o.estilo,
      incluirFotos: !!o.incluirFotos,
      incluirCompartidos: !!o.incluirCompartidos,
      revision,
      generado,
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
      if (r.motor !== MOTOR_PDF)
        throw estado(
          "La revisión se emitió con otra versión: no tiene modelo para Excel.",
        );
      return {
        bytes: await informeExcel(JSON.parse(r.datos)),
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
