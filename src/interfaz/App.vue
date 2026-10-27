<script setup>
import { ref, computed, onMounted } from "vue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { App as Aplicacion } from "@capacitor/app";
import { versionInstalada } from "./version.js";
import { abrirRepositorio } from "../datos/abrir.js";
import {
  archivos,
  compartir,
  base64ABytes,
  bytesABase64,
  huella,
} from "../datos/archivos.js";
import { centavos, dinero } from "../dominio/compra.js";
import { guardarCompra, verificarImagen } from "../dominio/operaciones.js";
import { excel, pdf, pdfGestion } from "../exportaciones/informes.js";
import { crearRespaldo, restaurarRespaldo } from "../datos/respaldo.js";
import {
  informesLocales,
  CARPETA_INFORMES,
} from "../datos/informes-locales.js";
const repo = ref(null),
  compras = ref([]),
  filtroGestion = ref(null),
  gestiones = ref([]),
  estadoHistorial = ref("todas"),
  informesGuardados = ref([]),
  nombreGestion = ref(""),
  inicioGestion = ref(""),
  cierreId = ref(null),
  fechaCierre = ref(""),
  seleccion = ref(null),
  fotos = ref([]),
  vistas = ref([]),
  imagenes = ref([]),
  error = ref(""),
  mensaje = ref(""),
  ocupado = ref(false),
  encabezado = ref("Informe de gastos"),
  pantalla = ref("inicio"),
  paso = ref(1),
  version = ref("Consultando…");
