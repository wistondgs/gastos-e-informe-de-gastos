/**
 * API local de Gastos y Rendiciones: la única puerta entre la interfaz y los
 * datos. Cada operación recibe y devuelve objetos simples (serializables a
 * JSON), funciona sin conexión y, si falla, lanza un ErrorApi. Contrato:
 * docs/CONTRATOS_API.md.
 */
import { validarCompra, MONEDAS } from "../dominio/compra.js";
import { validarGestion, fechaValida } from "../dominio/gestion.js";
import { validarCatalogo } from "../dominio/catalogos.js";
import { estadoCuentas } from "../dominio/estado-cuentas.js";
import { verificarImagen } from "../dominio/operaciones.js";
import {
  calcularSaldos,
  liquidacion,
  validarParte,
  validarMovimientoBasico,
} from "../dominio/finanzas.js";
import { validarAjusteAnexo, proponerRecorte } from "../documentos/anexos.js";
import { huella } from "../datos/archivos.js";
import { IDENTIDAD } from "../identidad.js";
import {
  ErrorApi,
  noEncontrado,
  estado,
  validacion,
  traducir,
} from "./errores.js";
import { servicioInformes } from "./informes.js";
import { servicioRespaldo } from "./respaldo.js";
export { ErrorApi };
const MOTIVO = (m) => {
  if (typeof m !== "string" || m.trim().length < 3 || m.length > 300)
    throw validacion("Indicá el motivo (de 3 a 300 caracteres).", "motivo");
  return m.trim();
};
const CLASES = ["factura", "voucher", "otro"];
export function crearApi({
  repo,
  files,
  informesPrivados,
  informesCompartidos,
  reloj = () => new Date(),
  uuid = () => crypto.randomUUID(),
  version = async () => null,
}) {
  const ahora = () => reloj().toISOString();
  const evento = (entidad, entidad_id, tipo, motivo, datos = {}) => ({
    tabla: "eventos",
    fila: {
      id: uuid(),
      fecha: ahora(),
      entidad,
      entidad_id,
      tipo,
      motivo,
      datos: JSON.stringify(datos),
    },
  });
  const ordenar = (v) => {
    if (v instanceof Uint8Array) return Array.from(v);
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined)
          .map((k) => [k, ordenar(v[k])]),
      );
    return v;
  };
  const identidad = async (valor) =>
    huella(new TextEncoder().encode(JSON.stringify(ordenar(valor))));
  async function verificarReintento(entidad, id, firma) {
    const e = (await repo.todas("eventos")).find(
      (x) =>
        x.entidad === entidad &&
        x.entidad_id === id &&
        x.tipo === "identidad_registro",
    );
    if (!e || JSON.parse(e.datos).firma !== firma)
      throw new ErrorApi(
        "CONFLICTO",
        "El identificador ya pertenece a otro registro o su contenido original no puede verificarse.",
      );
  }
  const eventoIdentidad = (entidad, id, firma) =>
    evento(entidad, id, "identidad_registro", "", { firma });
  /** Valida el conjunto completo como quedaría y recién entonces lo guarda. */
  async function confirmar({ altas = [], cambios = [] }) {
    const datos = await repo.cargarTodo();
    for (const { tabla, fila } of altas) {
      const clave = tabla === "anexos" ? "foto_id" : "id";
      if (!datos[tabla].some((x) => x[clave] === fila[clave]))
        datos[tabla].push(fila);
    }
    for (const { tabla, id, campos } of cambios) {
      const clave = tabla === "anexos" ? "foto_id" : "id";
      const i = datos[tabla].findIndex((x) => x[clave] === id);
      if (i >= 0) datos[tabla][i] = { ...datos[tabla][i], ...campos };
    }
    calcularSaldos(datos);
    return repo.aplicar({ altas, cambios });
  }
  async function exigir(tabla, id, que) {
    const fila = id ? await repo.una(tabla, id) : null;
    if (!fila) throw noEncontrado(que);
    return fila;
  }
  const parteOpcional = async (id, campo) => {
    if (id == null) return null;
    const p = await repo.una("partes", id);
    if (!p) throw validacion("La persona o empresa no existe.", campo);
    return p;
  };
  async function prepararImagenes(compraId, imagenes = []) {
    const staged = [];
    try {
      for (const imagen of imagenes) {
        verificarImagen(imagen.bytes, imagen.tipo);
        if (!CLASES.includes(imagen.clase))
          throw validacion("Tipo de comprobante inválido.", "clase");
        const ruta = files.ruta(imagen.tipo);
        await files.escribir(ruta, imagen.bytes);
        staged.push({
          id: uuid(),
          compra_id: compraId,
          ruta,
          tipo: imagen.tipo,
          clase: imagen.clase,
          sha256: await huella(imagen.bytes),
        });
      }
      return staged;
    } catch (e) {
      await borrarArchivos(staged);
      throw e;
    }
  }
  const borrarArchivos = (fotos) =>
    Promise.all(fotos.map((f) => files.borrar(f.ruta).catch(() => {})));
  const vigentes = (lista) => lista.filter((x) => !x.anulada);

  const api = {
    identidad: async () => ({ ...IDENTIDAD, version: await version() }),

    partes: {
      async crear({ id = uuid(), nombre, tipo }) {
        const p = validarParte({
          id,
          nombre: nombre?.trim(),
          tipo,
          activa: 1,
          creada: ahora(),
        });
        const existente = await repo.una("partes", id);
        if (existente) {
          if (existente.nombre !== p.nombre || existente.tipo !== p.tipo)
            throw new ErrorApi(
              "CONFLICTO",
              "El identificador ya pertenece a otra parte.",
            );
          return { parte: existente, creada: false };
        }
        await repo.aplicar({ altas: [{ tabla: "partes", fila: p }] });
        return { parte: p, creada: true };
      },
      async listar({ incluirInactivas = false } = {}) {
        const todas = await repo.todas("partes");
        return todas
          .filter((p) => incluirInactivas || p.activa === 1)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
      },
      async editar(id, { nombre }, motivo) {
        const anterior = await exigir("partes", id, "la persona o empresa");
        const parte = validarParte({ ...anterior, nombre: nombre?.trim() });
        await repo.aplicar({
          cambios: [{ tabla: "partes", id, campos: { nombre: parte.nombre } }],
          altas: [
            evento("parte", id, "editar", MOTIVO(motivo), {
              antes: { nombre: anterior.nombre },
              despues: { nombre: parte.nombre },
            }),
          ],
        });
        return { parte };
      },
      async detalle(id) {
        const parte = await exigir("partes", id, "la persona o empresa");
        const d = await repo.cargarTodo();
        return {
          parte,
          roles: {
            responsable_de_gestiones: d.gestiones
              .filter((g) => g.responsable_id === id)
              .map((g) => g.id),
            beneficiaria_de_compras: d.asignaciones
              .filter((a) => a.parte_id === id && !a.anulada)
              .map((a) => a.compra_id),
            deudora_de_creditos: d.compras
              .filter((c) => c.deudor_id === id && !c.anulada)
              .map((c) => c.id),
            pagos_directos: d.pagos
              .filter(
                (p) =>
                  p.parte_id === id && p.origen === "tercero" && !p.anulada,
              )
              .map((p) => p.id),
            fondos_entregados: d.recepciones
              .filter((r) => r.parte_id === id && !r.anulada)
              .map((r) => r.id),
            fondos_utilizados: d.pagos
              .filter(
                (p) => p.parte_id === id && p.origen === "fondo" && !p.anulada,
              )
              .map((p) => p.id),
          },
          eventos: d.eventos.filter(
            (e) => e.entidad === "parte" && e.entidad_id === id,
          ),
        };
      },
      /** Desactivar no borra: la parte sigue en su historia y en sus informes. */
      async desactivar(id, motivo) {
        const p = await exigir("partes", id, "la persona o empresa");
        if (!p.activa) return { parte: p };
        await repo.aplicar({
          cambios: [{ tabla: "partes", id, campos: { activa: 0 } }],
          altas: [evento("parte", id, "desactivar", MOTIVO(motivo))],
        });
        return { parte: { ...p, activa: 0 } };
      },
    },

    catalogos: {
      async crear({ id = uuid(), tipo, nombre }) {
        const item = validarCatalogo({
          id,
          tipo,
          nombre: nombre?.trim(),
          activa: 1,
          creada: ahora(),
        });
        const anterior = await repo.una("catalogos", id);
        if (anterior) {
          if (anterior.tipo !== item.tipo || anterior.nombre !== item.nombre)
            throw new ErrorApi(
              "CONFLICTO",
              "El identificador ya pertenece a otro elemento.",
            );
          return { item: anterior, creado: false };
        }
        await repo.aplicar({ altas: [{ tabla: "catalogos", fila: item }] });
        return { item, creado: true };
      },
      async listar({ tipo, incluirInactivos = false } = {}) {
        return (await repo.todas("catalogos"))
          .filter(
            (x) => (!tipo || x.tipo === tipo) && (incluirInactivos || x.activa),
          )
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
      },
      async editar(id, { nombre }, motivo) {
        const anterior = await exigir(
          "catalogos",
          id,
          "el elemento del catálogo",
        );
        const item = validarCatalogo({ ...anterior, nombre: nombre?.trim() });
        await repo.aplicar({
          cambios: [
            { tabla: "catalogos", id, campos: { nombre: item.nombre } },
          ],
          altas: [
            evento("catalogo", id, "editar", MOTIVO(motivo), {
              antes: anterior.nombre,
              despues: item.nombre,
            }),
          ],
        });
        return { item };
      },
      async desactivar(id, motivo) {
        const anterior = await exigir(
          "catalogos",
          id,
          "el elemento del catálogo",
        );
        if (!anterior.activa) return { item: anterior };
        await repo.aplicar({
          cambios: [{ tabla: "catalogos", id, campos: { activa: 0 } }],
          altas: [evento("catalogo", id, "desactivar", MOTIVO(motivo))],
        });
        return { item: { ...anterior, activa: 0 } };
      },
    },

    gestiones: {
      async crear({
        id = uuid(),
        nombre,
        descripcion = "",
        responsable_id = null,
        fecha_inicio,
      }) {
        if (typeof descripcion !== "string" || descripcion.length > 500)
          throw validacion(
            "La descripción admite hasta 500 caracteres.",
            "descripcion",
          );
        await parteOpcional(responsable_id, "responsable_id");
        const g = {
          id,
          nombre: nombre?.trim(),
          descripcion,
          responsable_id,
          fecha_inicio,
          fecha_fin: null,
        };
        validarGestion(g);
        const creada = await repo.aplicar({
          altas: [{ tabla: "gestiones", fila: g }],
        });
        return { gestion: g, creada };
      },
      async listar({ estado: filtro = "todas" } = {}) {
        const datos = await repo.cargarTodo();
        return datos.gestiones
          .filter(
            (g) =>
              filtro === "todas" ||
              (filtro === "abiertas" ? !g.fecha_fin : !!g.fecha_fin),
          )
          .sort(
            (a, b) =>
              b.fecha_inicio.localeCompare(a.fecha_inicio) ||
              a.id.localeCompare(b.id),
          )
          .map((g) => ({
            ...g,
            estado: g.fecha_fin ? "terminada" : "abierta",
            liquidacion: liquidacion(datos, g.id).estado,
            compras: datos.compras.filter(
              (c) => c.gestion_id === g.id && !c.anulada,
            ).length,
          }));
      },
      async detalle(id) {
        const g = await exigir("gestiones", id, "la gestión");
        const datos = await repo.cargarTodo();
        const liq = liquidacion(datos, id);
        const comprasGestion = datos.compras.filter((c) => c.gestion_id === id);
        const pagosGestion = datos.pagos.filter((p) =>
          comprasGestion.some((c) => c.id === p.compra_id),
        );
        const aplicacionesGestion = datos.aplicaciones.filter(
          (a) => a.gestion_id === id,
        );
        const movimientosGestion = datos.movimientos.filter(
          (m) => m.gestion_id === id || m.gestion_destino_id === id,
        );
        const idsEventos = {
          gestion: new Set([id]),
          compra: new Set(comprasGestion.map((x) => x.id)),
          pago: new Set(pagosGestion.map((x) => x.id)),
          aplicacion: new Set(aplicacionesGestion.map((x) => x.id)),
          movimiento: new Set(movimientosGestion.map((x) => x.id)),
          recepcion: new Set(aplicacionesGestion.map((x) => x.recepcion_id)),
        };
        const historial = [
          ...aplicacionesGestion.map((a) => {
            const r = datos.recepciones.find((x) => x.id === a.recepcion_id);
            return {
              ...a,
              tipo: a.destino,
              fecha: r?.fecha,
              moneda: r?.moneda,
              parte_id: r?.parte_id,
              referencia: r?.referencia,
            };
          }),
          ...comprasGestion.map((c) => ({
            ...c,
            tipo: "compra",
            fecha: c.fecha_compra,
          })),
          ...pagosGestion.map((p) => ({
            ...p,
            tipo: "pago",
            moneda: comprasGestion.find((c) => c.id === p.compra_id)?.moneda,
          })),
          ...movimientosGestion,
          ...datos.eventos.filter(
            (e) =>
              idsEventos[e.entidad]?.has(e.entidad_id) &&
              e.tipo !== "identidad_registro",
          ),
        ].sort(
          (a, b) =>
            String(a.fecha).localeCompare(String(b.fecha)) ||
            String(a.id).localeCompare(String(b.id)),
        );
        return {
          gestion: { ...g, estado: g.fecha_fin ? "terminada" : "abierta" },
          compras: datos.compras.filter((c) => c.gestion_id === id),
          liquidacion: liq.estado,
          saldos: liq.saldos,
          observaciones: calcularSaldos(datos).observaciones.filter(
            (o) => o.gestion_id === id,
          ),
          historial,
          eventos: datos.eventos
            .filter((e) => e.entidad === "gestion" && e.entidad_id === id)
            .sort((a, b) => a.fecha.localeCompare(b.fecha)),
        };
      },
      async cerrar(id, fecha) {
        const g = await exigir("gestiones", id, "la gestión");
        if (g.fecha_fin) throw estado("La gestión ya está terminada.");
        validarGestion({ ...g, fecha_fin: fecha });
        await repo.aplicar({
          cambios: [{ tabla: "gestiones", id, campos: { fecha_fin: fecha } }],
          altas: [
            evento("gestion", id, "cerrar", "Cierre de la gestión", {
              fecha_fin: fecha,
            }),
          ],
        });
        return { gestion: { ...g, fecha_fin: fecha, estado: "terminada" } };
      },
      /** Reabrir conserva la fecha anterior en el evento; los informes emitidos no cambian. */
      async reabrir(id, motivo) {
        const g = await exigir("gestiones", id, "la gestión");
        if (!g.fecha_fin) throw estado("La gestión está abierta.");
        await repo.aplicar({
          cambios: [{ tabla: "gestiones", id, campos: { fecha_fin: null } }],
          altas: [
            evento("gestion", id, "reabrir", MOTIVO(motivo), {
              fecha_fin_anterior: g.fecha_fin,
            }),
          ],
        });
        return { gestion: { ...g, fecha_fin: null, estado: "abierta" } };
      },
    },

    compras: {
      /**
       * Registra una compra con sus comprobantes, y opcionalmente su forma de
       * pago, asignaciones y pagos, todo o nada. Reintentar con el mismo id y
       * el mismo contenido no duplica: devuelve creada=false.
       */
      async registrar(entrada) {
        const {
          id = uuid(),
          gestion_id = null,
          forma_pago = "sin_detalle",
          deudor_id = null,
          asignaciones = [],
          pagos = [],
          imagenes = [],
          catalogos = [],
          ...resto
        } = entrada || {};
        if (
          !Array.isArray(catalogos) ||
          new Set(catalogos).size !== catalogos.length
        )
          throw validacion("Selección de catálogos inválida.", "catalogos");
        const compra = {
          id,
          fecha_registro: ahora(),
          factura: "",
          ...resto,
          gestion_id,
          forma_pago,
          deudor_id,
          anulada: null,
        };
        const firma = await identidad({
          ...compra,
          fecha_registro: null,
          anulada: null,
          asignaciones,
          pagos,
          imagenes,
          ...(catalogos.length ? { catalogos } : {}),
        });
        const previa = await repo.una("compras", id);
        if (previa) {
          await verificarReintento("compra", id, firma);
          return { compra: previa, creada: false };
        }
        validarCompra(compra);
        if (!["sin_detalle", "contado", "credito"].includes(forma_pago))
          throw validacion("Forma de pago inválida.", "forma_pago");
        if (gestion_id != null) {
          const g = await repo.una("gestiones", gestion_id);
          if (!g) throw validacion("La gestión no existe.", "gestion_id");
          if (g.fecha_fin) throw estado("Elegí una gestión abierta.");
        }
        await parteOpcional(deudor_id, "deudor_id");
        const usosCatalogo = [];
        for (const catalogoId of catalogos) {
          const item = await repo.una("catalogos", catalogoId);
          if (!item || !item.activa)
            throw validacion(
              "Un elemento del catálogo no está disponible.",
              "catalogos",
            );
          usosCatalogo.push({
            id: uuid(),
            catalogo_id: item.id,
            compra_id: id,
            tipo: item.tipo,
            nombre: item.nombre,
          });
        }
        const filasAsig = asignaciones.map((a) =>
          validarMovimientoBasico("asignacion", {
            id: a.id || uuid(),
            compra_id: id,
            parte_id: a.parte_id ?? null,
            importe: a.importe,
            anulada: null,
          }),
        );
        const filasPago = pagos.map((p) => {
          const asignacion_id =
            typeof p.asignacion === "number"
              ? filasAsig[p.asignacion]?.id
              : (p.asignacion_id ?? null);
          if (typeof p.asignacion === "number" && !asignacion_id)
            throw validacion(
              "El pago apunta a una asignación inexistente.",
              "asignacion",
            );
          return validarMovimientoBasico("pago", {
            id: p.id || uuid(),
            compra_id: id,
            asignacion_id,
            fecha: p.fecha || compra.fecha_compra,
            fecha_registro: ahora(),
            importe: p.importe,
            origen: p.origen,
            parte_id: p.parte_id ?? null,
            anulada: null,
          });
        });
        const fotos = await prepararImagenes(id, imagenes);
        repo.alRevertir(() => borrarArchivos(fotos));
        try {
          const anexosIniciales = imagenes.flatMap((imagen, indice) =>
            imagen.ajuste
              ? [
                  {
                    tabla: "anexos",
                    fila: validarAjusteAnexo({
                      ...imagen.ajuste,
                      foto_id: fotos[indice].id,
                      actualizado: ahora(),
                    }),
                  },
                ]
              : [],
          );
          await confirmar({
            altas: [
              { tabla: "compras", fila: compra },
              ...fotos.map((f) => ({ tabla: "fotos", fila: f })),
              ...usosCatalogo.map((fila) => ({ tabla: "catalogo_usos", fila })),
              ...anexosIniciales,
              ...filasAsig.map((f) => ({ tabla: "asignaciones", fila: f })),
              ...filasPago.map((f) => ({ tabla: "pagos", fila: f })),
              eventoIdentidad("compra", id, firma),
            ],
          });
        } catch (e) {
          await borrarArchivos(fotos);
          throw e;
        }
        return { compra, creada: true };
      },
      async listar({
        gestion_id,
        desde,
        hasta,
        moneda,
        proveedor,
        comprobante,
        incluirAnuladas = false,
      } = {}) {
        const texto = proveedor?.trim().toLowerCase();
        return (await repo.compras()).filter(
          (c) =>
            (incluirAnuladas || !c.anulada) &&
            (gestion_id === undefined ||
              (gestion_id === "ninguna"
                ? c.gestion_id == null
                : c.gestion_id === gestion_id)) &&
            (!desde || c.fecha_compra >= desde) &&
            (!hasta || c.fecha_compra <= hasta) &&
            (!moneda || c.moneda === moneda) &&
            (!texto || c.proveedor.toLowerCase().includes(texto)) &&
            (!comprobante || c.estado === comprobante),
        );
      },
      async detalle(id) {
        const compra = await exigir("compras", id, "la compra");
        const datos = await repo.cargarTodo();
        const fotos = datos.fotos.filter((f) => f.compra_id === id);
        return {
          compra,
          catalogos: datos.catalogo_usos.filter((u) => u.compra_id === id),
          fotos,
          anexos: datos.anexos.filter((a) =>
            fotos.some((f) => f.id === a.foto_id),
          ),
          asignaciones: datos.asignaciones.filter((a) => a.compra_id === id),
          pagos: datos.pagos.filter((p) => p.compra_id === id),
          eventos: datos.eventos
            .filter((e) => e.entidad === "compra" && e.entidad_id === id)
            .sort((a, b) => a.fecha.localeCompare(b.fecha)),
        };
      },
      /** Corrige únicamente datos descriptivos y conserva el antes en auditoría. */
      async corregir(id, cambios, motivo) {
        const compra = await exigir("compras", id, "la compra");
        if (compra.anulada) throw estado("La compra está anulada.");
        const permitidos = ["concepto", "proveedor", "factura"];
        if (
          !cambios ||
          typeof cambios !== "object" ||
          !Object.keys(cambios).length ||
          !Object.keys(cambios).every((k) => permitidos.includes(k))
        )
          throw validacion(
            "Solo se pueden corregir concepto, proveedor y número de factura.",
          );
        const m = MOTIVO(motivo);
        validarCompra({ ...compra, ...cambios });
        const antes = Object.fromEntries(
          Object.keys(cambios).map((k) => [k, compra[k]]),
        );
        await confirmar({
          cambios: [{ tabla: "compras", id, campos: cambios }],
          altas: [
            evento("compra", id, "corregir", m, { antes, despues: cambios }),
          ],
        });
        return { compra: { ...compra, ...cambios } };
      },
      /** Sustituye la compra sin borrar la original. Los pagos y repartos deben revertirse antes. */
      async corregirEconomia(
        id,
        { id: nuevoId = uuid(), importe, moneda },
        motivo,
      ) {
        const m = MOTIVO(motivo);
        const d = await repo.cargarTodo();
        const anterior = d.compras.find((c) => c.id === id);
        if (!anterior) throw noEncontrado("la compra");
        if (anterior.anulada) {
          const eventoPrevio = d.eventos.find(
            (e) =>
              e.entidad === "compra" &&
              e.entidad_id === id &&
              e.tipo === "reemplazada" &&
              JSON.parse(e.datos).reemplazada_por === nuevoId,
          );
          const previa = d.compras.find((c) => c.id === nuevoId);
          if (eventoPrevio && previa) {
            if (
              previa.importe !== (importe ?? anterior.importe) ||
              previa.moneda !== (moneda ?? anterior.moneda) ||
              eventoPrevio.motivo !== m
            )
              throw new ErrorApi(
                "CONFLICTO",
                "La corrección ya existe con otro contenido.",
              );
            return { compra: previa, original: anterior, creada: false };
          }
          throw estado("La compra ya está anulada.");
        }
        if (d.compras.some((c) => c.id === nuevoId))
          throw new ErrorApi(
            "CONFLICTO",
            "El identificador de la corrección ya pertenece a otra compra.",
          );
        if (
          d.pagos.some((p) => p.compra_id === id && !p.anulada) ||
          d.asignaciones.some((a) => a.compra_id === id && !a.anulada)
        )
          throw estado(
            "Primero anulá los pagos y retirá las asignaciones vigentes de esta compra.",
          );
        const nueva = validarCompra({
          ...anterior,
          id: nuevoId,
          importe: importe ?? anterior.importe,
          moneda: moneda ?? anterior.moneda,
          fecha_registro: ahora(),
          anulada: null,
        });
        const fotosAnteriores = d.fotos.filter((f) => f.compra_id === id);
        const imagenes = [];
        for (const f of fotosAnteriores) {
          const bytes = await files.leer(f.ruta);
          if ((await huella(bytes)) !== f.sha256)
            throw new ErrorApi(
              "INTEGRIDAD",
              "El comprobante falta o está alterado.",
            );
          const anexo = d.anexos.find((a) => a.foto_id === f.id);
          imagenes.push({
            bytes,
            tipo: f.tipo,
            clase: f.clase,
            ...(anexo
              ? {
                  ajuste: {
                    rotacion: anexo.rotacion,
                    enderezar: anexo.enderezar,
                    recorte: anexo.recorte,
                  },
                }
              : {}),
          });
        }
        const fotos = await prepararImagenes(nuevoId, imagenes);
        repo.alRevertir(() => borrarArchivos(fotos));
        const anexos = imagenes.flatMap((imagen, i) =>
          imagen.ajuste
            ? [
                {
                  tabla: "anexos",
                  fila: validarAjusteAnexo({
                    ...imagen.ajuste,
                    foto_id: fotos[i].id,
                    actualizado: ahora(),
                  }),
                },
              ]
            : [],
        );
        const usos = d.catalogo_usos
          .filter((u) => u.compra_id === id)
          .map((u) => ({ ...u, id: uuid(), compra_id: nuevoId }));
        const firma = await identidad({
          ...nueva,
          fecha_registro: null,
          anulada: null,
          asignaciones: [],
          pagos: [],
          imagenes,
          ...(usos.length ? { catalogos: usos.map((u) => u.catalogo_id) } : {}),
        });
        const fecha = ahora();
        await confirmar({
          cambios: [{ tabla: "compras", id, campos: { anulada: fecha } }],
          altas: [
            { tabla: "compras", fila: nueva },
            ...fotos.map((fila) => ({ tabla: "fotos", fila })),
            ...anexos,
            ...usos.map((fila) => ({ tabla: "catalogo_usos", fila })),
            evento("compra", id, "reemplazada", m, {
              reemplazada_por: nuevoId,
            }),
            evento("compra", nuevoId, "reemplaza", m, { reemplaza_id: id }),
            eventoIdentidad("compra", nuevoId, firma),
          ],
        });
        return { compra: nueva, original: { ...anterior, anulada: fecha } };
      },
      /** Anular no borra: la compra, sus pagos y asignaciones quedan con fecha y motivo. */
      async anular(id, motivo) {
        const c = await exigir("compras", id, "la compra");
        if (c.anulada) return { compra: c };
        const m = MOTIVO(motivo),
          fecha = ahora();
        const pagos = vigentes(
          (await repo.todas("pagos")).filter((p) => p.compra_id === id),
        );
        const asig = vigentes(
          (await repo.todas("asignaciones")).filter((a) => a.compra_id === id),
        );
        await confirmar({
          cambios: [
            { tabla: "compras", id, campos: { anulada: fecha } },
            ...pagos.map((p) => ({
              tabla: "pagos",
              id: p.id,
              campos: { anulada: fecha },
            })),
            ...asig.map((a) => ({
              tabla: "asignaciones",
              id: a.id,
              campos: { anulada: fecha },
            })),
          ],
          altas: [
            evento("compra", id, "anular", m, {
              pagos: pagos.map((p) => p.id),
              asignaciones: asig.map((a) => a.id),
            }),
          ],
        });
        return { compra: { ...c, anulada: fecha } };
      },
      /** Reemplaza el reparto de la compra; el anterior queda anulado, no borrado. */
      async asignar(id, asignaciones, motivo = "Reparto de la compra") {
        const c = await exigir("compras", id, "la compra");
        if (c.anulada) throw estado("La compra está anulada.");
        for (const a of asignaciones)
          await parteOpcional(a.parte_id ?? null, "parte_id");
        const fecha = ahora();
        const previas = vigentes(
          (await repo.todas("asignaciones")).filter((a) => a.compra_id === id),
        );
        const conPago = vigentes(
          (await repo.todas("pagos")).filter(
            (p) => p.compra_id === id && p.asignacion_id,
          ),
        );
        if (conPago.length && previas.length)
          throw estado(
            "Hay pagos imputados al reparto actual: anulalos antes de cambiarlo.",
          );
        const nuevas = asignaciones.map((a) =>
          validarMovimientoBasico("asignacion", {
            id: a.id || uuid(),
            compra_id: id,
            parte_id: a.parte_id ?? null,
            importe: a.importe,
            anulada: null,
          }),
        );
        await confirmar({
          cambios: previas.map((a) => ({
            tabla: "asignaciones",
            id: a.id,
            campos: { anulada: fecha },
          })),
          altas: [
            ...nuevas.map((f) => ({ tabla: "asignaciones", fila: f })),
            evento("compra", id, "asignar", MOTIVO(motivo), {
              antes: previas.map(({ parte_id, importe }) => ({
                parte_id,
                importe,
              })),
              despues: nuevas.map(({ parte_id, importe }) => ({
                parte_id,
                importe,
              })),
            }),
          ],
        });
        return { asignaciones: nuevas };
      },
      /** Una compra antigua «sin detalle» se clasifica una sola vez como contado o crédito. */
      async clasificarPago(
        id,
        { forma_pago, deudor_id = null },
        motivo = "Clasificación de la forma de pago",
      ) {
        const c = await exigir("compras", id, "la compra");
        if (c.forma_pago !== "sin_detalle")
          throw estado("La forma de pago ya está indicada.");
        if (!["contado", "credito"].includes(forma_pago))
          throw validacion("Elegí contado o crédito.", "forma_pago");
        await parteOpcional(deudor_id, "deudor_id");
        await confirmar({
          cambios: [
            { tabla: "compras", id, campos: { forma_pago, deudor_id } },
          ],
          altas: [
            evento("compra", id, "clasificar_pago", MOTIVO(motivo), {
              forma_pago,
              deudor_id,
            }),
          ],
        });
        return { compra: { ...c, forma_pago, deudor_id } };
      },
    },

    pagos: {
      async registrar({
        id = uuid(),
        compra_id,
        fecha,
        importe,
        origen,
        parte_id = null,
        asignacion_id = null,
      }) {
        const c = await exigir("compras", compra_id, "la compra");
        if (c.anulada) throw estado("La compra está anulada.");
        const p = validarMovimientoBasico("pago", {
          id,
          compra_id,
          asignacion_id,
          fecha,
          fecha_registro: ahora(),
          importe,
          origen,
          parte_id,
          anulada: null,
        });
        const firma = await identidad({
          ...p,
          fecha_registro: null,
          anulada: null,
        });
        const previo = await repo.una("pagos", id);
        if (previo) {
          await verificarReintento("pago", id, firma);
          return { pago: previo, creado: false };
        }
        await confirmar({
          altas: [
            { tabla: "pagos", fila: p },
            eventoIdentidad("pago", id, firma),
          ],
        });
        return { pago: p, creado: true };
      },
      async anular(id, motivo) {
        const p = await exigir("pagos", id, "el pago");
        if (p.anulada) return { pago: p };
        const fecha = ahora();
        await confirmar({
          cambios: [{ tabla: "pagos", id, campos: { anulada: fecha } }],
          altas: [
            evento("pago", id, "anular", MOTIVO(motivo), {
              compra_id: p.compra_id,
              importe: p.importe,
            }),
          ],
        });
        return { pago: { ...p, anulada: fecha } };
      },
    },

    fondos: {
      /**
       * Registra dinero recibido de una parte, una sola vez, y su reparto entre
       * gestiones: como anticipo (queda en custodia) o como reembolso.
       */
      async recibir({
        id = uuid(),
        fecha,
        parte_id,
        importe,
        moneda,
        referencia = "",
        aplicaciones = [],
      }) {
        await exigirParte(parte_id);
        if (typeof referencia !== "string" || referencia.length > 120)
          throw validacion(
            "La referencia admite hasta 120 caracteres.",
            "referencia",
          );
        const r = validarMovimientoBasico("recepcion", {
          id,
          fecha,
          fecha_registro: ahora(),
          parte_id,
          importe,
          moneda,
          referencia,
          anulada: null,
        });
        const firma = await identidad({
          ...r,
          fecha_registro: null,
          anulada: null,
          aplicaciones,
        });
        const previa = await repo.una("recepciones", id);
        if (previa) {
          await verificarReintento("recepcion", id, firma);
          return { recepcion: previa, creada: false };
        }
        const filas = await filasAplicacion(id, aplicaciones);
        await confirmar({
          altas: [
            { tabla: "recepciones", fila: r },
            ...filas.map((f) => ({ tabla: "aplicaciones", fila: f })),
            eventoIdentidad("recepcion", id, firma),
          ],
        });
        return { recepcion: r, aplicaciones: filas, creada: true };
      },
      /** Aplica a gestiones lo que quedó sin aplicar de una recepción. */
      async aplicar(recepcion_id, aplicaciones) {
        const r = await exigir("recepciones", recepcion_id, "la recepción");
        if (r.anulada) throw estado("La recepción está anulada.");
        const filas = await filasAplicacion(recepcion_id, aplicaciones);
        const eventos = [];
        for (const fila of filas)
          if (!(await repo.una("aplicaciones", fila.id)))
            eventos.push(
              evento(
                "aplicacion",
                fila.id,
                "aplicar",
                "Dinero aplicado posteriormente",
                { recepcion_id, gestion_id: fila.gestion_id },
              ),
            );
        await confirmar({
          altas: [
            ...filas.map((f) => ({ tabla: "aplicaciones", fila: f })),
            ...eventos,
          ],
        });
        return { aplicaciones: filas };
      },
      async devolver({
        id = uuid(),
        gestion_id,
        parte_id,
        fecha,
        importe,
        moneda,
      }) {
        return movimiento({
          id,
          tipo: "devolucion",
          gestion_id,
          gestion_destino_id: null,
          parte_id,
          fecha,
          importe,
          moneda,
        });
      },
      async trasladar({
        id = uuid(),
        gestion_id,
        gestion_destino_id,
        parte_id,
        fecha,
        importe,
        moneda,
      }) {
        return movimiento({
          id,
          tipo: "traslado",
          gestion_id,
          gestion_destino_id,
          parte_id,
          fecha,
          importe,
          moneda,
        });
      },
      /** tipo: recepcion | aplicacion | movimiento. Anular una recepción anula sus aplicaciones. */
      async anular(tipo, id, motivo) {
        const tabla = {
          recepcion: "recepciones",
          aplicacion: "aplicaciones",
          movimiento: "movimientos",
        }[tipo];
        if (!tabla) throw validacion("Tipo de registro inválido.", "tipo");
        const fila = await exigir(tabla, id, "el registro");
        if (fila.anulada) return { anulado: false };
        const fecha = ahora();
        const hijas =
          tipo === "recepcion"
            ? vigentes(
                (await repo.todas("aplicaciones")).filter(
                  (a) => a.recepcion_id === id,
                ),
              )
            : [];
        await confirmar({
          cambios: [
            { tabla, id, campos: { anulada: fecha } },
            ...hijas.map((a) => ({
              tabla: "aplicaciones",
              id: a.id,
              campos: { anulada: fecha },
            })),
          ],
          altas: [
            evento(tipo, id, "anular", MOTIVO(motivo), {
              importe: fila.importe,
              aplicaciones: hijas.map((a) => a.id),
            }),
          ],
        });
        return { anulado: true };
      },
      async recepciones() {
        const datos = await repo.cargarTodo();
        const { observaciones } = calcularSaldos(datos);
        return datos.recepciones.map((r) => ({
          ...r,
          aplicaciones: datos.aplicaciones.filter(
            (a) => a.recepcion_id === r.id,
          ),
          sin_aplicar:
            observaciones.find(
              (o) =>
                o.tipo === "recepcion_sin_aplicar" && o.recepcion_id === r.id,
            )?.importe || 0,
        }));
      },
    },

    saldos: {
      async cuentas({ gestion_id } = {}) {
        if (gestion_id) await exigir("gestiones", gestion_id, "la gestión");
        return { cuentas: estadoCuentas(await repo.cargarTodo(), gestion_id) };
      },
      /** Los saldos distintos de cero, filtrables; nunca un neto que los mezcle. */
      async consultar({ gestion_id, parte_id, moneda, corte = null } = {}) {
        if (corte !== null && !fechaValida(corte))
          throw validacion("Fecha de corte inválida.", "corte");
        const { saldos, observaciones } = calcularSaldos(
          await repo.cargarTodo(),
          { corte },
        );
        const ok = (s) =>
          (!gestion_id || s.gestion_id === gestion_id) &&
          (!parte_id || s.parte_id === parte_id) &&
          (!moneda || s.moneda === moneda);
        return {
          saldos: saldos.filter(ok),
          observaciones: observaciones.filter(ok),
        };
      },
      async liquidacion(gestion_id, { corte = null } = {}) {
        await exigir("gestiones", gestion_id, "la gestión");
        return liquidacion(await repo.cargarTodo(), gestion_id, { corte });
      },
    },

    comprobantes: {
      /** Agrega imágenes a una compra existente; una compra «pendiente» pasa a «factura». */
      async agregar(compra_id, imagenes) {
        const c = await exigir("compras", compra_id, "la compra");
        if (c.anulada) throw estado("La compra está anulada.");
        if (!imagenes?.length)
          throw validacion("Agregá al menos una imagen.", "imagenes");
        const fotos = await prepararImagenes(compra_id, imagenes);
        const pasa =
          c.estado === "pendiente" && fotos.some((f) => f.clase === "factura");
        try {
          await repo.aplicar({
            altas: [
              ...fotos.map((f) => ({ tabla: "fotos", fila: f })),
              evento(
                "compra",
                compra_id,
                "adjuntar",
                "Comprobantes agregados",
                { fotos: fotos.map((f) => f.id) },
              ),
              ...(pasa
                ? [
                    evento(
                      "compra",
                      compra_id,
                      "comprobante",
                      "Se agregó la factura",
                      { estado_anterior: "pendiente" },
                    ),
                  ]
                : []),
            ],
            cambios: pasa
              ? [
                  {
                    tabla: "compras",
                    id: compra_id,
                    campos: { estado: "factura" },
                  },
                ]
              : [],
          });
        } catch (e) {
          await borrarArchivos(fotos);
          throw e;
        }
        return { fotos };
      },
      /** Bytes de la foto original, verificados contra su huella. */
      async original(foto_id) {
        const f = await exigir("fotos", foto_id, "el comprobante");
        const bytes = await files.leer(f.ruta);
        if ((await huella(bytes)) !== f.sha256)
          throw new ErrorApi(
            "INTEGRIDAD",
            "El comprobante falta o está alterado.",
          );
        return { foto: f, bytes };
      },
    },

    anexos: {
      /** Guarda cómo se presenta la foto en los PDF; la original no cambia. */
      async ajustar(foto_id, ajuste) {
        await exigir("fotos", foto_id, "el comprobante");
        const a = validarAjusteAnexo({
          foto_id,
          ...ajuste,
          actualizado: ahora(),
        });
        const previo = await repo.una("anexos", foto_id);
        await repo.aplicar(
          previo
            ? {
                cambios: [
                  {
                    tabla: "anexos",
                    id: foto_id,
                    campos: {
                      rotacion: a.rotacion,
                      enderezar: a.enderezar,
                      recorte: a.recorte,
                      actualizado: a.actualizado,
                    },
                  },
                ],
                altas: [
                  evento(
                    "anexo",
                    foto_id,
                    "ajustar",
                    "Ajuste de presentación",
                    { antes: previo, despues: a },
                  ),
                ],
              }
            : { altas: [{ tabla: "anexos", fila: a }] },
        );
        return { anexo: a };
      },
      async restablecer(foto_id) {
        return api.anexos.ajustar(foto_id, {
          rotacion: 0,
          enderezar: 0,
          recorte: null,
        });
      },
      async obtener(foto_id) {
        await exigir("fotos", foto_id, "el comprobante");
        return {
          anexo: (await repo.una("anexos", foto_id)) || {
            foto_id,
            rotacion: 0,
            enderezar: 0,
            recorte: null,
          },
        };
      },
      /** Propone un recorte de márgenes uniformes a partir de los píxeles RGBA (null si no es seguro). */
      proponerRecorte: (rgba, ancho, alto) => ({
        recorte: proponerRecorte(rgba, ancho, alto),
      }),
    },
  };
  async function exigirParte(id) {
    if (!id || !(await repo.una("partes", id)))
      throw validacion("La persona o empresa no existe.", "parte_id");
  }
  async function filasAplicacion(recepcion_id, aplicaciones) {
    const filas = [];
    for (const a of aplicaciones) {
      const g = await repo.una("gestiones", a.gestion_id);
      if (!g) throw validacion("La gestión no existe.", "gestion_id");
      if (!["anticipo", "reembolso"].includes(a.destino))
        throw validacion("Elegí anticipo o reembolso.", "destino");
      filas.push(
        validarMovimientoBasico("aplicacion", {
          id: a.id || uuid(),
          recepcion_id,
          gestion_id: a.gestion_id,
          destino: a.destino,
          importe: a.importe,
          anulada: null,
        }),
      );
    }
    return filas;
  }
  async function movimiento(m) {
    await exigirParte(m.parte_id);
    if (!MONEDAS.includes(m.moneda))
      throw validacion("Moneda inválida.", "moneda");
    const fila = validarMovimientoBasico("movimiento", {
      ...m,
      fecha_registro: ahora(),
      anulada: null,
    });
    const previo = await repo.una("movimientos", m.id);
    const firma = await identidad(m);
    if (previo) {
      await verificarReintento("movimiento", m.id, firma);
      return { movimiento: previo, creado: false };
    }
    await confirmar({
      altas: [
        { tabla: "movimientos", fila },
        eventoIdentidad("movimiento", m.id, firma),
      ],
    });
    return { movimiento: fila, creado: true };
  }
  api.informes = servicioInformes({
    repo,
    files,
    informesPrivados,
    informesCompartidos,
    reloj,
    uuid,
  });
  api.respaldo = servicioRespaldo({ repo, files, informesPrivados });
  return envolverTodo(api, repo);
}
/** Toda operación sale con ErrorApi, nunca con un error interno sin traducir. */
function envolverTodo(objeto, repo, ruta = "") {
  const r = {};
  for (const [k, v] of Object.entries(objeto)) {
    const nombre = ruta ? `${ruta}.${k}` : k;
    if (typeof v === "function")
      r[k] = async (...args) => {
        try {
          const financieras = [
            "compras.registrar",
            "compras.anular",
            "compras.asignar",
            "compras.corregir",
            "compras.corregirEconomia",
            "compras.clasificarPago",
            "pagos.registrar",
            "pagos.anular",
            "fondos.recibir",
            "fondos.aplicar",
            "fondos.devolver",
            "fondos.trasladar",
            "fondos.anular",
          ];
          return financieras.includes(nombre)
            ? await repo.transaccion(() => v(...args))
            : await repo.exclusiva(() => v(...args));
        } catch (e) {
          throw traducir(e);
        }
      };
    else if (v && typeof v === "object") r[k] = envolverTodo(v, repo, nombre);
    else r[k] = v;
  }
  return r;
}
