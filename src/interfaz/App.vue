<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { App as Aplicacion } from "@capacitor/app";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { crearProteccion } from "./proteccion.js";
import { crearSalidaCamara } from "./salida-camara.js";
import { versionInstalada } from "./version.js";
import { abrirApi } from "../api/dispositivo.js";
import {
  archivos,
  compartir,
  base64ABytes,
  bytesABase64,
  huella,
} from "../datos/archivos.js";
import { centavos, dinero } from "../dominio/compra.js";
import { verificarImagen } from "../dominio/operaciones.js";
import {
  prepararCompraFinanciera,
  prepararAplicaciones,
} from "./flujo-financiero.js";
import EditorComprobante from "./EditorComprobante.vue";
import InicioGuiado from "./guiada/InicioGuiado.vue";
import AsistenteGasto from "./guiada/AsistenteGasto.vue";
import RecibirGuiado from "./guiada/RecibirGuiado.vue";
import InformeGuiado from "./guiada/InformeGuiado.vue";
import VerComoVoy from "./guiada/VerComoVoy.vue";
import iconoGastos from "./imagenes/icono-gastos.png";
import {
  leerPreferencias,
  guardarPreferencias,
  variablesTema,
} from "./guiada/guia.js";
import { crearBorradores } from "../datos/borradores.js";
import { excel, pdf } from "../exportaciones/informes.js";
import {
  informesCompartidos,
  CARPETA_INFORMES,
} from "../datos/informes-locales.js";
let api = null;
let escuchadorEstado = null;
let escuchadorAtras = null;
const historialPantallas = [];
let autenticando = false;
let borradorHabilitado = false;
let pausaBorrador = false;
const salidaCamara = crearSalidaCamara();
let temporizadorBorrador = null;
const borradores = crearBorradores();
const preferencias = ref(leerPreferencias(globalThis.localStorage));
const asistente = ref(null);
const vistaGuiada = computed(
  () =>
    preferencias.value.guiada &&
    [
      "inicio",
      "guiado",
      "guiado-recibir",
      "guiado-informe",
      "guiado-estado",
    ].includes(pantalla.value),
);
function cambiarPreferencia(cambio) {
  preferencias.value = { ...preferencias.value, ...cambio };
  guardarPreferencias(globalThis.localStorage, preferencias.value);
}
const nativo = Capacitor.isNativePlatform();
const proteccion = crearProteccion({
  nativo,
  sistema: BiometricAuth,
  storage: localStorage,
});
const nuevoPago = () => ({
  tipo: "",
  parte_id: "",
  pagador_id: "",
  fondo: "",
  forma_pago: "contado",
  deudor_id: "",
  asignaciones: [],
  pagos: [],
});
const repo = ref(null),
  bloqueada = ref(proteccion.activa()),
  seguridadActiva = ref(proteccion.activa()),
  compras = ref([]),
  filtroGestion = ref(null),
  gestiones = ref([]),
  partes = ref([]),
  partesTodas = ref([]),
  parteEdicion = ref({ id: "", nombre: "", motivo: "" }),
  parteDetalle = ref(null),
  catalogos = ref([]),
  catalogoForm = ref({ tipo: "cuenta", nombre: "" }),
  catalogoEdicion = ref({ id: "", nombre: "", motivo: "" }),
  desactivarParte = ref({ id: "", motivo: "" }),
  saldos = ref([]),
  recepciones = ref([]),
  repartoIngreso = ref([]),
  pasoIngreso = ref(1),
  buscarIngreso = ref(""),
  nuevoIngresoParte = ref({ nombre: "", tipo: "persona" }),
  nuevaGestionIngreso = ref({
    nombre: "",
    fecha_inicio: "",
    responsable_id: "",
    descripcion: "",
  }),
  ultimaRecepcion = ref(null),
  aplicarIngreso = ref({
    id: "",
    aplicacion_id: crypto.randomUUID(),
    gestion_id: "",
    monto: "",
    destino: "anticipo",
  }),
  nombreParte = ref(""),
  tipoParte = ref("persona"),
  ingreso = ref({
    id: crypto.randomUUID(),
    gestion_id: "",
    parte_id: "",
    fecha: "",
    monto: "",
    moneda: "NIO",
    referencia: "",
    finalidad: "",
    beneficiario_id: "",
    destino: "anticipo",
  }),
  movimiento = ref({
    id: crypto.randomUUID(),
    tipo: "devolucion",
    gestion_id: "",
    gestion_destino_id: "",
    parte_id: "",
    fecha: "",
    monto: "",
    moneda: "NIO",
  }),
  pago = ref(nuevoPago()),
  estadoHistorial = ref("todas"),
  nombreGestion = ref(""),
  inicioGestion = ref(""),
  cierreId = ref(null),
  fechaCierre = ref(""),
  seleccion = ref(null),
  detalleCompra = ref(null),
  abono = ref({
    id: crypto.randomUUID(),
    fecha: "",
    monto: "",
    origen: "tercero",
    parte_id: "",
    asignacion_id: "",
  }),
  motivoCompra = ref(""),
  correccionCompra = ref({
    visible: false,
    concepto: "",
    proveedor: "",
    factura: "",
    motivo: "",
  }),
  correccionEconomica = ref({
    visible: false,
    id: "",
    monto: "",
    moneda: "NIO",
    motivo: "",
  }),
  motivoReparto = ref(""),
  clasificacion = ref({ forma_pago: "contado", deudor_id: "" }),
  reapertura = ref({ id: "", motivo: "" }),
  anulacionMovimiento = ref({ tipo: "", id: "", motivo: "" }),
  gestionDetalle = ref(null),
  cuentasDetalle = ref([]),
  fotos = ref([]),
  vistas = ref([]),
  editor = ref(null),
  claseNuevoComprobante = ref("factura"),
  imagenes = ref([]),
  error = ref(""),
  mensaje = ref(""),
  ocupado = ref(false),
  encabezado = ref("Informe de gastos"),
  pantalla = ref("inicio"),
  paso = ref(1),
  version = ref("Consultando…"),
  ajustes = ref({ encabezado: "", responsable: "", destinatario: "" }),
  informeGestion = ref(null),
  informeGeneral = ref({
    tipo: "periodo",
    desde: "",
    hasta: "",
    parte_id: "",
    gestion_ids: [],
    titulo: "Informe de gastos",
    corte: "",
    responsable: "",
    destinatario: "",
    destinatario_id: "",
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: true,
    incluirCompartidos: false,
  }),
  informeForm = ref({}),
  informeSeleccion = ref([]),
  revisiones = ref([]),
  informesSinRegistro = ref([]);