function ir(destino) {
  pantalla.value = destino;
  error.value = "";
  mensaje.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const gestionesVisibles = computed(() =>
  gestiones.value.filter(
    (g) =>
      estadoHistorial.value === "todas" ||
      (estadoHistorial.value === "abiertas" ? !g.fecha_fin : !!g.fecha_fin),
  ),
);
const comprasVisibles = computed(() =>
  filtroGestion.value
    ? compras.value.filter((c) => c.gestion_id === filtroGestion.value)
    : compras.value,
);
function verCompras(id) {
  filtroGestion.value = id;
  ir("compras");
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
});
const form = ref(nuevo());
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
  if (!inicioGestion.value) inicioGestion.value = hoy();
  encabezado.value = await repo.value.ajuste();
  if (seleccion.value) {
    seleccion.value =
      compras.value.find((c) => c.id === seleccion.value.id) || null;
    fotos.value = seleccion.value
      ? await repo.value.fotos(seleccion.value.id)
      : [];
  }
}
onMounted(async () => {
  version.value = await versionInstalada(Capacitor.isNativePlatform(), () =>
    Aplicacion.getInfo(),
  );
});
onMounted(() =>
  operacion(async () => {
    repo.value = await abrirRepositorio();
    await cargar();
  }),
);
function tipoDe(bytes) {
  return bytes[0] === 137 ? "image/png" : "image/jpeg";
}
async function agregar(bytes, clase = "factura") {
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
    const foto = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    const base64 = foto.dataUrl?.split(",")[1];
    if (!base64) throw new Error("La cámara no devolvió una imagen.");
    await agregar(base64ABytes(base64));
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
    await repo.value.crearGestion(g);
    await cargar();
    nombreGestion.value = "";
    inicioGestion.value = hoy();
    form.value.gestion_id = g.id;
    pantalla.value = "registro";
    paso.value = 1;
    mensaje.value = "Gestión iniciada. Podés registrar la primera compra.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
async function terminarGestion() {
  await operacion(async () => {
    await repo.value.cerrarGestion(cierreId.value, fechaCierre.value);
    cierreId.value = null;
    await cargar();
    mensaje.value = "Gestión terminada. Sus compras siguen disponibles.";
  });
}
function elegirGestion(id) {
  form.value.gestion_id = id;
  ir("registro");
}
function avanzar() {
  error.value = "";
  if (
    paso.value === 1 &&
    (!form.value.gestion_id || !form.value.concepto.trim())
  ) {
    error.value = "Elegí la gestión e indicá qué compraste.";
    return;
  }
  if (paso.value === 2) {
    try {
      centavos(form.value.monto);
    } catch (e) {
      error.value = e.message;
      return;
    }
  }
  if (
    paso.value === 3 &&
    (!form.value.fecha_compra || !form.value.proveedor.trim())
  ) {
    error.value = "Completá la fecha y el proveedor.";
    return;
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
    const c = { ...form.value, importe: centavos(form.value.monto) };
    delete c.monto;
    const creada = await guardarCompra(repo.value, archivos, c, imagenes.value);
    const gestionActiva = form.value.gestion_id;
    form.value = nuevo();
    form.value.gestion_id = gestionActiva;
    paso.value = 1;
    imagenes.value = [];
    await cargar();
    pantalla.value = "compras";
    window.scrollTo({ top: 0, behavior: "smooth" });
    mensaje.value = creada
      ? "Compra guardada en el dispositivo."
      : "Esta compra ya estaba guardada.";
  });
}
async function ver(c) {
  await operacion(async () => {
    seleccion.value = c;
    pantalla.value = "detalle";
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
        : await pdf(c, fotos.value, archivos, encabezado.value);
    await compartir(
      `compra-${c.id}.${formato}`,
      bytes,
      formato === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf",
    );
  });
}
async function exportarGestion(g, incluirFotos) {
  await operacion(async () => {
    const comprasGestion = compras.value.filter((c) => c.gestion_id === g.id);
    const items = [];
    for (const compra of comprasGestion)
      items.push({ compra, fotos: await repo.value.fotos(compra.id) });
    const bytes = await pdfGestion(
      g,
      items,
      archivos,
      encabezado.value,
      incluirFotos,
    );
    await informesLocales.guardar(g.id, bytes);
    await cargarInformes();
    mensaje.value =
      Capacitor.getPlatform() === "android"
        ? `Informe guardado en Documentos/${CARPETA_INFORMES}.`
        : nativo
          ? `Informe guardado en ${CARPETA_INFORMES} dentro de la aplicación.`
          : "Informe guardado en el almacenamiento de este navegador de prueba.";
  });
}
async function cargarInformes() {
  informesGuardados.value = await informesLocales.listar();
}
async function abrirInformes() {
  await operacion(async () => {
    await cargarInformes();
    pantalla.value = "informes";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
function etiquetaInforme(nombre) {
  const match = nombre.match(/^informe-gestion-(.+?)--(\d{8}T\d{6})--/);
  if (!match) return nombre;
  const g = gestiones.value.find((item) => item.id === match[1]);
  const d = match[2];
  return `${g?.nombre || "Gestión no disponible"} · ${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} ${d.slice(9, 11)}:${d.slice(11, 13)} UTC`;
}
async function abrirInforme(nombre) {
  await operacion(async () => {
    const bytes = await informesLocales.leer(nombre);
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
    const bytes = await crearRespaldo(repo.value, archivos);
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
    const resultado = await restaurarRespaldo(
      repo.value,
      archivos,
      new Uint8Array(await file.arrayBuffer()),
    );
    seleccion.value = null;
    fotos.value = [];
    vistas.value = [];
    await cargar();
    mensaje.value = `Restauración completa: ${resultado.compras} compras y ${resultado.fotos} comprobantes.`;
  });
}
const nativo = Capacitor.isNativePlatform();
</script>
<template>
  <div class="app-shell">
    <header class="top">
      <div class="wrap">
        <span class="eyebrow">REGISTRO SIN CONEXIÓN</span>
        <h1>Mis gastos</h1>
        <p>Compras y comprobantes en tu dispositivo.</p>
      </div>
    </header>
    <main class="wrap main">
      <p v-if="error" class="alert error" role="alert">{{ error }}</p>
      <p v-if="mensaje" class="alert success" role="status">{{ mensaje }}</p>
      <section v-show="pantalla === 'inicio'" class="welcome">
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
          <span class="wd-badge" aria-hidden="true">WD</span
          ><span class="developer-copy"
            ><span>Desarrollada por W. D. Gutiérrez</span
            ><span class="developer-more"
              >Acerca de <span aria-hidden="true">→</span></span
            ></span
          >
        </button>
        <button
          class="primary welcome-button"
          type="button"
          @click="ir('gestiones')"
        >
          <span class="plus">＋</span> Iniciar gestión
        </button>
        <div class="quick-links">
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
        <p class="hint notice">
          Esta versión registra compras y comprobantes. Los fondos, anticipos y
          créditos todavía están pendientes.
        </p>
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
          <span class="wd-badge wd-badge-large" aria-hidden="true">WD</span>
          <div>
            <span class="section-kicker">MIS GASTOS</span>
            <h2 id="acerca-titulo">Acerca de</h2>
          </div>
        </div>
        <p class="about-description">Compras y comprobantes, a tu alcance.</p>
        <div class="about-detail">
          <span>Desarrollo</span
          ><strong>Desarrollada por W. D. Gutiérrez</strong>
        </div>
        <div class="about-detail">
          <span>Versión</span><strong>{{ version }}</strong>
        </div>
      </section>
      <section v-show="pantalla === 'gestiones'" class="card gestion-screen">
        <span class="section-kicker">ORGANIZÁ TU JORNADA</span>
        <h2>Mis gestiones</h2>
        <p class="hint">
          Abrí una gestión para reunir las compras de un viaje, encargo o
          jornada.
        </p>
        <form @submit.prevent="iniciarGestion" class="step-fields gestion-form">
          <label
            >Nombre de la gestión<input
              v-model.trim="nombreGestion"
              maxlength="120"
              placeholder="Ej. Winston Managua"
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
          <p v-if="gestiones.length && !gestionesVisibles.length" class="hint">
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
                @click="verCompras(g.id)"
              >
                Ver compras
              </button>
              <button
                type="button"
                class="text-control"
                :disabled="ocupado"
                @click="exportarGestion(g, true)"
              >
                PDF con fotos
              </button>
              <button
                type="button"
                class="text-control"
                :disabled="ocupado"
                @click="exportarGestion(g, false)"
              >
                PDF sin fotos
              </button>
            </div>
            <p class="hint">
              El PDF incluye todas las compras de esta gestión; todavía no se
              filtra por empresa o destinatario. Revisalo antes de compartirlo.
            </p>
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
                Las compras permanecen disponibles después de terminar. Esta
                versión todavía no calcula los saldos de la gestión.
              </p>
            </form>
          </article>
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
          <span :class="{ current: paso === 1 }">1 · Compra</span
          ><span :class="{ current: paso === 2 }">2 · Importe</span
          ><span :class="{ current: paso === 3 }">3 · Datos</span
          ><span :class="{ current: paso === 4 }">4 · Foto</span>
        </div>
        <form @submit.prevent="guardar">
          <div v-if="paso === 1" class="step-fields">
            <label
              >Gestión<select v-model="form.gestion_id" required>
                <option value="">Elegí una gestión</option>
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
              Primero iniciá una gestión.
              <button
                type="button"
                class="inline-link"
                @click="ir('gestiones')"
              >
                Iniciar gestión
              </button>
            </p>
            <label
              >¿Qué compraste?<input
                v-model.trim="form.concepto"
                maxlength="250"
                required
                placeholder="Ej. Materiales para la finca"
            /></label>
          </div>
          <div v-if="paso === 2" class="step-fields">
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
          </div>
          <div v-if="paso === 3" class="step-fields">
            <label
              >¿Dónde compraste?<input
                v-model.trim="form.proveedor"
                maxlength="250"
                required
                placeholder="Nombre del proveedor" /></label
            ><label
              >Fecha de compra<input
                v-model="form.fecha_compra"
                type="date"
                required
            /></label>
          </div>
          <div v-if="paso === 4" class="step-fields">
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
        <p class="hint">
          Las compras anteriores sin gestión aparecen como «Sin gestión».
        </p>
        <p v-if="filtroGestion" class="hint">
          Gestión: {{ gestiones.find((g) => g.id === filtroGestion)?.nombre }} ·
          <button
            class="inline-link"
            type="button"
            @click="filtroGestion = null"
          >
            Ver todas
          </button>
        </p>
        <p v-if="!comprasVisibles.length" class="hint">
          Todavía no hay compras registradas.
        </p>
        <button
          v-for="c in comprasVisibles"
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
        <button class="back-link" type="button" @click="todasLasCompras()">
          ← Volver a mis compras
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
        <p class="hint">
          {{ fotos.length }} comprobante(s) guardado(s). Los archivos se
          incluyen según la opción elegida.
        </p>
        <div v-for="vista in vistas" :key="vista.id" class="comprobante">
          <img :src="vista.src" :alt="`Comprobante: ${vista.clase}`" />
          <span>{{ vista.clase }}</span>
        </div>
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
      <section v-show="pantalla === 'informes'" class="card">
        <h2>Informes guardados</h2>
        <p v-if="nativo && Capacitor.getPlatform() === 'android'" class="hint">
          Informes PDF en Documentos/«{{ CARPETA_INFORMES }}». Para abrir uno,
          elegí una aplicación disponible en tu teléfono.
        </p>
        <p v-else-if="nativo" class="hint">
          Informes guardados dentro de esta aplicación. Para abrir uno, elegí
          una aplicación disponible en tu teléfono.
        </p>
        <p v-else class="hint">Informes guardados en el navegador de prueba.</p>
        <p v-if="!informesGuardados.length" class="hint">
          Todavía no hay informes guardados. Generá uno desde una gestión.
        </p>
        <button
          v-for="nombre in informesGuardados"
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
          La carpeta Documentos es compartida en el teléfono: otras aplicaciones
          con acceso a esos archivos podrían leer los informes. No se envían a
          otro sistema automáticamente.
        </p>
        <p v-else class="hint">
          Los informes incluyen datos de compras. Revisá el destino antes de
          compartirlos.
        </p>
      </section>
      <section v-show="pantalla === 'respaldo'" class="card">
        <h2>Informes y respaldo</h2>
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
          El respaldo incluye compras y fotos, pero no los PDF guardados. No
          tiene contraseña adicional: guardalo en un lugar privado. Restaurarlo
          reemplaza los datos actuales.
        </p>
      </section>
      <p class="footer">
        Los datos se guardan en este dispositivo. La aplicación todavía no
        sincroniza información.
      </p>
    </main>
    <nav class="bottom-nav" aria-label="Navegación principal">
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
        @click="ir('registro')"
      >
        <span aria-hidden="true">＋</span>Registrar
      </button>
      <button
        type="button"
        :class="{ active: pantalla === 'compras' || pantalla === 'detalle' }"
        :aria-current="
          pantalla === 'compras' || pantalla === 'detalle' ? 'page' : undefined
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
</template>
<style scoped>
.developer-signature {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  margin: 0 0 14px;
  padding: 0 0 14px;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #e5eee7;
  color: #49695b;
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
  background: #fff;
  border-top: 1px solid #dce8df;
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
  color: #718c7e;
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
  color: #185c4c;
  background: #eef7ee;
}
.app-shell {
  min-height: 100vh;
  background: #f3f7f3;
  color: #193a32;
}
.wrap {
  max-width: 760px;
  margin: auto;
}
.top {
  background: #185c4c;
  color: white;
  padding: 32px 20px 60px;
}
.top h1 {
  font-size: 30px;
  line-height: 1.2;
  margin: 6px 0;
}
.top p {
  margin: 0;
  color: #cfe4da;
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
  background: #fff;
  border: 1px solid #e0eae4;
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
  color: #647e70;
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
  color: #48695c;
}
input,
select {
  width: 100%;
  border: 1px solid #cbdcd1;
  background: #fbfdfb;
  border-radius: 9px;
  padding: 11px;
  color: #193a32;
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
  background: #185c4c;
  color: #fff;
  border: 0;
  margin-top: 16px;
  width: 100%;
}
.secondary,
.file-button {
  background: #f5faf6;
  border: 1px solid #b8cebf;
  color: #185c4c;
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