function ir(destino) {
  if (destino !== pantalla.value) historialPantallas.push(pantalla.value);
  pantalla.value = destino;
  error.value = "";
  mensaje.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function irDesdeGuiado(destino) {
  if (destino === "gestiones") ir("guiado-estado");
  else if (destino === "fondos") ir("guiado-recibir");
  else if (destino === "respaldo") ir("guiado-informe");
  else if (destino === "compras") todasLasCompras();
  else ir(destino);
}
async function cerrarAsistente(destino) {
  await cargar();
  irDesdeGuiado(destino === "compras" ? "compras" : "inicio");
}
function atras() {
  if (
    ["guiado", "guiado-recibir", "guiado-informe"].includes(pantalla.value) &&
    asistente.value?.atras()
  )
    return;
  if (editor.value) {
    editor.value = null;
    return;
  }
  if (pantalla.value === "registro" && paso.value > 1) {
    retroceder();
    return;
  }
  const destino = historialPantallas.pop();
  if (destino) pantalla.value = destino;
  else if (nativo) Aplicacion.exitApp();
}
const gestionesVisibles = computed(() =>
  gestiones.value.filter(
    (g) =>
      estadoHistorial.value === "todas" ||
      (estadoHistorial.value === "abiertas" ? !g.fecha_fin : !!g.fecha_fin),
  ),
);
const comprasVisibles = computed(() =>
  filtroGestion.value === "sin-gestion"
    ? compras.value.filter((c) => !c.gestion_id)
    : compras.value.filter((c) => c.gestion_id === filtroGestion.value),
);
const gruposCompras = computed(() => {
  const grupos = gestiones.value.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    cantidad: compras.value.filter((c) => c.gestion_id === g.id).length,
  }));
  const sinGestion = compras.value.filter((c) => !c.gestion_id).length;
  if (sinGestion)
    grupos.push({
      id: "sin-gestion",
      nombre: "Sin gestión",
      cantidad: sinGestion,
    });
  for (const c of compras.value) {
    if (c.gestion_id && !grupos.some((g) => g.id === c.gestion_id))
      grupos.push({
        id: c.gestion_id,
        nombre: "Gestión no disponible",
        cantidad: compras.value.filter((x) => x.gestion_id === c.gestion_id)
          .length,
      });
  }
  return grupos;
});
function verCompras(id) {
  filtroGestion.value = id;
  ir("compras");
}
function abrirHistorial(h) {
  const historial = gestionDetalle.value?.historial || [];
  const compraId =
    h.tipo === "compra"
      ? h.id
      : h.compra_id ||
        (h.entidad === "compra" ? h.entidad_id : null) ||
        (h.entidad === "pago"
          ? historial.find((p) => p.tipo === "pago" && p.id === h.entidad_id)
              ?.compra_id
          : null);
  if (compraId) {
    const compra = compras.value.find((c) => c.id === compraId);
    if (compra) ver(compra);
    return;
  }
  if (h.recepcion_id || h.entidad === "recepcion" || h.entidad === "aplicacion")
    ir("fondos");
  else if (h.tipo === "traslado" && h.gestion_destino_id)
    verGestion(h.gestion_destino_id);
}
function tieneReferencia(h) {
  return (
    h.tipo === "compra" ||
    !!h.compra_id ||
    ["compra", "pago", "recepcion", "aplicacion"].includes(h.entidad) ||
    !!h.recepcion_id ||
    (h.tipo === "traslado" && !!h.gestion_destino_id)
  );
}
function todasLasCompras() {
  filtroGestion.value = null;
  ir("compras");
}
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nuevo = () => ({
  id: crypto.randomUUID(),
  fecha_compra: hoy(),
  fecha_registro: new Date().toISOString(),
  concepto: "",
  proveedor: "",
  monto: "",
  moneda: "NIO",
  factura: "",
  estado: "pendiente",
  gestion_id: "",
  catalogos: [],
});
const form = ref(nuevo());
function datosBorrador() {
  return {
    form: JSON.parse(JSON.stringify(form.value)),
    pago: JSON.parse(JSON.stringify(pago.value)),
    paso: paso.value,
    imagenes: imagenes.value.map((imagen) => ({
      ...JSON.parse(
        JSON.stringify({
          tipo: imagen.tipo,
          clase: imagen.clase,
          ajuste: imagen.ajuste,
        }),
      ),
      bytes: Uint8Array.from(imagen.bytes),
    })),
  };
}
async function guardarBorrador() {
  if (!borradorHabilitado || pausaBorrador) return;
  try {
    await borradores.guardar("compra", datosBorrador());
  } catch {
    error.value =
      "No se pudo guardar el borrador. Conservá la aplicación abierta y revisá el almacenamiento.";
  }
}
watch(
  [form, pago, paso, imagenes],
  () => {
    if (!borradorHabilitado || pausaBorrador) return;
    clearTimeout(temporizadorBorrador);
    temporizadorBorrador = setTimeout(guardarBorrador, 250);
  },
  { deep: true, flush: "sync" },
);
watch(
  [ingreso, repartoIngreso, pasoIngreso],
  () => {
    if (!borradorHabilitado) return;
    borradores
      .guardar(
        "recepcion",
        JSON.parse(
          JSON.stringify({
            ingreso: ingreso.value,
            reparto: repartoIngreso.value,
            paso: pasoIngreso.value,
          }),
        ),
      )
      .catch(() => {
        error.value = "No se pudo guardar el borrador de recepción.";
      });
  },
  { deep: true, flush: "sync" },
);
async function operacion(fn) {
  if (ocupado.value) return;
  ocupado.value = true;
  error.value = "";
  mensaje.value = "";
  try {
    await fn();
  } catch (e) {
    error.value = e?.message || "No se pudo completar la operación.";
  } finally {
    ocupado.value = false;
  }
}
async function cargar() {
  compras.value = await repo.value.compras();
  gestiones.value = await repo.value.gestiones();
  partesTodas.value = await api.partes.listar({ incluirInactivas: true });
  partes.value = partesTodas.value.filter((p) => p.activa === 1);
  catalogos.value = await api.catalogos.listar({ incluirInactivos: true });
  saldos.value = (await api.saldos.consultar()).saldos;
  recepciones.value = await api.fondos.recepciones();
  if (!ingreso.value.fecha) ingreso.value.fecha = hoy();
  if (!movimiento.value.fecha) movimiento.value.fecha = hoy();
  if (!abono.value.fecha) abono.value.fecha = hoy();
  if (!informeGeneral.value.corte) informeGeneral.value.corte = hoy();
  if (!informeGeneral.value.hasta) informeGeneral.value.hasta = hoy();
  if (!inicioGestion.value) inicioGestion.value = hoy();
  ajustes.value = await repo.value.ajustes();
  encabezado.value = ajustes.value.encabezado;
  if (seleccion.value) {
    seleccion.value =
      compras.value.find((c) => c.id === seleccion.value.id) || null;
    fotos.value = seleccion.value
      ? await repo.value.fotos(seleccion.value.id)
      : [];
  }
}
function alcanceGeneral() {
  const f = informeGeneral.value;
  if (f.tipo === "periodo")
    return { tipo: "periodo", desde: f.desde, hasta: f.hasta };
  if (f.tipo === "parte") return { tipo: "parte", parte_id: f.parte_id };
  if (f.tipo === "gestiones")
    return { tipo: "gestiones", gestion_ids: f.gestion_ids };
  return { tipo: "pendientes" };
}
function opcionesGeneral() {
  const f = informeGeneral.value;
  return {
    titulo: f.titulo,
    corte: f.corte,
    responsable: f.responsable,
    destinatario: f.destinatario,
    destinatario_id: f.destinatario_id || null,
    papel: f.papel,
    estilo: f.estilo,
    incluirFotos: f.incluirFotos,
    incluirCompartidos: f.incluirCompartidos,
  };
}
async function informeGeneralAccion(vistaPrevia) {
  await operacion(async () => {
    const entrada = { alcance: alcanceGeneral(), opciones: opcionesGeneral() };
    if (vistaPrevia) {
      const r = await api.informes.previsualizar(entrada);
      await compartir(
        `vista-previa-${r.codigo}.pdf`,
        r.bytes,
        "application/pdf",
      );
      mensaje.value = `Vista previa: ${r.filas} compras y ${r.anexos} anexos; no se emitió una revisión.`;
    } else {
      const { informe } = await api.informes.emitir(entrada);
      await cargarInformes();
      ir("informes");
      mensaje.value = `Informe ${informe.codigo} emitido.`;
    }
  });
}
async function crearParte() {
  await operacion(async () => {
    const { parte } = await api.partes.crear({
      nombre: nombreParte.value,
      tipo: tipoParte.value,
    });
    nombreParte.value = "";
    await cargar();
    ingreso.value.parte_id = parte.id;
    pago.value.parte_id = parte.id;
    mensaje.value = "Persona o empresa guardada.";
  });
}
async function desactivarPersona() {
  await operacion(async () => {
    await api.partes.desactivar(
      desactivarParte.value.id,
      desactivarParte.value.motivo,
    );
    desactivarParte.value = { id: "", motivo: "" };
    await cargar();
    mensaje.value = "Persona o empresa desactivada; su historia se conserva.";
  });
}
async function guardarParteEditada() {
  await operacion(async () => {
    const p = parteEdicion.value;
    await api.partes.editar(p.id, { nombre: p.nombre }, p.motivo);
    parteEdicion.value = { id: "", nombre: "", motivo: "" };
    await cargar();
    mensaje.value =
      "Nombre actualizado; la referencia y su historial se conservan.";
  });
}
async function mostrarRoles(id) {
  await operacion(async () => {
    parteDetalle.value = await api.partes.detalle(id);
  });
}
async function crearCatalogo() {
  await operacion(async () => {
    await api.catalogos.crear(catalogoForm.value);
    catalogoForm.value.nombre = "";
    await cargar();
    mensaje.value = "Elemento guardado.";
  });
}
async function editarCatalogo() {
  await operacion(async () => {
    const c = catalogoEdicion.value;
    await api.catalogos.editar(c.id, { nombre: c.nombre }, c.motivo);
    catalogoEdicion.value = { id: "", nombre: "", motivo: "" };
    await cargar();
    mensaje.value = "Elemento actualizado.";
  });
}
async function desactivarCatalogo(item) {
  const motivo = prompt(
    "Indicá el motivo de desactivación (al menos 3 caracteres):",
  );
  if (motivo === null) return;
  await operacion(async () => {
    await api.catalogos.desactivar(item.id, motivo);
    await cargar();
    mensaje.value = "Elemento desactivado; su historia se conserva.";
  });
}
async function crearParteIngreso() {
  await operacion(async () => {
    const nombre = nuevoIngresoParte.value.nombre.trim();
    if (!nombre) throw new Error("Indicá el nombre.");
    if (
      partesTodas.value.some(
        (p) =>
          p.nombre.trim().toLocaleLowerCase() === nombre.toLocaleLowerCase(),
      )
    )
      throw new Error(
        "Ya existe una persona o empresa con ese nombre. Elegila de la lista o revisá los registros desactivados.",
      );
    const { parte } = await api.partes.crear({
      nombre,
      tipo: nuevoIngresoParte.value.tipo,
    });
    await cargar();
    ingreso.value.parte_id = parte.id;
    buscarIngreso.value = "";
    nuevoIngresoParte.value.nombre = "";
  });
}
async function crearGestionIngreso() {
  await operacion(async () => {
    const g = nuevaGestionIngreso.value;
    if (!g.nombre.trim() || !g.fecha_inicio)
      throw new Error("Indicá nombre y fecha de inicio de la gestión.");
    const id = crypto.randomUUID();
    await api.gestiones.crear({
      id,
      nombre: g.nombre.trim(),
      fecha_inicio: g.fecha_inicio,
      responsable_id: g.responsable_id || null,
      descripcion: g.descripcion.trim(),
    });
    await cargar();
    repartoIngreso.value.push({
      gestion_id: id,
      monto: "",
      destino: "anticipo",
    });
    nuevaGestionIngreso.value = {
      nombre: "",
      fecha_inicio: "",
      responsable_id: "",
      descripcion: "",
    };
    mensaje.value = "Gestión creada; indicá cuánto querés aplicarle.";
  });
}
function avanzarIngreso() {
  error.value = "";
  try {
    if (pasoIngreso.value === 1 && !ingreso.value.parte_id)
      throw new Error("Elegí quién entrega el dinero.");
    if (pasoIngreso.value === 2) prepararAplicaciones(repartoIngreso.value);
    if (pasoIngreso.value === 3) {
      const total = centavos(ingreso.value.monto);
      if (!ingreso.value.fecha) throw new Error("Indicá la fecha.");
      const aplicado = prepararAplicaciones(repartoIngreso.value).reduce(
        (n, a) => n + a.importe,
        0,
      );
      if (aplicado > total)
        throw new Error("Lo aplicado no puede superar lo recibido.");
    }
    pasoIngreso.value = Math.min(4, pasoIngreso.value + 1);
  } catch (e) {
    error.value = e.message;
  }
}
async function recibirDinero() {
  await operacion(async () => {
    const i = ingreso.value;
    const importe = centavos(i.monto);
    const resumen = {
      parte: partesTodas.value.find((p) => p.id === i.parte_id)?.nombre || "",
      importe,
      moneda: i.moneda,
      fecha: i.fecha,
      aplicaciones: prepararAplicaciones(repartoIngreso.value),
    };
    await api.fondos.recibir({
      id: i.id,
      fecha: i.fecha,
      parte_id: i.parte_id,
      importe,
      moneda: i.moneda,
      referencia: i.referencia,
      finalidad: i.finalidad || "",
      beneficiario_id: i.beneficiario_id || null,
      aplicaciones: prepararAplicaciones(repartoIngreso.value),
    });
    ultimaRecepcion.value = resumen;
    i.monto = "";
    i.referencia = "";
    i.finalidad = "";
    i.beneficiario_id = "";
    i.parte_id = "";
    repartoIngreso.value = [];
    i.id = crypto.randomUUID();
    pasoIngreso.value = 1;
    if (borradorHabilitado) await borradores.descartar("recepcion");
    await cargar();
    mensaje.value =
      "Entrada registrada. Revisá sus aplicaciones y el importe que queda sin aplicar.";
  });
}
async function aplicarDinero() {
  await operacion(async () => {
    const a = aplicarIngreso.value;
    await api.fondos.aplicar(
      a.id,
      prepararAplicaciones([
        {
          id: a.aplicacion_id,
          gestion_id: a.gestion_id,
          monto: a.monto,
          destino: a.destino,
        },
      ]),
    );
    a.id = "";
    a.monto = "";
    a.aplicacion_id = crypto.randomUUID();
    await cargar();
    mensaje.value = "Dinero aplicado a la gestión.";
  });
}
async function anularMovimiento() {
  await operacion(async () => {
    const a = anulacionMovimiento.value;
    if (a.tipo === "pago") await api.pagos.anular(a.id, a.motivo);
    else await api.fondos.anular(a.tipo, a.id, a.motivo);
    anulacionMovimiento.value = { tipo: "", id: "", motivo: "" };
    await cargar();
    if (gestionDetalle.value) {
      gestionDetalle.value = await api.gestiones.detalle(
        gestionDetalle.value.gestion.id,
      );
      cuentasDetalle.value = (
        await api.saldos.cuentas({
          gestion_id: gestionDetalle.value.gestion.id,
        })
      ).cuentas;
    }
    if (seleccion.value) await actualizarDetalle();
    mensaje.value = "Operación anulada; se conserva su historial.";
  });
}
function elegirAnulacion(tipo, id) {
  anulacionMovimiento.value = { tipo, id, motivo: "" };
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function registrarMovimiento() {
  await operacion(async () => {
    const m = movimiento.value;
    const datos = {
      id: m.id,
      gestion_id: m.gestion_id,
      parte_id: m.parte_id,
      fecha: m.fecha,
      importe: centavos(m.monto),
      moneda: m.moneda,
    };
    if (m.tipo === "traslado")
      await api.fondos.trasladar({
        ...datos,
        gestion_destino_id: m.gestion_destino_id,
      });
    else await api.fondos.devolver(datos);
    m.monto = "";
    m.id = crypto.randomUUID();
    await cargar();
    mensaje.value =
      m.tipo === "traslado" ? "Traslado registrado." : "Devolución registrada.";
  });
}
onMounted(async () => {
  version.value = await versionInstalada(Capacitor.isNativePlatform(), () =>
    Aplicacion.getInfo(),
  );
});
async function iniciarDatos() {
  const abierta = await abrirApi();
  api = abierta.api;
  repo.value = abierta.repo;
  try {
    const recuperado = await borradores.obtener("compra");
    if (recuperado) {
      form.value = recuperado.form;
      form.value.catalogos ||= [];
      pago.value = { ...nuevoPago(), ...recuperado.pago };
      paso.value = Math.min(recuperado.paso, 3);
      imagenes.value = recuperado.imagenes;
      mensaje.value = "Recuperamos el borrador de tu compra.";
    }
    const ingresoGuardado = await borradores.obtener("recepcion");
    if (ingresoGuardado) {
      ingreso.value = ingresoGuardado.ingreso;
      repartoIngreso.value = ingresoGuardado.reparto;
      pasoIngreso.value = ingresoGuardado.paso;
    }
    borradorHabilitado = true;
  } catch {
    error.value =
      "No se puede acceder a los borradores. Podés consultar tus datos, pero el registro temporal no se conservará al cerrar.";
  }
  await cargar();
}
async function desbloquear() {
  await operacion(async () => {
    autenticando = true;
    try {
      await proteccion.autenticar();
    } finally {
      autenticando = false;
    }
    if (!repo.value) await iniciarDatos();
    bloqueada.value = false;
  });
}
async function cambiarSeguridad() {
  await operacion(async () => {
    autenticando = true;
    try {
      if (seguridadActiva.value) await proteccion.desactivar();
      else await proteccion.activar();
    } finally {
      autenticando = false;
    }
    seguridadActiva.value = proteccion.activa();
    mensaje.value = seguridadActiva.value
      ? "Protección activada."
      : "Protección desactivada.";
  });
}
onMounted(() => {
  if (bloqueada.value) desbloquear();
  else operacion(iniciarDatos);
});
onMounted(async () => {
  if (nativo)
    escuchadorEstado = await Aplicacion.addListener(
      "appStateChange",
      ({ isActive }) => {
        if (!isActive) {
          clearTimeout(temporizadorBorrador);
          guardarBorrador();
          if (
            seguridadActiva.value &&
            !autenticando &&
            !salidaCamara.pendiente()
          )
            bloqueada.value = true;
        }
      },
    );
  if (nativo)
    escuchadorAtras = await Aplicacion.addListener("backButton", atras);
});
onUnmounted(() => {
  escuchadorEstado?.remove();
  escuchadorAtras?.remove();
  clearTimeout(temporizadorBorrador);
});
function tipoDe(bytes) {
  return bytes[0] === 137 ? "image/png" : "image/jpeg";
}
async function agregar(bytes, clase = "otro") {
  const tipo = tipoDe(bytes);
  verificarImagen(bytes, tipo);
  imagenes.value.push({ bytes, tipo, clase });
}
async function adjuntar(event) {
  await operacion(async () => {
    for (const f of event.target.files)
      await agregar(new Uint8Array(await f.arrayBuffer()));
    event.target.value = "";
  });
}
async function camara() {
  await operacion(async () => {
    const foto = await salidaCamara.ejecutar(() =>
      Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      }),
    );
    const base64 = foto.dataUrl?.split(",")[1];
    if (!base64) throw new Error("La cámara no devolvió una imagen.");
    await agregar(base64ABytes(base64));
  });
}
function editarBorrador(indice) {
  const imagen = imagenes.value[indice];
  editor.value = {
    tipo: "borrador",
    indice,
    src: `data:${imagen.tipo};base64,${bytesABase64(imagen.bytes)}`,
    ajuste: imagen.ajuste || {},
  };
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function editarGuardado(vista) {
  await operacion(async () => {
    const { anexo } = await api.anexos.obtener(vista.id);
    editor.value = {
      tipo: "guardada",
      id: vista.id,
      src: vista.src,
      ajuste: anexo,
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
async function guardarAjusteImagen(ajuste) {
  await operacion(async () => {
    if (editor.value.tipo === "borrador")
      imagenes.value[editor.value.indice].ajuste = ajuste;
    else {
      await api.anexos.ajustar(editor.value.id, ajuste);
      await actualizarDetalle();
    }
    editor.value = null;
    mensaje.value = "Ajustes guardados; la imagen original se conserva.";
  });
}
async function adjuntarExistente(event) {
  const archivosElegidos = [...event.target.files];
  event.target.value = "";
  if (!archivosElegidos.length) return;
  await operacion(async () => {
    const nuevas = [];
    for (const archivo of archivosElegidos) {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const tipo = tipoDe(bytes);
      verificarImagen(bytes, tipo);
      nuevas.push({ bytes, tipo, clase: claseNuevoComprobante.value });
    }
    await guardarComprobantesExistentes(nuevas);
  });
}
async function guardarComprobantesExistentes(nuevas) {
  await api.comprobantes.agregar(seleccion.value.id, nuevas);
  await cargar();
  await actualizarDetalle();
  fotos.value = detalleCompra.value.fotos;
  vistas.value = [];
  for (const foto of fotos.value) {
    const { bytes } = await api.comprobantes.original(foto.id);
    vistas.value.push({
      id: foto.id,
      clase: foto.clase,
      src: `data:${foto.tipo};base64,${bytesABase64(bytes)}`,
    });
  }
  mensaje.value = "Comprobantes agregados.";
}
async function camaraExistente() {
  await operacion(async () => {
    const foto = await salidaCamara.ejecutar(() =>
      Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      }),
    );
    const base64 = foto.dataUrl?.split(",")[1];
    if (!base64) throw new Error("La cámara no devolvió una imagen.");
    const bytes = base64ABytes(base64),
      tipo = tipoDe(bytes);
    verificarImagen(bytes, tipo);
    await guardarComprobantesExistentes([
      { bytes, tipo, clase: claseNuevoComprobante.value },
    ]);
  });
}
async function iniciarGestion() {
  await operacion(async () => {
    const g = {
      id: crypto.randomUUID(),
      nombre: nombreGestion.value.trim(),
      fecha_inicio: inicioGestion.value,
      fecha_fin: null,
    };
    await api.gestiones.crear(g);
    await cargar();
    nombreGestion.value = "";
    inicioGestion.value = hoy();
    form.value.gestion_id = g.id;
    ir("registro");
    paso.value = 1;
    mensaje.value = "Gestión iniciada. Podés registrar la primera compra.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
async function terminarGestion() {
  await operacion(async () => {
    await api.gestiones.cerrar(cierreId.value, fechaCierre.value);
    cierreId.value = null;
    await cargar();
    mensaje.value = "Gestión terminada. Sus compras siguen disponibles.";
  });
}
async function reabrirGestion() {
  await operacion(async () => {
    await api.gestiones.reabrir(reapertura.value.id, reapertura.value.motivo);
    reapertura.value = { id: "", motivo: "" };
    await cargar();
    mensaje.value = "Gestión reabierta; se conserva el cierre anterior.";
  });
}
async function verGestion(id) {
  await operacion(async () => {
    gestionDetalle.value = await api.gestiones.detalle(id);
    cuentasDetalle.value = (
      await api.saldos.cuentas({ gestion_id: id })
    ).cuentas;
    ir("gestion-detalle");
  });
}
async function actualizarDetalle() {
  detalleCompra.value = await api.compras.detalle(seleccion.value.id);
  seleccion.value = detalleCompra.value.compra;
}
async function registrarAbono() {
  await operacion(async () => {
    const p = abono.value;
    await api.pagos.registrar({
      id: p.id,
      compra_id: seleccion.value.id,
      fecha: p.fecha,
      importe: centavos(p.monto),
      origen: p.origen,
      parte_id: p.origen === "propio" ? null : p.parte_id,
      asignacion_id: p.asignacion_id || null,
    });
    p.monto = "";
    p.id = crypto.randomUUID();
    await cargar();
    await actualizarDetalle();
    mensaje.value = "Pago registrado sin duplicar la compra.";
  });
}
async function anularCompra() {
  await operacion(async () => {
    await api.compras.anular(seleccion.value.id, motivoCompra.value);
    motivoCompra.value = "";
    await cargar();
    await actualizarDetalle();
    mensaje.value = "Compra anulada; se conserva su historial.";
  });
}
async function clasificarCompra() {
  await operacion(async () => {
    await api.compras.clasificarPago(seleccion.value.id, {
      forma_pago: clasificacion.value.forma_pago,
      deudor_id:
        clasificacion.value.forma_pago === "credito"
          ? clasificacion.value.deudor_id
          : null,
    });
    await cargar();
    await actualizarDetalle();
    mensaje.value = "Forma de pago registrada.";
  });
}
async function corregirCompra() {
  await operacion(async () => {
    const c = correccionCompra.value;
    await api.compras.corregir(
      seleccion.value.id,
      { concepto: c.concepto, proveedor: c.proveedor, factura: c.factura },
      c.motivo,
    );
    c.visible = false;
    c.motivo = "";
    await cargar();
    await actualizarDetalle();
    mensaje.value =
      "Datos corregidos; los valores anteriores quedan en el historial.";
  });
}
async function quitarReparto() {
  await operacion(async () => {
    await api.compras.asignar(seleccion.value.id, [], motivoReparto.value);
    motivoReparto.value = "";
    await cargar();
    await actualizarDetalle();
    mensaje.value = "Reparto anulado; se conserva el historial.";
  });
}
async function corregirEconomia() {
  await operacion(async () => {
    const c = correccionEconomica.value;
    const r = await api.compras.corregirEconomia(
      seleccion.value.id,
      { id: c.id, importe: centavos(c.monto), moneda: c.moneda },
      c.motivo,
    );
    seleccion.value = r.compra;
    c.visible = false;
    await cargar();
    await actualizarDetalle();
    fotos.value = detalleCompra.value.fotos;
    vistas.value = [];
    for (const foto of fotos.value) {
      const { bytes } = await api.comprobantes.original(foto.id);
      vistas.value.push({
        id: foto.id,
        clase: foto.clase,
        src: `data:${foto.tipo};base64,${bytesABase64(bytes)}`,
      });
    }
    mensaje.value =
      "Corrección registrada. La compra original queda anulada y vinculada a esta.";
  });
}
function elegirGestion(id) {
  form.value.gestion_id = id;
  ir("registro");
}
function avanzar() {
  error.value = "";
  if (paso.value === 2) {
    if (
      !form.value.concepto.trim() ||
      !form.value.fecha_compra ||
      !form.value.proveedor.trim()
    ) {
      error.value = "Completá concepto, fecha y proveedor.";
      return;
    }
    try {
      centavos(form.value.monto);
    } catch (e) {
      error.value = e.message;
      return;
    }
  }
  if (paso.value === 3) {
    try {
      if (
        ["fondo", "combinado"].includes(pago.value.tipo) &&
        !saldos.value.some(
          (s) =>
            s.tipo === "custodia" &&
            s.gestion_id === form.value.gestion_id &&
            s.moneda === form.value.moneda &&
            s.parte_id === pago.value.parte_id &&
            s.importe > 0,
        )
      )
        throw new Error(
          "Elegí una fuente con fondos disponibles en esta gestión y moneda.",
        );
      prepararCompraFinanciera(
        { ...form.value, importe: centavos(form.value.monto) },
        pago.value,
      );
    } catch (e) {
      error.value = e.message;
      return;
    }
  }
  paso.value = Math.min(4, paso.value + 1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function retroceder() {
  error.value = "";
  paso.value = Math.max(1, paso.value - 1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function guardar() {
  await operacion(async () => {
    const c = {
      ...form.value,
      gestion_id: form.value.gestion_id || null,
      importe: centavos(form.value.monto),
    };
    delete c.monto;
    const entrada = prepararCompraFinanciera(c, pago.value);
    const { creada } = await api.compras.registrar({
      ...entrada,
      imagenes: imagenes.value,
    });
    pausaBorrador = true;
    clearTimeout(temporizadorBorrador);
    try {
      if (borradorHabilitado) await borradores.descartar("compra");
      const gestionActiva = form.value.gestion_id;
      form.value = nuevo();
      form.value.gestion_id = gestionActiva;
      paso.value = 1;
      imagenes.value = [];
      pago.value = nuevoPago();
    } finally {
      pausaBorrador = false;
    }
    await cargar();
    ir("compras");
    window.scrollTo({ top: 0, behavior: "smooth" });
    mensaje.value = creada
      ? "Compra guardada en el dispositivo."
      : "Esta compra ya estaba guardada.";
  });
}
async function ver(c) {
  await operacion(async () => {
    seleccion.value = c;
    await actualizarDetalle();
    correccionCompra.value = {
      visible: false,
      concepto: c.concepto,
      proveedor: c.proveedor,
      factura: c.factura,
      motivo: "",
    };
    correccionEconomica.value = {
      visible: false,
      id: crypto.randomUUID(),
      monto: (c.importe / 100).toFixed(2),
      moneda: c.moneda,
      motivo: "",
    };
    ir("detalle");
    window.scrollTo({ top: 0, behavior: "smooth" });
    fotos.value = await repo.value.fotos(c.id);
    vistas.value = [];
    for (const foto of fotos.value) {
      const bytes = await archivos.leer(foto.ruta);
      if ((await huella(bytes)) !== foto.sha256)
        throw new Error("Un comprobante falta o está alterado.");
      vistas.value.push({
        id: foto.id,
        clase: foto.clase,
        src: `data:${foto.tipo};base64,${bytesABase64(bytes)}`,
      });
    }
  });
}
async function exportar(formato, conFotos = true) {
  await operacion(async () => {
    const c = seleccion.value;
    if (!c) return;
    const bytes =
      formato === "xlsx"
        ? await excel(c, fotos.value, archivos, conFotos)
        : await pdf(
            c,
            fotos.value,
            archivos,
            encabezado.value,
            detalleCompra.value?.anexos || [],
          );
    await compartir(
      `compra-${c.id}.${formato}`,
      bytes,
      formato === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf",
    );
  });
}
const comprasDelInforme = computed(() =>
  informeGestion.value
    ? compras.value
        .filter(
          (c) =>
            c.gestion_id === informeGestion.value.id &&
            c.fecha_compra <= informeForm.value.corte,
        )
        .sort((a, b) => a.fecha_compra.localeCompare(b.fecha_compra))
    : [],
);
function prepararInformeDe(g) {
  const corte =
    g.fecha_fin || (hoy() < g.fecha_inicio ? g.fecha_inicio : hoy());
  informeGestion.value = g;
  informeForm.value = {
    titulo: ajustes.value.encabezado || "Informe de gastos",
    responsable: ajustes.value.responsable,
    destinatario: ajustes.value.destinatario,
    destinatario_id: "",
    corte,
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: true,
  };
  informeSeleccion.value = compras.value
    .filter((c) => c.gestion_id === g.id)
    .map((c) => c.id);
  ir("preparar-informe");
}
async function emitir() {
  await operacion(async () => {
    const g = informeGestion.value,
      f = informeForm.value;
    const elegidas = comprasDelInforme.value.filter((c) =>
      informeSeleccion.value.includes(c.id),
    );
    const { informe: registro } = await api.informes.emitir({
      alcance: { tipo: "gestion", gestion_id: g.id },
      opciones: {
        ...f,
        titulo: f.titulo.trim(),
        responsable: f.responsable.trim(),
        destinatario: f.destinatario.trim(),
        compras: elegidas.map((c) => c.id),
      },
    });
    await repo.value.guardarAjustes({
      encabezado: f.titulo.trim(),
      responsable: f.responsable.trim(),
      destinatario: f.destinatario.trim(),
    });
    await cargar();
    await cargarInformes();
    ir("informes");
    window.scrollTo({ top: 0, behavior: "smooth" });
    mensaje.value = `Informe ${registro.codigo} emitido (revisión ${registro.revision}) y guardado ${
      Capacitor.getPlatform() === "android"
        ? `en Documentos/${CARPETA_INFORMES}`
        : nativo
          ? "dentro de la aplicación"
          : "en este navegador de prueba"
    }.`;
  });
}
async function previsualizarGestion() {
  await operacion(async () => {
    const elegidas = comprasDelInforme.value.filter((c) =>
      informeSeleccion.value.includes(c.id),
    );
    const r = await api.informes.previsualizar({
      alcance: { tipo: "gestion", gestion_id: informeGestion.value.id },
      opciones: { ...informeForm.value, compras: elegidas.map((c) => c.id) },
    });
    await compartir(`vista-previa-${r.codigo}.pdf`, r.bytes, "application/pdf");
    mensaje.value = `Vista previa: ${r.filas} compras y ${r.anexos} anexos; no se emitió una revisión.`;
  });
}
async function cargarInformes() {
  revisiones.value = (await api.informes.listar()).map((r) => ({
    ...r,
    estado:
      r.privado_estado === "verificado" ? "verificado" : r.compartido_estado,
    nombre: gestiones.value.find((g) => g.id === r.gestion_id)?.nombre,
  }));
  informesSinRegistro.value = await api.informes.sinRegistro();
}
async function abrirInformes() {
  await operacion(async () => {
    await cargarInformes();
    ir("informes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
const ESTADO_ARCHIVO = {
  verificado: "Archivo verificado",
  alterado: "El archivo guardado cambió: se entrega una copia regenerada",
  ausente: "Archivo no encontrado: se entrega una copia regenerada",
};
async function abrirRevision(r) {
  await operacion(async () => {
    const { bytes, nombre } = await api.informes.abrir(r.id);
    await compartir(nombre, bytes, "application/pdf");
  });
}
async function excelRevision(r) {
  await operacion(async () => {
    const { bytes, nombre } = await api.informes.excel(r.id);
    await compartir(
      nombre,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
}
function etiquetaInforme(nombre) {
  const match = nombre.match(/^informe-gestion-(.+?)--(\d{8}T\d{6})--/);
  if (!match) return nombre;
  const g = gestiones.value.find((item) => item.id === match[1]);
  const d = match[2];
  return `${g?.nombre || "Gestión no disponible"} · ${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} ${d.slice(9, 11)}:${d.slice(11, 13)} UTC`;
}
const fechaVista = (iso) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
async function abrirInforme(nombre) {
  await operacion(async () => {
    const bytes = await informesCompartidos.leer(nombre);
    await compartir(nombre, bytes, "application/pdf");
  });
}
async function guardarEncabezado() {
  await operacion(async () => {
    await repo.value.guardarAjuste(encabezado.value.trim());
    mensaje.value = "Encabezado guardado.";
  });
}
async function respaldo() {
  await operacion(async () => {
    const { bytes } = await api.respaldo.crear();
    await compartir(`respaldo-gastos-${hoy()}.zip`, bytes, "application/zip");
    mensaje.value = "Respaldo preparado. Guardalo en un lugar privado.";
  });
}
async function restaurar(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (
    !confirm(
      "Restaurar reemplazará las compras actuales por las del respaldo. ¿Continuar?",
    )
  )
    return;
  await operacion(async () => {
    const resultado = await api.respaldo.restaurar(
      new Uint8Array(await file.arrayBuffer()),
    );
    seleccion.value = null;
    fotos.value = [];
    vistas.value = [];
    await cargar();
    mensaje.value = `Restauración completa: ${resultado.compras} compras, ${resultado.fotos} comprobantes y ${resultado.informes} informes emitidos.`;
  });
}
</script>
<template>
  <div class="app-shell" :style="variablesTema(preferencias.tema)">
    <main v-if="bloqueada" class="wrap main">
      <section class="card">
        <h1>Mis gastos</h1>
        <p>Desbloqueá con la seguridad configurada en tu teléfono.</p>
        <p v-if="error" class="alert error" role="alert">{{ error }}</p>
        <button
          type="button"
          class="primary"
          :disabled="ocupado"
          @click="desbloquear"
        >
          Desbloquear
        </button>
      </section>
    </main>
    <div v-show="!bloqueada">
      <InicioGuiado
        v-if="pantalla === 'inicio' && preferencias.guiada"
        :compras="compras"
        :gestiones="gestiones"
        :saldos="saldos"
        :partes="partesTodas"
        :aprendizaje="preferencias.aprendizaje"
        :tema="preferencias.tema"
        @registrar="ir('guiado')"
        @ir="irDesdeGuiado"
        @aprendizaje="(v) => cambiarPreferencia({ aprendizaje: v })"
        @tema="(v) => cambiarPreferencia({ tema: v })"
        @clasica="cambiarPreferencia({ guiada: false })"
      />
      <AsistenteGasto
        v-if="pantalla === 'guiado'"
        ref="asistente"
        :api="api"
        :gestiones="gestiones"
        :partes="partes"
        :saldos="saldos"
        :aprendizaje="preferencias.aprendizaje"
        :tema="preferencias.tema"
        :nativo="nativo"
        :abrir-camara="
          (opciones) => salidaCamara.ejecutar(() => Camera.getPhoto(opciones))
        "
        :fecha="hoy()"
        @aprendizaje="(v) => cambiarPreferencia({ aprendizaje: v })"
        @guardado="cargar"
        @cerrar="cerrarAsistente"
      />
      <RecibirGuiado
        v-if="pantalla === 'guiado-recibir'"
        ref="asistente"
        :api="api"
        :gestiones="gestiones"
        :partes="partes"
        :saldos="saldos"
        :aprendizaje="preferencias.aprendizaje"
        :tema="preferencias.tema"
        :fecha="hoy()"
        @aprendizaje="(v) => cambiarPreferencia({ aprendizaje: v })"
        @guardado="cargar"
        @cerrar="cerrarAsistente"
      />
      <InformeGuiado
        v-if="pantalla === 'guiado-informe'"
        ref="asistente"
        :api="api"
        :gestiones="gestiones"
        :partes="partes"
        :ajustes="ajustes"
        :aprendizaje="preferencias.aprendizaje"
        :tema="preferencias.tema"
        :fecha="hoy()"
        @aprendizaje="(v) => cambiarPreferencia({ aprendizaje: v })"
        @emitido="cargar"
        @cerrar="cerrarAsistente"
      />
      <VerComoVoy
        v-if="pantalla === 'guiado-estado'"
        :api="api"
        :gestiones="gestiones"
        :partes="partesTodas"
        :compras="compras"
        :tema="preferencias.tema"
        :aprendizaje="preferencias.aprendizaje"
        @aprendizaje="(v) => cambiarPreferencia({ aprendizaje: v })"
        @cerrar="ir('inicio')"
        @gestion="verGestion"
        @compra="
          (id) => {
            const c = compras.find((x) => x.id === id);
            if (c) ver(c);
          }
        "
        @registrar="ir('guiado')"
        @recibir="ir('fondos')"
      />
      <header v-if="!vistaGuiada" class="top">
        <div class="wrap">
          <span class="eyebrow">REGISTRO SIN CONEXIÓN</span>
          <img :src="iconoGastos" class="icono-app" alt="" />
          <h1>Mis gastos</h1>
          <p>Compras y comprobantes en tu dispositivo.</p>
        </div>
      </header>
      <main class="wrap main" :class="{ 'tras-guiada': vistaGuiada }">
        <p v-if="error" class="alert error" role="alert">{{ error }}</p>
        <p v-if="mensaje" class="alert success" role="status">{{ mensaje }}</p>
        <form
          v-if="anulacionMovimiento.id"
          class="card step-fields"
          @submit.prevent="anularMovimiento"
        >
          <h3>Anular operación</h3>
          <p class="hint">
            El historial se conserva; la operación se valida antes de aplicarse.
          </p>
          <label
            >Motivo<input
              v-model.trim="anulacionMovimiento.motivo"
              minlength="3"
              maxlength="300"
              required /></label
          ><button type="submit" class="secondary" :disabled="ocupado">
            Confirmar anulación</button
          ><button
            type="button"
            class="text-control"
            @click="anulacionMovimiento.id = ''"
          >
            Cancelar
          </button>
        </form>
        <EditorComprobante
          v-if="editor"
          :key="`${editor.tipo}-${editor.id || editor.indice}`"
          :src="editor.src"
          :inicial="editor.ajuste"
          @guardar="guardarAjusteImagen"
          @cancelar="editor = null"
        />
        <section
          v-show="pantalla === 'inicio' && !preferencias.guiada"
          class="welcome"
        >
          <button
            type="button"
            class="primary"
            @click="cambiarPreferencia({ guiada: true })"
          >
            Usar Modo Fácil, paso a paso
          </button>
          <div class="welcome-copy">
            <span class="section-kicker">TU ESPACIO</span>
            <h2>Tu día, más claro.</h2>
            <p>
              Registrá una compra o revisá tus comprobantes cuando lo necesités.
            </p>
          </div>
          <button
            type="button"
            class="developer-signature"
            aria-label="Acerca de Mis gastos"
            @click="ir('acerca')"
          >
            Desarrollado por W. Gutiérrez
          </button>
          <button
            class="primary welcome-button"
            type="button"
            @click="ir('gestiones')"
          >
            <span class="plus">＋</span> Iniciar gestión
          </button>
          <div class="quick-links">
            <button type="button" @click="ir('fondos')">
              <span>＋</span><strong>Recibir dinero</strong
              ><small>Fondos de una gestión</small>
            </button>
            <button type="button" @click="todasLasCompras()">
              <span>▤</span><strong>Mis compras</strong
              ><small
                >{{ compras.length }}
                {{ compras.length === 1 ? "registro" : "registros" }}</small
              ></button
            ><button type="button" @click="ir('respaldo')">
              <span>↥</span><strong>Informes y respaldo</strong
              ><small>Configuración y copias</small>
            </button>
          </div>
        </section>
        <section
          v-show="pantalla === 'acerca'"
          class="card about-card"
          aria-labelledby="acerca-titulo"
        >
          <button type="button" class="back-link" @click="ir('inicio')">
            ← Volver a Inicio
          </button>
          <div class="about-heading">
            <div>
              <span class="section-kicker">MIS GASTOS</span>
              <h2 id="acerca-titulo">Acerca de</h2>
            </div>
          </div>
          <p class="about-description">Compras y comprobantes, a tu alcance.</p>
          <div class="about-detail">
            <span>Desarrollo</span
            ><strong>Desarrollado por W. Gutiérrez</strong>
          </div>
          <div class="about-detail">
            <span>Versión</span><strong>{{ version }}</strong>
          </div>
        </section>
        <section v-show="pantalla === 'fondos'" class="card">
          <button type="button" class="back-link" @click="ir('inicio')">
            ← Volver a Inicio
          </button>
          <h2>Dinero de mis gestiones</h2>
          <p class="hint">
            Registrá cada entrega por separado. El dinero recibido es custodia,
            no una ganancia.
          </p>
          <h3>Personas y empresas</h3>
          <form class="step-fields" @submit.prevent="crearParte">
            <label
              >Nombre<input
                v-model.trim="nombreParte"
                maxlength="120"
                required
                placeholder="Quién entrega o recibe"
            /></label>
            <label
              >Tipo<select v-model="tipoParte">
                <option value="persona">Persona</option>
                <option value="empresa">Empresa</option>
              </select></label
            >
            <button
              class="secondary"
              type="submit"
              :disabled="ocupado || !repo"
            >
              Guardar persona o empresa
            </button>
          </form>
          <div v-for="p in partesTodas" :key="p.id" class="gestion-item">
            <strong>{{ p.nombre }}</strong
            ><span class="hint">
              · {{ p.tipo }} · {{ p.activa ? "Activa" : "Inactiva" }}</span
            ><button
              v-if="p.activa"
              type="button"
              class="text-control"
              @click="desactivarParte.id = p.id"
            >
              Desactivar
            </button>
            <button
              type="button"
              class="text-control"
              @click="parteEdicion = { id: p.id, nombre: p.nombre, motivo: '' }"
            >
              Editar nombre
            </button>
            <button
              type="button"
              class="text-control"
              @click="mostrarRoles(p.id)"
            >
              Ver roles
            </button>
          </div>
          <form
            v-if="parteEdicion.id"
            class="step-fields"
            @submit.prevent="guardarParteEditada"
          >
            <label
              >Nombre<input
                v-model.trim="parteEdicion.nombre"
                maxlength="120"
                required /></label
            ><label
              >Motivo<input
                v-model.trim="parteEdicion.motivo"
                minlength="3"
                maxlength="300"
                required /></label
            ><button type="submit" class="secondary" :disabled="ocupado">
              Guardar nombre</button
            ><button
              type="button"
              class="text-control"
              @click="parteEdicion.id = ''"
            >
              Cancelar
            </button>
          </form>
          <div v-if="parteDetalle" class="gestion-item">
            <strong>Roles de {{ parteDetalle.parte.nombre }}</strong>
            <p v-for="(ids, rol) in parteDetalle.roles" :key="rol" class="hint">
              {{ rol.replaceAll("_", " ") }}: {{ ids.length }}
            </p>
            <button
              type="button"
              class="text-control"
              @click="parteDetalle = null"
            >
              Cerrar roles
            </button>
          </div>
          <form
            v-if="desactivarParte.id"
            class="step-fields"
            @submit.prevent="desactivarPersona"
          >
            <label
              >Motivo<input
                v-model.trim="desactivarParte.motivo"
                minlength="3"
                maxlength="300"
                required /></label
            ><button type="submit" class="secondary" :disabled="ocupado">
              Confirmar desactivación</button
            ><button
              type="button"
              class="text-control"
              @click="desactivarParte.id = ''"
            >
              Cancelar
            </button>
          </form>
          <h3>Recibir dinero</h3>
          <form class="step-fields" @submit.prevent="recibirDinero">
            <p class="hint">Paso {{ pasoIngreso }} de 4</p>
            <div v-if="pasoIngreso === 1" class="step-fields">
              <label
                >Buscar persona o empresa<input
                  v-model.trim="buscarIngreso"
                  placeholder="Escribí un nombre"
              /></label>
              <label
                >Quién entrega<select v-model="ingreso.parte_id" required>
                  <option value="">Elegí una persona o empresa</option>
                  <option
                    v-for="p in partes.filter((p) =>
                      p.nombre
                        .toLocaleLowerCase()
                        .includes(buscarIngreso.toLocaleLowerCase()),
                    )"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.nombre }}
                  </option>
                </select></label
              >
              <label
                >Nuevo nombre<input
                  v-model.trim="nuevoIngresoParte.nombre"
                  maxlength="120"
              /></label>
              <label
                >Tipo<select v-model="nuevoIngresoParte.tipo">
                  <option value="persona">Persona</option>
                  <option value="empresa">Empresa</option>
                </select></label
              >
              <button
                type="button"
                class="secondary"
                @click="crearParteIngreso"
              >
                Crear y seleccionar
              </button>
            </div>
            <div v-if="pasoIngreso === 3" class="step-fields">
              <label
                >Fecha<input v-model="ingreso.fecha" type="date" required
              /></label>
              <label
                >Importe<input
                  v-model="ingreso.monto"
                  inputmode="decimal"
                  placeholder="0.00"
                  required
              /></label>
              <label
                >Moneda<select v-model="ingreso.moneda">
                  <option value="NIO">Córdobas (C$)</option>
                  <option value="USD">Dólares (US$)</option>
                </select></label
              >
              <label
                >Referencia <small>(opcional)</small
                ><input v-model="ingreso.referencia" maxlength="120"
              /></label>
            </div>
            <div v-if="pasoIngreso === 2" class="step-fields">
              <label
                >Beneficiario del encargo <small>(opcional)</small
                ><select v-model="ingreso.beneficiario_id">
                  <option value="">Sin indicar</option>
                  <option v-for="p in partes" :key="p.id" :value="p.id">
                    {{ p.nombre }}
                  </option>
                </select></label
              >
              <label
                >Finalidad del dinero <small>(opcional)</small
                ><input v-model.trim="ingreso.finalidad" maxlength="500"
              /></label>
              <p class="hint">
                Agregá las gestiones y el importe para cada una. Lo no asignado
                queda disponible para aplicar después.
              </p>
              <div
                v-for="(a, indice) in repartoIngreso"
                :key="indice"
                class="step-fields"
              >
                <label
                  >Gestión<select v-model="a.gestion_id" required>
                    <option value="">Elegí una gestión</option>
                    <option v-for="g in gestiones" :key="g.id" :value="g.id">
                      {{ g.nombre }}
                    </option>
                  </select></label
                >
                <label
                  >Importe a aplicar<input
                    v-model="a.monto"
                    inputmode="decimal"
                    required
                /></label>
                <label
                  >Uso<select v-model="a.destino">
                    <option value="anticipo">Dinero para compras</option>
                    <option value="reembolso">Reembolso de mi adelanto</option>
                  </select></label
                >
                <button
                  class="text-control"
                  type="button"
                  @click="repartoIngreso.splice(indice, 1)"
                >
                  Quitar aplicación
                </button>
              </div>
              <button
                class="secondary"
                type="button"
                @click="
                  repartoIngreso.push({
                    gestion_id: '',
                    monto: '',
                    destino: 'anticipo',
                  })
                "
              >
                Agregar gestión
              </button>
              <details>
                <summary>Crear gestión nueva</summary>
                <label
                  >Nombre<input
                    v-model.trim="nuevaGestionIngreso.nombre"
                    maxlength="120"
                /></label>
                <label
                  >Fecha de inicio<input
                    v-model="nuevaGestionIngreso.fecha_inicio"
                    type="date"
                /></label>
                <label
                  >Responsable<select
                    v-model="nuevaGestionIngreso.responsable_id"
                  >
                    <option value="">Sin indicar</option>
                    <option v-for="p in partes" :key="p.id" :value="p.id">
                      {{ p.nombre }}
                    </option>
                  </select></label
                >
                <label
                  >Finalidad o descripción<input
                    v-model.trim="nuevaGestionIngreso.descripcion"
                    maxlength="500"
                /></label>
                <button
                  type="button"
                  class="secondary"
                  @click="crearGestionIngreso"
                >
                  Crear gestión
                </button>
              </details>
            </div>
            <div v-if="pasoIngreso === 4" class="step-fields">
              <strong>Revisá antes de guardar</strong>
              <p>
                Entrega:
                {{ partesTodas.find((p) => p.id === ingreso.parte_id)?.nombre }}
                · {{ ingreso.monto }} {{ ingreso.moneda }} · {{ ingreso.fecha }}
              </p>
              <p>
                Beneficiario:
                {{
                  partesTodas.find((p) => p.id === ingreso.beneficiario_id)
                    ?.nombre || "No indicado"
                }}
                · Finalidad: {{ ingreso.finalidad || "No indicada" }}
              </p>
              <p v-for="(a, i) in repartoIngreso" :key="i">
                {{ gestiones.find((g) => g.id === a.gestion_id)?.nombre }} ·
                {{ a.destino === "anticipo" ? "Para compras" : "Reembolso" }} ·
                {{ a.monto }} {{ ingreso.moneda }}
              </p>
              <p>
                Sin aplicar:
                {{
                  (
                    (centavos(ingreso.monto) -
                      prepararAplicaciones(repartoIngreso).reduce(
                        (n, a) => n + a.importe,
                        0,
                      )) /
                    100
                  ).toFixed(2)
                }}
                {{ ingreso.moneda }}
              </p>
            </div>
            <div class="step-actions">
              <button
                v-if="pasoIngreso > 1"
                class="secondary"
                type="button"
                @click="pasoIngreso--"
              >
                Atrás
              </button>
              <button
                v-if="pasoIngreso < 4"
                class="primary"
                type="button"
                @click="avanzarIngreso"
              >
                Continuar
              </button>
              <button
                v-else
                class="primary"
                type="submit"
                :disabled="ocupado || !repo"
              >
                Guardar dinero recibido
              </button>
            </div>
          </form>
          <div v-if="ultimaRecepcion" class="gestion-item">
            <strong>Recepción guardada</strong>
            <p>
              {{ ultimaRecepcion.parte }} ·
              {{ (ultimaRecepcion.importe / 100).toFixed(2) }}
              {{ ultimaRecepcion.moneda }} · {{ ultimaRecepcion.fecha }}
            </p>
            <p>
              Aplicado:
              {{
                (
                  ultimaRecepcion.aplicaciones.reduce(
                    (n, a) => n + a.importe,
                    0,
                  ) / 100
                ).toFixed(2)
              }}
              · Sin aplicar:
              {{
                (
                  (ultimaRecepcion.importe -
                    ultimaRecepcion.aplicaciones.reduce(
                      (n, a) => n + a.importe,
                      0,
                    )) /
                  100
                ).toFixed(2)
              }}
              {{ ultimaRecepcion.moneda }}
            </p>
          </div>
          <h3>Devolver o trasladar fondos</h3>
          <form class="step-fields" @submit.prevent="registrarMovimiento">
            <label
              >Operación<select v-model="movimiento.tipo">
                <option value="devolucion">Devolver dinero</option>
                <option value="traslado">Trasladar a otra gestión</option>
              </select></label
            >
            <label
              >Dueño de los fondos<select
                v-model="movimiento.parte_id"
                required
              >
                <option value="">Elegí una persona o empresa</option>
                <option v-for="p in partes" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select></label
            >
            <label
              >Gestión de origen<select
                v-model="movimiento.gestion_id"
                required
              >
                <option value="">Elegí una gestión</option>
                <option v-for="g in gestiones" :key="g.id" :value="g.id">
                  {{ g.nombre }}
                </option>
              </select></label
            >
            <label v-if="movimiento.tipo === 'traslado'"
              >Gestión de destino<select
                v-model="movimiento.gestion_destino_id"
                required
              >
                <option value="">Elegí otra gestión</option>
                <option
                  v-for="g in gestiones.filter(
                    (item) => item.id !== movimiento.gestion_id,
                  )"
                  :key="g.id"
                  :value="g.id"
                >
                  {{ g.nombre }}
                </option>
              </select></label
            >
            <label
              >Fecha<input v-model="movimiento.fecha" type="date" required
            /></label>
            <label
              >Importe<input
                v-model="movimiento.monto"
                inputmode="decimal"
                required
            /></label>
            <label
              >Moneda<select v-model="movimiento.moneda">
                <option value="NIO">Córdobas (C$)</option>
                <option value="USD">Dólares (US$)</option>
              </select></label
            >
            <button
              class="secondary"
              type="submit"
              :disabled="ocupado || !repo"
            >
              Registrar operación
            </button>
          </form>
          <h3>Saldos por gestión</h3>
          <p v-if="!saldos.length" class="hint">
            Todavía no hay saldos pendientes.
          </p>
          <div
            v-for="s in saldos"
            :key="`${s.tipo}-${s.gestion_id}-${s.parte_id}-${s.moneda}-${s.compra_id || ''}`"
            class="gestion-item"
          >
            <strong
              >{{
                {
                  custodia: "Disponible en custodia",
                  por_reembolsar: "Por reembolsar",
                  por_regularizar: "Por regularizar",
                  deuda_proveedor: "Deuda con proveedor",
                }[s.tipo]
              }}: {{ dinero(s.importe, s.moneda) }}</strong
            >
            <p class="hint">
              {{
                gestiones.find((g) => g.id === s.gestion_id)?.nombre ||
                "Sin gestión"
              }}
              ·
              {{
                partesTodas.find((p) => p.id === s.parte_id)?.nombre ||
                "Parte no disponible"
              }}
              <span v-if="s.proveedor">· {{ s.proveedor }}</span>
            </p>
          </div>
          <h3>Entradas de dinero</h3>
          <form class="step-fields" @submit.prevent="aplicarDinero">
            <h4>Aplicar dinero pendiente</h4>
            <label
              >Entrada con dinero sin aplicar<select
                v-model="aplicarIngreso.id"
                required
              >
                <option value="">Elegí una entrada</option>
                <option
                  v-for="r in recepciones.filter(
                    (item) => item.sin_aplicar > 0 && !item.anulada,
                  )"
                  :key="r.id"
                  :value="r.id"
                >
                  {{ r.fecha }} · {{ dinero(r.sin_aplicar, r.moneda) }} ·
                  {{
                    partesTodas.find((p) => p.id === r.parte_id)?.nombre ||
                    "Parte"
                  }}
                </option>
              </select></label
            >
            <label
              >Gestión<select v-model="aplicarIngreso.gestion_id" required>
                <option value="">Elegí una gestión</option>
                <option v-for="g in gestiones" :key="g.id" :value="g.id">
                  {{ g.nombre }}
                </option>
              </select></label
            >
            <label
              >Importe<input
                v-model="aplicarIngreso.monto"
                inputmode="decimal"
                required
            /></label>
            <label
              >Uso<select v-model="aplicarIngreso.destino">
                <option value="anticipo">Dinero para compras</option>
                <option value="reembolso">Reembolso de mi adelanto</option>
              </select></label
            >
            <button
              class="secondary"
              type="submit"
              :disabled="ocupado || !repo"
            >
              Aplicar dinero
            </button>
          </form>
          <p v-if="!recepciones.length" class="hint">
            Todavía no registraste entregas.
          </p>
          <div v-for="r in recepciones" :key="r.id" class="gestion-item">
            <strong
              >{{ dinero(r.importe, r.moneda) }} ·
              {{
                partesTodas.find((p) => p.id === r.parte_id)?.nombre ||
                "Parte no disponible"
              }}</strong
            >
            <p class="hint">
              {{ r.fecha }} <span v-if="r.referencia">· {{ r.referencia }}</span
              ><span v-if="r.anulada"> · Anulada</span
              ><span v-if="r.sin_aplicar">
                · Sin aplicar: {{ dinero(r.sin_aplicar, r.moneda) }}</span
              >
            </p>
            <p v-for="a in r.aplicaciones" :key="a.id" class="hint">
              {{
                gestiones.find((g) => g.id === a.gestion_id)?.nombre ||
                "Gestión"
              }}
              · {{ a.destino === "anticipo" ? "Anticipo" : "Reembolso" }} ·
              {{ dinero(a.importe, r.moneda)
              }}<span v-if="a.anulada"> · Anulada</span>
              <button
                v-if="!a.anulada"
                type="button"
                class="text-control"
                @click="elegirAnulacion('aplicacion', a.id)"
              >
                Anular aplicación
              </button>
            </p>
            <button
              v-if="!r.anulada"
              type="button"
              class="text-control"
              @click="elegirAnulacion('recepcion', r.id)"
            >
              Anular entrada
            </button>
          </div>
        </section>
        <section v-show="pantalla === 'gestiones'" class="card gestion-screen">
          <span class="section-kicker">ORGANIZÁ TU JORNADA</span>
          <h2>Mis gestiones</h2>
          <p class="hint">
            Abrí una gestión para reunir las compras de un viaje, encargo o
            jornada.
          </p>
          <form
            @submit.prevent="iniciarGestion"
            class="step-fields gestion-form"
          >
            <label
              >Nombre de la gestión<input
                v-model.trim="nombreGestion"
                maxlength="120"
                placeholder="Ej. Juan Managua"
                required /></label
            ><label
              >Fecha de inicio<input
                v-model="inicioGestion"
                type="date"
                required /></label
            ><button type="submit" class="primary" :disabled="ocupado || !repo">
              Iniciar gestión
            </button>
          </form>
          <div class="gestion-list">
            <h3>Historial de gestiones</h3>
            <label
              >Mostrar<select v-model="estadoHistorial">
                <option value="todas">Todas las gestiones</option>
                <option value="abiertas">Abiertas</option>
                <option value="terminadas">Terminadas</option>
              </select></label
            >
            <p v-if="!gestiones.length" class="hint">
              Todavía no hay gestiones. Creá la primera para empezar.
            </p>
            <p
              v-if="gestiones.length && !gestionesVisibles.length"
              class="hint"
            >
              No hay gestiones en esta selección.
            </p>
            <article
              v-for="g in gestionesVisibles"
              :key="g.id"
              class="gestion-item"
            >
              <div>
                <strong>{{ g.nombre }}</strong>
                <p class="hint">
                  Inicio: {{ g.fecha_inicio }}
                  <span v-if="g.fecha_fin">· Terminó: {{ g.fecha_fin }}</span
                  ><span v-else> · Abierta</span>
                </p>
              </div>
              <div class="button-row">
                <button
                  type="button"
                  class="text-control"
                  @click="verGestion(g.id)"
                >
                  Ver detalle e historial
                </button>
                <button
                  type="button"
                  class="text-control"
                  @click="verCompras(g.id)"
                >
                  Ver compras
                </button>
                <button
                  type="button"
                  class="text-control"
                  @click="
                    repartoIngreso = [
                      { gestion_id: g.id, monto: '', destino: 'anticipo' },
                    ];
                    ir('fondos');
                  "
                >
                  Ver fondos / recibir dinero
                </button>
                <button
                  type="button"
                  class="text-control"
                  :disabled="ocupado"
                  @click="prepararInformeDe(g)"
                >
                  Preparar informe
                </button>
              </div>
              <div v-if="!g.fecha_fin" class="button-row">
                <button
                  type="button"
                  class="secondary"
                  @click="elegirGestion(g.id)"
                >
                  Registrar compra</button
                ><button
                  type="button"
                  class="text-control"
                  @click="
                    cierreId = g.id;
                    fechaCierre = hoy();
                  "
                >
                  Terminar gestión
                </button>
              </div>
              <button
                v-else
                type="button"
                class="text-control"
                @click="reapertura.id = g.id"
              >
                Reabrir gestión
              </button>
              <form
                v-if="reapertura.id === g.id"
                class="step-fields"
                @submit.prevent="reabrirGestion"
              >
                <label
                  >Motivo de reapertura<input
                    v-model.trim="reapertura.motivo"
                    minlength="3"
                    maxlength="300"
                    required
                /></label>
                <button type="submit" class="secondary" :disabled="ocupado">
                  Confirmar reapertura
                </button>
                <button
                  type="button"
                  class="text-control"
                  @click="reapertura.id = ''"
                >
                  Cancelar
                </button>
              </form>
              <form
                v-if="cierreId === g.id"
                @submit.prevent="terminarGestion"
                class="close-form"
              >
                <label
                  >Fecha de finalización<input
                    v-model="fechaCierre"
                    type="date"
                    :min="g.fecha_inicio"
                    required
                /></label>
                <div class="button-row">
                  <button type="submit" class="secondary" :disabled="ocupado">
                    Confirmar finalización</button
                  ><button
                    type="button"
                    class="text-control"
                    @click="cierreId = null"
                  >
                    Cancelar
                  </button>
                </div>
                <p class="hint">
                  Las compras y saldos permanecen disponibles después de
                  terminar.
                </p>
              </form>
            </article>
          </div>
        </section>
        <section
          v-if="pantalla === 'gestion-detalle' && gestionDetalle"
          class="card"
        >
          <button type="button" class="back-link" @click="ir('gestiones')">
            ← Volver a gestiones
          </button>
          <h2>{{ gestionDetalle.gestion.nombre }}</h2>
          <p class="hint">
            {{ gestionDetalle.gestion.fecha_inicio }} ·
            {{ gestionDetalle.gestion.estado }} · Liquidación:
            {{ gestionDetalle.liquidacion }}
          </p>
          <h3>Compras</h3>
          <p v-if="!gestionDetalle.compras.length" class="hint">Sin compras.</p>
          <button
            v-for="c in gestionDetalle.compras"
            :key="c.id"
            type="button"
            class="purchase"
            @click="ver(c)"
          >
            <span
              >{{ c.concepto }} · {{ c.proveedor
              }}<span v-if="c.anulada"> · Anulada</span></span
            ><strong>{{ dinero(c.importe, c.moneda) }}</strong>
          </button>
          <h3>Dinero</h3>
          <p class="hint">
            Cada grupo representa una persona o empresa y una sola moneda. Las
            compras sin reparto se muestran aparte.
          </p>
          <div
            v-for="c in cuentasDetalle"
            :key="`${c.gestion_id}-${c.parte_id}-${c.moneda}`"
            class="gestion-item"
          >
            <strong
              >{{
                partesTodas.find((p) => p.id === c.parte_id)?.nombre ||
                "Sin destino asignado"
              }}
              · {{ c.moneda }}</strong
            >
            <p>
              Recibido para esta gestión: {{ dinero(c.recibido, c.moneda) }}
            </p>
            <p>
              Gastos registrados: {{ dinero(c.gastos_registrados, c.moneda) }}
            </p>
            <p>
              Pagado con fondos recibidos: {{ dinero(c.usado_fondo, c.moneda) }}
            </p>
            <p>
              Dinero todavía en custodia: {{ dinero(c.custodia, c.moneda) }}
            </p>
            <p>
              Dinero propio aportado: {{ dinero(c.aportado_propio, c.moneda) }}
            </p>
            <p>Por reembolsar: {{ dinero(c.por_reembolsar, c.moneda) }}</p>
            <p>
              Por pagar a proveedores: {{ dinero(c.deuda_proveedor, c.moneda) }}
            </p>
            <p v-if="c.por_regularizar">
              Por regularizar: {{ dinero(c.por_regularizar, c.moneda) }}
            </p>
            <p v-if="c.devuelto">
              Devuelto: {{ dinero(c.devuelto, c.moneda) }}
            </p>
            <p v-if="c.traslado_entrada || c.traslado_salida">
              Trasladado: recibió {{ dinero(c.traslado_entrada, c.moneda) }} ·
              salió {{ dinero(c.traslado_salida, c.moneda) }}
            </p>
          </div>
          <p v-if="!gestionDetalle.saldos.length" class="hint">
            Sin saldos pendientes.
          </p>
          <p
            v-for="s in gestionDetalle.saldos"
            :key="`${s.tipo}-${s.parte_id}-${s.moneda}-${s.compra_id || ''}`"
          >
            {{ s.tipo }} ·
            {{
              partesTodas.find((p) => p.id === s.parte_id)?.nombre || "Parte"
            }}
            ·
            {{ dinero(s.importe, s.moneda) }}
          </p>
          <h3>Historial</h3>
          <p v-if="!gestionDetalle.historial.length" class="hint">
            Sin movimientos.
          </p>
          <div
            v-for="h in gestionDetalle.historial"
            :key="`${h.tipo}-${h.id}`"
            class="gestion-item"
          >
            <strong>{{ h.fecha }} · {{ h.tipo }}</strong>
            <p class="hint">
              {{ h.concepto || h.motivo || h.origen || "" }}
              <span v-if="h.parte_id"
                >·
                {{
                  partesTodas.find((p) => p.id === h.parte_id)?.nombre ||
                  "Parte"
                }}</span
              ><span v-if="h.moneda && h.importe">
                · {{ dinero(h.importe, h.moneda) }}</span
              ><span v-if="h.referencia"> · {{ h.referencia }}</span
              ><span v-if="h.anulada"> · Anulado</span>
            </p>
            <button
              v-if="!h.anulada && ['devolucion', 'traslado'].includes(h.tipo)"
              type="button"
              class="text-control"
              @click="elegirAnulacion('movimiento', h.id)"
            >
              Anular movimiento
            </button>
            <button
              v-if="tieneReferencia(h)"
              type="button"
              class="text-control"
              @click="abrirHistorial(h)"
            >
              Ver operación relacionada
            </button>
          </div>
        </section>
        <section
          v-show="pantalla === 'registro'"
          class="card"
          aria-labelledby="registro"
        >
          <h2 id="registro">Registrar compra</h2>
          <p class="hint">
            Completá los datos y agregá los comprobantes que tengas.
          </p>
          <div class="steps" aria-label="Progreso de la compra">
            <span :class="{ current: paso === 1 }">1 · Destino</span
            ><span :class="{ current: paso === 2 }">2 · Compra</span
            ><span :class="{ current: paso === 3 }">3 · Pago</span
            ><span :class="{ current: paso === 4 }">4 · Comprobantes</span>
          </div>
          <form @submit.prevent="guardar">
            <div v-if="paso === 1" class="step-fields">
              <label
                >Gestión <small>(opcional)</small
                ><select v-model="form.gestion_id">
                  <option value="">Sin gestión</option>
                  <option
                    v-for="g in gestiones.filter((item) => !item.fecha_fin)"
                    :key="g.id"
                    :value="g.id"
                  >
                    {{ g.nombre }} · {{ g.fecha_inicio }}
                  </option>
                </select></label
              >
              <p v-if="!gestiones.some((g) => !g.fecha_fin)" class="hint">
                También podés iniciar una gestión.
                <button
                  type="button"
                  class="inline-link"
                  @click="ir('gestiones')"
                >
                  Iniciar gestión
                </button>
              </p>
            </div>
            <div v-if="paso === 2" class="step-fields">
              <label
                >¿Qué compraste?<input
                  v-model.trim="form.concepto"
                  maxlength="250"
                  required
                  placeholder="Ej. Materiales para la finca"
              /></label>

              <label
                >¿Cuánto costó?<input
                  v-model="form.monto"
                  inputmode="decimal"
                  placeholder="0.00"
                  required /></label
              ><label
                >Moneda<select v-model="form.moneda">
                  <option value="NIO">Córdobas (C$)</option>
                  <option value="USD">Dólares (US$)</option>
                </select></label
              >

              <label
                >¿Dónde compraste?<input
                  v-model.trim="form.proveedor"
                  maxlength="250"
                  required
                  placeholder="Nombre del proveedor"
                  autocomplete="off" /></label
              ><label
                >Fecha de compra<input
                  v-model="form.fecha_compra"
                  type="date"
                  required
              /></label>
            </div>
            <div v-if="paso === 3" class="step-fields">
              <label
                >¿Quién pagó esta compra?<select v-model="pago.tipo">
                  <option value="">Elegí cómo pagaste</option>
                  <option value="propio">Yo, con mi dinero</option>
                  <option value="personal">Yo, es un gasto personal</option>
                  <option value="fondo">Usé dinero que me entregaron</option>
                  <option value="credito">El proveedor dio crédito</option>
                  <option value="tercero">
                    Otra persona o empresa pagó directamente
                  </option>
                  <option value="combinado">
                    Una parte con dinero recibido y otra con mi dinero
                  </option>
                  <option value="avanzado">
                    Repartir entre varias personas y pagos
                  </option>
                  <option value="sin_detalle">
                    Todavía no quiero indicar el pago
                  </option>
                </select></label
              >
              <label
                v-if="
                  pago.tipo &&
                  !['sin_detalle', 'avanzado', 'personal'].includes(pago.tipo)
                "
                >{{
                  pago.tipo === "credito"
                    ? "Quién debe al proveedor"
                    : pago.tipo === "tercero"
                      ? "Para quién fue la compra"
                      : pago.tipo === "propio"
                        ? "Quién debe reembolsarte"
                        : "De quién son los fondos"
                }}<select v-model="pago.parte_id" required>
                  <option value="">Elegí una persona o empresa</option>
                  <option
                    v-for="p in partes.filter(
                      (x) =>
                        !['fondo', 'combinado'].includes(pago.tipo) ||
                        saldos.some(
                          (s) =>
                            s.tipo === 'custodia' &&
                            s.gestion_id === form.gestion_id &&
                            s.moneda === form.moneda &&
                            s.parte_id === x.id &&
                            s.importe > 0,
                        ),
                    )"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.nombre
                    }}<template
                      v-if="['fondo', 'combinado'].includes(pago.tipo)"
                    >
                      · disponible
                      {{
                        (
                          (saldos.find(
                            (s) =>
                              s.tipo === "custodia" &&
                              s.gestion_id === form.gestion_id &&
                              s.moneda === form.moneda &&
                              s.parte_id === p.id,
                          )?.importe || 0) / 100
                        ).toFixed(2)
                      }}
                      {{ form.moneda }}</template
                    >
                  </option>
                </select></label
              >
              <p
                v-if="
                  !['sin_detalle', 'personal'].includes(pago.tipo) &&
                  !partes.length
                "
                class="hint"
              >
                Primero agregá la persona o empresa en «Recibir dinero».
              </p>
              <label v-if="pago.tipo === 'tercero'"
                >Quién pagó directamente<select v-model="pago.pagador_id">
                  <option value="">Elegí la persona o empresa</option>
                  <option v-for="p in partes" :key="p.id" :value="p.id">
                    {{ p.nombre }}
                  </option>
                </select></label
              >
              <label v-if="pago.tipo === 'combinado'"
                >Importe pagado con el fondo<input
                  v-model="pago.fondo"
                  inputmode="decimal"
                  placeholder="0.00"
                  required
              /></label>
              <div v-if="pago.tipo === 'avanzado'" class="step-fields">
                <label
                  >Forma de pago<select v-model="pago.forma_pago">
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito comercial</option>
                  </select></label
                >
                <label v-if="pago.forma_pago === 'credito'"
                  >Deudor ante el proveedor<select
                    v-model="pago.deudor_id"
                    required
                  >
                    <option value="">Elegí el deudor</option>
                    <option v-for="p in partes" :key="p.id" :value="p.id">
                      {{ p.nombre }}
                    </option>
                  </select></label
                >
                <strong>Reparto de la compra</strong>
                <p class="hint">
                  Las asignaciones deben sumar el importe total. Podés incluir
                  un destino personal.
                </p>
                <div
                  v-for="(a, i) in pago.asignaciones"
                  :key="i"
                  class="step-fields"
                >
                  <label
                    >Destino<select v-model="a.parte_id">
                      <option value="">Personal</option>
                      <option v-for="p in partes" :key="p.id" :value="p.id">
                        {{ p.nombre }}
                      </option>
                    </select></label
                  ><label
                    >Importe<input
                      v-model="a.monto"
                      inputmode="decimal"
                      required /></label
                  ><button
                    type="button"
                    class="text-control"
                    :disabled="pago.pagos.length > 0"
                    @click="pago.asignaciones.splice(i, 1)"
                  >
                    Quitar destino
                  </button>
                </div>
                <p v-if="pago.pagos.length" class="hint">
                  Para quitar un destino, primero quitá los pagos vinculados.
                </p>
                <button
                  type="button"
                  class="secondary"
                  @click="pago.asignaciones.push({ parte_id: '', monto: '' })"
                >
                  Agregar destino
                </button>
                <strong>Pagos efectuados</strong>
                <p class="hint">
                  Elegí el destino al que corresponde cada pago. Si es crédito,
                  podés registrar pagos después.
                </p>
                <div v-for="(p, i) in pago.pagos" :key="i" class="step-fields">
                  <label
                    >Origen<select v-model="p.origen">
                      <option value="propio">Mi dinero</option>
                      <option value="fondo">Dinero recibido</option>
                      <option value="tercero">
                        Pago directo de un tercero
                      </option>
                    </select></label
                  ><label v-if="p.origen !== 'propio'"
                    >Quién pagó o dueño del fondo<select
                      v-model="p.parte_id"
                      required
                    >
                      <option value="">Elegí una persona o empresa</option>
                      <option
                        v-for="parte in partes"
                        :key="parte.id"
                        :value="parte.id"
                      >
                        {{ parte.nombre }}
                      </option>
                    </select></label
                  ><label
                    >Asignación<select v-model="p.asignacion">
                      <option value="">Sin asignar</option>
                      <option
                        v-for="(a, indice) in pago.asignaciones"
                        :key="indice"
                        :value="indice"
                      >
                        {{
                          partesTodas.find((x) => x.id === a.parte_id)
                            ?.nombre || "Personal"
                        }}
                        · {{ a.monto }}
                      </option>
                    </select></label
                  ><label
                    >Importe<input
                      v-model="p.monto"
                      inputmode="decimal"
                      required /></label
                  ><button
                    type="button"
                    class="text-control"
                    @click="pago.pagos.splice(i, 1)"
                  >
                    Quitar pago
                  </button>
                </div>
                <button
                  type="button"
                  class="secondary"
                  @click="
                    pago.pagos.push({
                      origen: 'propio',
                      parte_id: '',
                      asignacion: '',
                      monto: '',
                    })
                  "
                >
                  Agregar pago
                </button>
              </div>
            </div>
            <div v-if="paso === 4" class="step-fields">
              <p class="hint">
                Revisá: {{ form.concepto }} · {{ form.monto }}
                {{ form.moneda }} · pago: {{ pago.tipo }}.
              </p>
              <label
                >Número de factura <small>(opcional)</small
                ><input
                  v-model="form.factura"
                  maxlength="100"
                  placeholder="Conservá los ceros iniciales" /></label
              ><label
                >Estado del comprobante<select v-model="form.estado">
                  <option value="factura">Con factura</option>
                  <option value="sin_factura">Sin factura</option>
                  <option value="pendiente">Comprobante pendiente</option>
                </select></label
              >
              <fieldset
                v-if="catalogos.some((item) => item.activa)"
                class="seleccion-informe"
              >
                <legend>Datos descriptivos opcionales</legend>
                <p class="hint">
                  Las etiquetas no sustituyen el origen del pago ni cambian los
                  saldos.
                </p>
                <label
                  v-for="item in catalogos.filter((x) => x.activa)"
                  :key="item.id"
                  class="check"
                  ><input
                    v-model="form.catalogos"
                    type="checkbox"
                    :value="item.id"
                  />{{ item.tipo }} · {{ item.nombre }}</label
                >
              </fieldset>
              <div>
                <strong>Fotos del comprobante</strong>
                <p class="hint">
                  Podés agregar varias imágenes o continuar sin ellas.
                </p>
                <div class="photo-actions">
                  <button
                    v-if="nativo"
                    type="button"
                    class="secondary"
                    :disabled="ocupado"
                    @click="camara"
                  >
                    Tomar foto</button
                  ><label class="file-button"
                    >Elegir imágenes<input
                      type="file"
                      accept="image/jpeg,image/png"
                      multiple
                      :disabled="ocupado"
                      @change="adjuntar"
                  /></label>
                </div>
              </div>
              <div v-for="(imagen, i) in imagenes" :key="i" class="photo-row">
                <span>Imagen {{ i + 1 }}</span
                ><label
                  >Tipo<select v-model="imagen.clase">
                    <option value="factura">Factura</option>
                    <option value="voucher">Voucher</option>
                    <option value="otro">Otro</option>
                  </select></label
                ><button type="button" class="link" @click="editarBorrador(i)">
                  Ajustar</button
                ><button
                  type="button"
                  class="link"
                  @click="imagenes.splice(i, 1)"
                >
                  Quitar
                </button>
              </div>
            </div>
            <div class="step-actions">
              <button
                v-if="paso > 1"
                class="secondary"
                type="button"
                @click="retroceder"
              >
                ← Atrás</button
              ><button
                v-if="paso < 4"
                class="primary"
                type="button"
                @click="avanzar"
              >
                Continuar →</button
              ><button
                v-else
                class="primary"
                type="submit"
                :disabled="ocupado || !repo"
              >
                Guardar compra
              </button>
            </div>
          </form>
        </section>
        <section v-show="pantalla === 'compras'" class="card">
          <h2>Compras guardadas</h2>
          <p v-if="!filtroGestion" class="hint">
            Elegí una gestión para ver sus compras.
          </p>
          <template v-if="!filtroGestion">
            <p v-if="!gruposCompras.length" class="hint">
              Todavía no hay gestiones ni compras registradas.
            </p>
            <button
              v-for="g in gruposCompras"
              :key="g.id"
              type="button"
              class="purchase"
              @click="filtroGestion = g.id"
            >
              <strong>{{ g.nombre }}</strong
              ><span
                >{{ g.cantidad }}
                {{ g.cantidad === 1 ? "compra" : "compras" }}</span
              >
            </button>
          </template>
          <p v-if="filtroGestion" class="hint">
            Gestión:
            {{ gruposCompras.find((g) => g.id === filtroGestion)?.nombre }} ·
            <button
              class="inline-link"
              type="button"
              @click="filtroGestion = null"
            >
              Elegir otra gestión
            </button>
          </p>
          <p v-if="filtroGestion && !comprasVisibles.length" class="hint">
            Todavía no hay compras registradas.
          </p>
          <button
            v-for="c in filtroGestion ? comprasVisibles : []"
            :key="c.id"
            class="purchase"
            type="button"
            @click="ver(c)"
          >
            <span
              ><strong>{{ c.concepto }}</strong
              ><small
                >{{ c.proveedor }} · {{ c.fecha_compra }} ·
                {{
                  gestiones.find((g) => g.id === c.gestion_id)?.nombre ||
                  "Sin gestión"
                }}</small
              ></span
            ><strong>{{ dinero(c.importe, c.moneda) }}</strong>
          </button>
        </section>
        <section v-if="seleccion && pantalla === 'detalle'" class="card">
          <button class="back-link" type="button" @click="atras()">
            ← Volver
          </button>
          <h2>Detalle de compra</h2>
          <p>
            <strong>{{ seleccion.concepto }}</strong> ·
            {{ dinero(seleccion.importe, seleccion.moneda) }}
          </p>
          <p class="hint">
            {{ seleccion.proveedor }} · {{ seleccion.fecha_compra }} · Factura:
            {{ seleccion.factura || "sin número" }}
          </p>
          <p v-if="detalleCompra?.catalogos.length" class="hint">
            Etiquetas:
            {{
              detalleCompra.catalogos
                .map((x) => `${x.tipo}: ${x.nombre}`)
                .join(" · ")
            }}
          </p>
          <button
            v-if="!seleccion.anulada"
            type="button"
            class="text-control"
            @click="correccionCompra.visible = !correccionCompra.visible"
          >
            Corregir datos descriptivos
          </button>
          <button
            v-if="!seleccion.anulada"
            type="button"
            class="text-control"
            @click="correccionEconomica.visible = !correccionEconomica.visible"
          >
            Corregir importe o moneda
          </button>
          <form
            v-if="correccionEconomica.visible && !seleccion.anulada"
            class="step-fields"
            @submit.prevent="corregirEconomia"
          >
            <p class="hint">
              La compra original se conserva anulada. Primero anulá sus pagos y
              retirá sus asignaciones vigentes; después registrá de nuevo los
              pagos que correspondan.
            </p>
            <label
              >Importe correcto<input
                v-model="correccionEconomica.monto"
                inputmode="decimal"
                required /></label
            ><label
              >Moneda<select v-model="correccionEconomica.moneda">
                <option value="NIO">Córdobas</option>
                <option value="USD">Dólares</option>
              </select></label
            ><label
              >Motivo<input
                v-model.trim="correccionEconomica.motivo"
                minlength="3"
                maxlength="300"
                required /></label
            ><button type="submit" class="secondary" :disabled="ocupado">
              Registrar corrección
            </button>
          </form>
          <form
            v-if="
              !seleccion.anulada &&
              detalleCompra?.asignaciones.some((a) => !a.anulada)
            "
            class="step-fields"
            @submit.prevent="quitarReparto"
          >
            <p class="hint">
              Para retirar el reparto, primero anulá los pagos asociados.
            </p>
            <label
              >Motivo para retirar reparto<input
                v-model.trim="motivoReparto"
                minlength="3"
                maxlength="300"
                required /></label
            ><button type="submit" class="secondary" :disabled="ocupado">
              Retirar reparto
            </button>
          </form>
          <form
            v-if="correccionCompra.visible && !seleccion.anulada"
            class="step-fields"
            @submit.prevent="corregirCompra"
          >
            <label
              >Concepto<input
                v-model.trim="correccionCompra.concepto"
                maxlength="250"
                required /></label
            ><label
              >Proveedor<input
                v-model.trim="correccionCompra.proveedor"
                maxlength="250"
                required /></label
            ><label
              >Número de factura<input
                v-model="correccionCompra.factura"
                maxlength="100" /></label
            ><label
              >Motivo<input
                v-model.trim="correccionCompra.motivo"
                minlength="3"
                maxlength="300"
                required /></label
            ><button type="submit" class="secondary" :disabled="ocupado">
              Guardar corrección
            </button>
          </form>
          <div v-if="detalleCompra?.eventos.length">
            <h3>Historial de cambios</h3>
            <p
              v-for="e in detalleCompra.eventos.filter(
                (x) => x.tipo !== 'identidad_registro',
              )"
              :key="e.id"
              class="hint"
            >
              {{ e.fecha }} · {{ e.tipo }} · {{ e.motivo }}
            </p>
          </div>
          <p class="hint">
            Forma de pago: {{ seleccion.forma_pago
            }}<span v-if="seleccion.anulada"> · Compra anulada</span
            ><span v-if="seleccion.deudor_id">
              · Deudor:
              {{
                partesTodas.find((p) => p.id === seleccion.deudor_id)?.nombre ||
                "No disponible"
              }}</span
            >
          </p>
          <h3>Pagos registrados</h3>
          <p v-if="!detalleCompra?.pagos.length" class="hint">
            Todavía no hay pagos registrados.
          </p>
          <p v-for="p in detalleCompra?.pagos || []" :key="p.id" class="hint">
            {{ p.fecha }} · {{ dinero(p.importe, seleccion.moneda) }} ·
            {{ p.origen }}<span v-if="p.anulada"> · Anulado</span>
            <button
              v-if="!p.anulada"
              type="button"
              class="text-control"
              @click="elegirAnulacion('pago', p.id)"
            >
              Anular pago
            </button>
          </p>
          <form
            v-if="!seleccion.anulada && seleccion.forma_pago !== 'sin_detalle'"
            class="step-fields"
            @submit.prevent="registrarAbono"
          >
            <h3>Registrar pago posterior</h3>
            <label
              >Fecha<input v-model="abono.fecha" type="date" required
            /></label>
            <label
              >Importe<input v-model="abono.monto" inputmode="decimal" required
            /></label>
            <label
              >Origen<select v-model="abono.origen">
                <option value="tercero">
                  Pago directo de otra persona o empresa
                </option>
                <option value="fondo">Dinero recibido</option>
                <option value="propio">Mi dinero</option>
              </select></label
            >
            <label v-if="abono.origen !== 'propio'"
              >Quién pagó o dueño del fondo<select
                v-model="abono.parte_id"
                required
              >
                <option value="">Elegí una persona o empresa</option>
                <option v-for="p in partes" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select></label
            >
            <label v-if="detalleCompra?.asignaciones.some((a) => !a.anulada)"
              >Asignación<select v-model="abono.asignacion_id">
                <option value="">Sin asignar</option>
                <option
                  v-for="a in detalleCompra.asignaciones.filter(
                    (x) => !x.anulada,
                  )"
                  :key="a.id"
                  :value="a.id"
                >
                  {{
                    partesTodas.find((p) => p.id === a.parte_id)?.nombre ||
                    "Personal"
                  }}
                  · {{ dinero(a.importe, seleccion.moneda) }}
                </option>
              </select></label
            >
            <button class="secondary" type="submit" :disabled="ocupado">
              Guardar pago
            </button>
          </form>
          <form
            v-if="!seleccion.anulada && seleccion.forma_pago === 'sin_detalle'"
            class="step-fields"
            @submit.prevent="clasificarCompra"
          >
            <h3>Indicar forma de pago</h3>
            <label
              >Forma de pago<select v-model="clasificacion.forma_pago">
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
              </select></label
            >
            <label v-if="clasificacion.forma_pago === 'credito'"
              >Quién debe al proveedor<select
                v-model="clasificacion.deudor_id"
                required
              >
                <option value="">Elegí una persona o empresa</option>
                <option v-for="p in partes" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select></label
            >
            <button type="submit" class="secondary" :disabled="ocupado">
              Guardar clasificación
            </button>
          </form>
          <form
            v-if="!seleccion.anulada"
            class="step-fields"
            @submit.prevent="anularCompra"
          >
            <h3>Anular compra</h3>
            <p class="hint">
              Se conserva la historia y se anulan sus pagos asociados.
            </p>
            <label
              >Motivo<input
                v-model.trim="motivoCompra"
                minlength="3"
                maxlength="300"
                required
            /></label>
            <button type="submit" class="secondary" :disabled="ocupado">
              Anular compra
            </button>
          </form>
          <p class="hint">
            {{ fotos.length }} comprobante(s) guardado(s). Los archivos se
            incluyen según la opción elegida.
          </p>
          <div v-for="vista in vistas" :key="vista.id" class="comprobante">
            <img :src="vista.src" :alt="`Comprobante: ${vista.clase}`" />
            <span>{{ vista.clase }}</span>
            <button
              type="button"
              class="secondary"
              @click="editarGuardado(vista)"
            >
              Ajustar imagen
            </button>
          </div>
          <label v-if="!seleccion.anulada"
            >Tipo de comprobante adicional<select
              v-model="claseNuevoComprobante"
            >
              <option value="factura">Factura</option>
              <option value="voucher">Voucher</option>
              <option value="otro">Otro</option>
            </select></label
          >
          <label v-if="!seleccion.anulada" class="file-button"
            >Agregar comprobantes<input
              type="file"
              accept="image/jpeg,image/png"
              multiple
              :disabled="ocupado"
              @change="adjuntarExistente"
          /></label>
          <button
            v-if="nativo && !seleccion.anulada"
            type="button"
            class="secondary"
            :disabled="ocupado"
            @click="camaraExistente"
          >
            Tomar foto para esta compra
          </button>
          <div class="button-row">
            <button
              class="secondary"
              :disabled="ocupado"
              @click="exportar('xlsx', true)"
            >
              Excel con imágenes</button
            ><button
              class="secondary"
              :disabled="ocupado"
              @click="exportar('xlsx', false)"
            >
              Excel sin imágenes</button
            ><button
              class="secondary"
              :disabled="ocupado"
              @click="exportar('pdf')"
            >
              PDF con imágenes
            </button>
          </div>
        </section>
        <section
          v-if="informeGestion && pantalla === 'preparar-informe'"
          class="card"
        >
          <button type="button" class="back-link" @click="ir('gestiones')">
            ← Volver a Gestiones
          </button>
          <span class="section-kicker">INFORME DE GASTOS</span>
          <h2>Informe de {{ informeGestion.nombre }}</h2>
          <p class="hint">
            Cada emisión queda registrada como una revisión nueva. Las
            anteriores no cambian.
          </p>
          <form @submit.prevent="emitir" class="step-fields">
            <label
              >Título del informe<input
                v-model="informeForm.titulo"
                maxlength="120"
                required /></label
            ><label
              >Responsable<input
                v-model="informeForm.responsable"
                maxlength="120"
                placeholder="Responsable de los gastos" /></label
            ><label
              >Destinatario registrado<select
                v-model="informeForm.destinatario_id"
              >
                <option value="">Escribir nombre manualmente</option>
                <option v-for="p in partes" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select></label
            ><label v-if="!informeForm.destinatario_id"
              >Destinatario<input
                v-model="informeForm.destinatario"
                maxlength="120"
                placeholder="Empresa o persona que recibe el informe" /></label
            ><label
              >Fecha de corte<input
                v-model="informeForm.corte"
                type="date"
                :min="informeGestion.fecha_inicio"
                required /></label
            ><label
              >Papel<select v-model="informeForm.papel">
                <option value="carta">Carta</option>
                <option value="a4">A4</option>
              </select></label
            ><label
              >Presentación<select
                v-model="informeForm.estilo"
                @change="
                  informeForm.estilo === 'formal' &&
                  (informeForm.incluirFotos = true)
                "
              >
                <option value="ejecutivo">Ejecutivo moderno</option>
                <option value="formal">Detallado para impresión</option>
              </select></label
            ><label class="check"
              ><input
                v-model="informeForm.incluirFotos"
                type="checkbox"
              />Adjuntar los comprobantes como anexos</label
            >
            <fieldset class="seleccion-informe">
              <legend>Compras que se comparten</legend>
              <p v-if="!comprasDelInforme.length" class="hint">
                No hay compras hasta la fecha de corte.
              </p>
              <label v-for="c in comprasDelInforme" :key="c.id" class="check"
                ><input
                  v-model="informeSeleccion"
                  type="checkbox"
                  :value="c.id"
                /><span
                  >{{ fechaVista(c.fecha_compra) }} · {{ c.concepto }} ·
                  <strong>{{ dinero(c.importe, c.moneda) }}</strong></span
                ></label
              >
              <p class="hint">
                Desmarcá las compras que no corresponden a este destinatario. La
                separación automática por empresa llega con las asignaciones.
              </p>
            </fieldset>
            <button
              type="button"
              class="secondary"
              :disabled="ocupado || !repo"
              @click="previsualizarGestion"
            >
              Ver vista previa PDF
            </button>
            <button type="submit" class="primary" :disabled="ocupado || !repo">
              Emitir informe PDF
            </button>
          </form>
          <p class="hint">
            El informe utiliza los movimientos financieros registrados. Emitirlo
            no equivale a aprobación ni a pago.
          </p>
        </section>
        <section v-show="pantalla === 'informes'" class="card">
          <h2>Informes emitidos</h2>
          <button
            type="button"
            class="primary spaced"
            @click="ir('informe-general')"
          >
            Preparar otro informe
          </button>
          <p
            v-if="nativo && Capacitor.getPlatform() === 'android'"
            class="hint"
          >
            Informes PDF en Documentos/«{{ CARPETA_INFORMES }}». Para abrir uno,
            elegí una aplicación disponible en tu teléfono.
          </p>
          <p v-else-if="nativo" class="hint">
            Informes guardados dentro de esta aplicación. Para abrir uno, elegí
            una aplicación disponible en tu teléfono.
          </p>
          <p v-else class="hint">
            Informes guardados en el navegador de prueba.
          </p>
          <p
            v-if="!revisiones.length && !informesSinRegistro.length"
            class="hint"
          >
            Todavía no hay informes. Prepará uno desde una gestión.
          </p>
          <article v-for="r in revisiones" :key="r.id" class="revision-item">
            <div>
              <strong>{{ r.codigo }}</strong>
              <span class="hint"
                >{{ r.nombre || "Gestión no disponible" }} · revisión
                {{ r.revision }} · corte {{ fechaVista(r.fecha_corte) }}</span
              >
              <small :class="['estado-archivo', r.estado]">{{
                ESTADO_ARCHIVO[r.estado]
              }}</small>
            </div>
            <div class="button-row">
              <button
                type="button"
                class="secondary"
                :disabled="ocupado"
                @click="abrirRevision(r)"
              >
                Abrir PDF</button
              ><button
                type="button"
                class="text-control"
                :disabled="ocupado"
                @click="excelRevision(r)"
              >
                Excel
              </button>
            </div>
          </article>
          <h3 v-if="informesSinRegistro.length">
            Informes anteriores sin revisión
          </h3>
          <button
            v-for="nombre in informesSinRegistro"
            :key="nombre"
            type="button"
            class="purchase"
            :disabled="ocupado"
            @click="abrirInforme(nombre)"
          >
            <span
              ><strong>{{ etiquetaInforme(nombre) }}</strong
              ><small>PDF guardado</small></span
            ><span>↗</span>
          </button>
          <p v-if="Capacitor.getPlatform() === 'android'" class="hint">
            La carpeta Documentos es compartida en el teléfono: otras
            aplicaciones con acceso a esos archivos podrían leer los informes.
            No se envían a otro sistema automáticamente.
          </p>
          <p v-else class="hint">
            Los informes incluyen datos de compras. Revisá el destino antes de
            compartirlos.
          </p>
        </section>
        <section v-show="pantalla === 'informe-general'" class="card">
          <button type="button" class="back-link" @click="ir('informes')">
            ← Volver a informes
          </button>
          <h2>Preparar informe de gastos</h2>
          <form
            class="step-fields"
            @submit.prevent="informeGeneralAccion(false)"
          >
            <label
              >Alcance<select v-model="informeGeneral.tipo">
                <option value="periodo">Período</option>
                <option value="gestiones">Varias gestiones</option>
                <option value="parte">Persona o empresa</option>
                <option value="pendientes">Comprobantes pendientes</option>
              </select></label
            >
            <template v-if="informeGeneral.tipo === 'periodo'"
              ><label
                >Desde<input
                  v-model="informeGeneral.desde"
                  type="date"
                  required /></label
              ><label
                >Hasta<input
                  v-model="informeGeneral.hasta"
                  type="date"
                  required /></label
            ></template>
            <label v-if="informeGeneral.tipo === 'parte'"
              >Persona o empresa<select
                v-model="informeGeneral.parte_id"
                required
              >
                <option value="">Elegí un destinatario</option>
                <option v-for="p in partes" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select></label
            >
            <fieldset
              v-if="informeGeneral.tipo === 'gestiones'"
              class="seleccion-informe"
            >
              <legend>Gestiones</legend>
              <label v-for="g in gestiones" :key="g.id" class="check"
                ><input
                  v-model="informeGeneral.gestion_ids"
                  type="checkbox"
                  :value="g.id"
                />{{ g.nombre }}</label
              >
            </fieldset>
            <label
              >Título<input
                v-model.trim="informeGeneral.titulo"
                maxlength="120"
                required /></label
            ><label
              >Responsable<input
                v-model.trim="informeGeneral.responsable"
                maxlength="120" /></label
            ><label
              >Destinatario registrado<select
                v-model="informeGeneral.destinatario_id"
              >
                <option value="">Escribir nombre manualmente</option>
                <option v-for="p in partes" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select></label
            ><label v-if="!informeGeneral.destinatario_id"
              >Destinatario<input
                v-model.trim="informeGeneral.destinatario"
                maxlength="120" /></label
            ><label
              >Fecha de corte<input
                v-model="informeGeneral.corte"
                type="date"
                required
            /></label>
            <label
              >Papel<select v-model="informeGeneral.papel">
                <option value="carta">Carta</option>
                <option value="a4">A4</option>
              </select></label
            ><label
              >Estilo<select
                v-model="informeGeneral.estilo"
                @change="
                  informeGeneral.estilo === 'formal' &&
                  (informeGeneral.incluirFotos = true)
                "
              >
                <option value="ejecutivo">Ejecutivo</option>
                <option value="formal">Detallado para impresión</option>
              </select></label
            >
            <label class="check"
              ><input
                v-model="informeGeneral.incluirFotos"
                type="checkbox"
              />Incluir comprobantes</label
            >
            <label
              v-if="
                informeGeneral.tipo === 'parte' && informeGeneral.incluirFotos
              "
              class="check"
              ><input
                v-model="informeGeneral.incluirCompartidos"
                type="checkbox"
              />Acepto incluir comprobantes compartidos que pueden contener
              información de otras personas.</label
            >
            <button
              type="button"
              class="secondary"
              :disabled="ocupado"
              @click="informeGeneralAccion(true)"
            >
              Ver vista previa PDF
            </button>
            <button type="submit" class="primary" :disabled="ocupado">
              Emitir informe
            </button>
          </form>
        </section>
        <section v-show="pantalla === 'respaldo'" class="card">
          <h2>Informes y respaldo</h2>
          <h3>Catálogos descriptivos</h3>
          <div v-if="preferencias.aprendizaje" class="ayuda-catalogos">
            <strong>¿Para qué sirven?</strong>
            <p>
              Son etiquetas para organizar compras. Podés crear solo las que
              necesités y después elegirlas al registrar una compra.
            </p>
            <ul>
              <li>
                <strong>Cuenta:</strong> identifica de dónde se pagó, por
                ejemplo «Caja de oficina».
              </li>
              <li>
                <strong>Medio de pago:</strong> cómo se pagó, por ejemplo
                «Efectivo» o «Tarjeta».
              </li>
              <li>
                <strong>Categoría:</strong> qué clase de gasto fue, por ejemplo
                «Farmacia» o «Supermercado».
              </li>
              <li>
                <strong>Destino:</strong> para dónde o para qué fue, por ejemplo
                «Oficina de Managua».
              </li>
            </ul>
            <p>
              Estas etiquetas no mueven dinero ni reemplazan el registro del
              pago o del fondo.
            </p>
          </div>
          <p class="hint">
            Cuentas, medios, categorías y destinos no cambian automáticamente
            los saldos.
          </p>
          <form class="step-fields" @submit.prevent="crearCatalogo">
            <label
              >Tipo<select v-model="catalogoForm.tipo">
                <option value="cuenta">Cuenta</option>
                <option value="medio">Medio de pago</option>
                <option value="categoria">Categoría</option>
                <option value="destino">Destino</option>
              </select></label
            ><label
              >Nombre<input
                v-model.trim="catalogoForm.nombre"
                maxlength="120"
                required /></label
            ><button
              type="submit"
              class="secondary"
              :disabled="ocupado || !repo"
            >
              Guardar elemento
            </button>
          </form>
          <div v-for="item in catalogos" :key="item.id" class="gestion-item">
            <strong>{{ item.nombre }}</strong
            ><span class="hint">
              · {{ item.tipo }} ·
              {{ item.activa ? "Activo" : "Inactivo" }}</span
            ><button
              type="button"
              class="text-control"
              @click="
                catalogoEdicion = {
                  id: item.id,
                  nombre: item.nombre,
                  motivo: '',
                }
              "
            >
              Editar</button
            ><button
              v-if="item.activa"
              type="button"
              class="text-control"
              @click="desactivarCatalogo(item)"
            >
              Desactivar
            </button>
          </div>
          <form
            v-if="catalogoEdicion.id"
            class="step-fields"
            @submit.prevent="editarCatalogo"
          >
            <label
              >Nombre<input
                v-model.trim="catalogoEdicion.nombre"
                maxlength="120"
                required /></label
            ><label
              >Motivo<input
                v-model.trim="catalogoEdicion.motivo"
                minlength="3"
                maxlength="300"
                required /></label
            ><button type="submit" class="secondary" :disabled="ocupado">
              Guardar cambio</button
            ><button
              type="button"
              class="text-control"
              @click="catalogoEdicion.id = ''"
            >
              Cancelar
            </button>
          </form>
          <h3>Seguridad de la aplicación</h3>
          <p class="hint">
            Opcional: al abrir la aplicación, usá la huella, el reconocimiento
            facial o el PIN del dispositivo, según esté configurado. Este
            bloqueo no cifra los respaldos.
          </p>
          <button
            type="button"
            class="secondary spaced"
            :disabled="ocupado || !nativo"
            @click="cambiarSeguridad"
          >
            {{
              seguridadActiva ? "Desactivar protección" : "Activar protección"
            }}
          </button>
          <p v-if="!nativo" class="hint">
            La protección está disponible en la aplicación instalada.
          </p>
          <button
            type="button"
            class="secondary spaced"
            :disabled="ocupado"
            @click="abrirInformes"
          >
            Ver informes guardados
          </button>
          <label
            >Encabezado de PDF<input
              v-model="encabezado"
              maxlength="120" /></label
          ><button
            class="secondary spaced"
            :disabled="ocupado || !repo"
            @click="guardarEncabezado"
          >
            Guardar encabezado
          </button>
          <div class="button-row">
            <button
              class="secondary"
              :disabled="ocupado || !repo"
              @click="respaldo"
            >
              Crear respaldo</button
            ><label class="file-button"
              >Restaurar respaldo<input
                type="file"
                accept=".zip,application/zip"
                :disabled="ocupado || !repo"
                @change="restaurar"
            /></label>
          </div>
          <p class="hint">
            El respaldo incluye compras, fotos, movimientos de dinero y la copia
            privada de cada informe emitido, con sus huellas. No está cifrado ni
            tiene contraseña: guardalo en un lugar privado. Restaurarlo
            reemplaza los datos actuales.
          </p>
        </section>
        <p class="footer">
          Los datos se guardan en este dispositivo. La aplicación todavía no
          sincroniza información.
        </p>
      </main>
      <nav
        v-if="
          !['guiado', 'guiado-recibir', 'guiado-informe'].includes(pantalla)
        "
        class="bottom-nav"
        aria-label="Navegación principal"
      >
        <button
          type="button"
          :class="{ active: pantalla === 'inicio' }"
          :aria-current="pantalla === 'inicio' ? 'page' : undefined"
          @click="ir('inicio')"
        >
          <span aria-hidden="true">⌂</span>Inicio
        </button>
        <button
          type="button"
          :class="{ active: pantalla === 'gestiones' }"
          :aria-current="pantalla === 'gestiones' ? 'page' : undefined"
          @click="ir('gestiones')"
        >
          <span aria-hidden="true">▧</span>Gestiones
        </button>
        <button
          type="button"
          :class="{ active: pantalla === 'registro' }"
          :aria-current="pantalla === 'registro' ? 'page' : undefined"
          @click="ir(preferencias.guiada ? 'guiado' : 'registro')"
        >
          <span aria-hidden="true">＋</span>Registrar
        </button>
        <button
          type="button"
          :class="{ active: pantalla === 'compras' || pantalla === 'detalle' }"
          :aria-current="
            pantalla === 'compras' || pantalla === 'detalle'
              ? 'page'
              : undefined
          "
          @click="todasLasCompras()"
        >
          <span aria-hidden="true">▤</span>Compras
        </button>
        <button
          type="button"
          :class="{ active: pantalla === 'respaldo' }"
          :aria-current="pantalla === 'respaldo' ? 'page' : undefined"
          @click="ir('respaldo')"
        >
          <span aria-hidden="true">↥</span>Respaldo
        </button>
      </nav>
    </div>
  </div>
</template>
<style scoped>
.icono-app {
  width: 42px;
  height: 42px;
  object-fit: contain;
  padding: 4px;
  background: white;
  border-radius: 10px;
  vertical-align: middle;
  margin-left: 10px;
}
.ayuda-catalogos {
  padding: 14px;
  margin: 10px 0;
  border-radius: 12px;
  background: var(--g-infoBg);
  color: var(--g-infoInk);
  line-height: 1.5;
}
.tras-guiada > :not(.alert) {
  display: none;
}
.tras-guiada {
  padding: 0;
}
.back-link + .section-kicker {
  display: block;
  margin-top: 14px;
}
.revision-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0;
  border-top: 1px solid #e5eee7;
}
.revision-item > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.estado-archivo {
  font-size: 12px;
  font-weight: 650;
}
.estado-archivo.verificado {
  color: #2f6b4f;
}
.estado-archivo.alterado,
.estado-archivo.ausente {
  color: #8a4b0f;
}
.seleccion-informe {
  border: 1px solid #e5eee7;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.seleccion-informe legend {
  font-weight: 700;
  padding: 0 4px;
}
label.check {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  font-weight: 500;
}
label.check input {
  width: 22px;
  height: 22px;
  min-height: 0;
  flex: none;
  margin-top: 1px;
}
.developer-signature {
  display: inline-block;
  width: auto;
  margin: 0 0 10px;
  padding: 2px 0;
  text-align: left;
  background: transparent;
  border: 0;
  color: #49695b;
  font-size: 12px;
}
.wd-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 12px;
  background: #e5f1e0;
  color: #185c4c;
  font-size: 13px;
  font-weight: 850;
  letter-spacing: -0.4px;
}
.developer-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
}
.developer-more {
  color: #3d765e;
  font-size: 11px;
  font-weight: 700;
}
.about-card {
  padding: 24px;
}
.about-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0 15px;
}
.about-heading h2 {
  margin: 4px 0 0;
}
.wd-badge-large {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  font-size: 19px;
}
.about-description {
  color: #637e71;
  line-height: 1.5;
  margin: 0 0 18px;
}
.about-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 15px 0;
  border-top: 1px solid #e5eee7;
  line-height: 1.4;
}
.about-detail span {
  font-size: 12px;
  color: #6b8577;
}
.about-detail strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}
.gestion-form {
  margin-top: 20px;
}
.gestion-form .primary {
  margin-top: 0;
}
.gestion-list {
  border-top: 1px solid #e1ebe4;
  margin-top: 26px;
  padding-top: 22px;
}
.gestion-list h3 {
  font-size: 16px;
  margin: 0 0 10px;
}
.gestion-item {
  border: 1px solid #e1ebe4;
  border-radius: 13px;
  padding: 16px;
  margin-top: 10px;
}
.gestion-item .hint {
  margin-bottom: 0;
}
.close-form {
  border-top: 1px solid #e1ebe4;
  margin-top: 16px;
  padding-top: 16px;
}
.text-control,
.inline-link {
  border: 0;
  background: none;
  color: #286e58;
  font-weight: 700;
  padding: 8px;
}
.inline-link {
  padding: 0;
  text-decoration: underline;
}
.steps {
  display: flex;
  gap: 7px;
  margin: 20px 0 24px;
}
.steps span {
  flex: 1;
  color: #80988a;
  background: #f4f8f4;
  text-align: center;
  border-radius: 9px;
  padding: 10px 4px;
  font-size: 11px;
  font-weight: 700;
}
.steps span.current {
  color: #185c4c;
  background: #dff0d9;
}
.step-fields {
  display: grid;
  gap: 19px;
}
.step-fields label {
  gap: 8px;
}
.step-fields input,
.step-fields select {
  min-height: 50px;
}
.step-actions {
  display: flex;
  gap: 10px;
  align-items: stretch;
  margin-top: 22px;
}
.step-actions .primary {
  margin: 0;
  flex: 1;
}
.step-actions .secondary {
  min-width: 95px;
}
.welcome {
  background: #fff;
  border: 1px solid #e0eae4;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 8px 28px #173d2c0d;
}
.welcome-copy h2 {
  font-size: 26px;
  line-height: 1.2;
  margin: 8px 0;
  font-weight: 750;
  letter-spacing: -0.5px;
}
.welcome-copy p {
  color: #637e71;
  font-size: 15px;
  line-height: 1.55;
  margin: 0 0 20px;
}
.section-kicker {
  color: #6e8e7c;
  font-size: 10px;
  letter-spacing: 1.4px;
  font-weight: 800;
}
.welcome-button {
  margin: 4px 0 16px;
  padding: 17px;
  font-size: 16px;
}
.plus {
  font-size: 22px;
  margin-right: 7px;
}
.quick-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.quick-links button {
  text-align: left;
  border: 1px solid #dfebe2;
  border-radius: 13px;
  padding: 15px;
  background: #f7faf7;
  color: #244b3d;
}
.quick-links span,
.quick-links strong,
.quick-links small {
  display: block;
}
.quick-links span {
  font-size: 25px;
  color: #54866d;
  margin-bottom: 8px;
}
.quick-links strong {
  font-size: 14px;
}
.quick-links small {
  font-size: 11px;
  color: #7d9487;
  margin-top: 5px;
}
.notice {
  margin: 18px 0 0;
}
.back-link {
  border: 0;
  background: none;
  color: #286e58;
  font-weight: 700;
  padding: 0 0 18px;
}
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--g-sur);
  border-top: 1px solid var(--g-line);
  display: flex;
  justify-content: center;
  z-index: 5;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 18px #173d2c08;
}
.bottom-nav button {
  flex: 1;
  max-width: 180px;
  border: 0;
  background: none;
  color: var(--g-ink2);
  font-size: 11px;
  font-weight: 700;
  min-height: 54px;
  border-radius: 10px;
}
.bottom-nav button span {
  display: block;
  font-size: 23px;
  line-height: 26px;
}
.bottom-nav button.active {
  color: var(--g-accSoftInk);
  background: var(--g-accSoft);
}
.app-shell {
  min-height: 100vh;
  background: var(--g-bg);
  color: var(--g-ink);
}
.wrap {
  max-width: 760px;
  margin: auto;
}
.top {
  background: var(--g-acc);
  color: var(--g-onAcc);
  padding: 32px 20px 60px;
}
.top h1 {
  font-size: 30px;
  line-height: 1.2;
  margin: 6px 0;
}
.top p {
  margin: 0;
  color: var(--g-onAcc);
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 1.5px;
  font-weight: 700;
}
.main {
  padding: 0 16px calc(110px + env(safe-area-inset-bottom));
  margin-top: -35px;
}
.card {
  background: var(--g-sur);
  border: 1px solid var(--g-line);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 14px;
  box-shadow: 0 4px 18px #173d2c0a;
}
.card h2 {
  font-size: 20px;
  line-height: 1.3;
  margin: 0 0 8px;
}
.hint {
  font-size: 13px;
  line-height: 1.5;
  color: var(--g-ink2);
  margin: 8px 0 14px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.wide {
  grid-column: 1/-1;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--g-ink2);
}
input,
select {
  width: 100%;
  border: 1px solid var(--g-line);
  background: var(--g-sur2);
  border-radius: 9px;
  padding: 11px;
  color: var(--g-ink);
  font: inherit;
}
button {
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.primary,
.secondary,
.file-button {
  border-radius: 9px;
  padding: 11px 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.primary {
  background: var(--g-acc);
  color: var(--g-onAcc);
  border: 0;
  margin-top: 16px;
  width: 100%;
}
.secondary,
.file-button {
  background: var(--g-accSoft);
  border: 1px solid var(--g-line);
  color: var(--g-accSoftInk);
}
.file-button {
  cursor: pointer;
  position: relative;
}
.file-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.photo-actions,
.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.comprobante {
  display: inline-flex;
  flex-direction: column;
  margin: 8px;
  gap: 4px;
  color: #48695c;
}
.comprobante img {
  width: 130px;
  height: 130px;
  object-fit: contain;
  border: 1px solid #dbe7de;
  border-radius: 8px;
}
.photo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}
.photo-row label {
  flex: 1;
}
.link {
  border: 0;
  background: none;
  color: #a34f43;
}
.purchase {
  border: 0;
  border-top: 1px solid #e7efe9;
  background: #fff;
  display: flex;
  text-align: left;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 0;
  color: #193a32;
}
.purchase small {
  display: block;
  color: #718a7d;
  margin-top: 4px;
}
.spaced {
  margin-top: 10px;
}
.alert {
  border-radius: 10px;
  padding: 14px;
  margin: 0 0 14px;
}
.error {
  background: #ffe5df;
  color: #813322;
}
.success {
  background: #dcf0cb;
  color: #315a23;
}
.footer {
  text-align: center;
  font-size: 12px;
  color: #718a7d;
}
input:focus-visible,
select:focus-visible,
button:focus-visible,
.file-button:focus-within {
  outline: 3px solid #8bc178;
  outline-offset: 2px;
}
@media (max-width: 400px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
  .card {
    padding: 16px;
  }
}
</style>
