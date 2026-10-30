<script setup>
import PasosGuiados from "./PasosGuiados.vue";
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { CameraResultType, CameraSource } from "@capacitor/camera";
import { base64ABytes, bytesABase64 } from "../../datos/archivos.js";
import { verificarImagen } from "../../dominio/operaciones.js";
import { centavos, dinero } from "../../dominio/compra.js";
import { crearBorradores } from "../../datos/borradores.js";
import EditorComprobante from "../EditorComprobante.vue";
import {
  PASOS,
  AYUDA,
  variablesTema,
  partesUnicas,
  indiceCircular,
  moverFoto,
  faltaEnPaso,
  prepararCompraGuiada,
  resumenPagoCombinado,
  crearGuardadoDiferido,
  ejecutarGuardadoGuiado,
  esperarGuardadoGuiado,
} from "./guia.js";

const props = defineProps({
  api: { type: Object, required: true },
  gestiones: { type: Array, default: () => [] },
  partes: { type: Array, default: () => [] },
  saldos: { type: Array, default: () => [] },
  aprendizaje: { type: Boolean, default: true },
  tema: { type: String, default: "bosque" },
  nativo: { type: Boolean, default: false },
  abrirCamara: { type: Function, required: true },
  fecha: { type: String, required: true },
});
const emit = defineEmits(["guardado", "cerrar", "aprendizaje"]);

const CLAVE_BORRADOR = "compra-guiada";
const borradores = crearBorradores();
const gestionesNuevas = ref([]);
const nuevaGestion = ref({ visible: false, nombre: "" });
async function crearGestion() {
  error.value = "";
  const nombre = nuevaGestion.value.nombre.trim();
  if (!nombre) {
    error.value =
      "Escribí un nombre para la gestión, por ejemplo «Viaje a León».";
    return;
  }
  try {
    const { gestion } = await props.api.gestiones.crear({
      nombre,
      fecha_inicio: props.fecha,
    });
    gestionesNuevas.value.push(gestion);
    d.value.gestion_id = gestion.id;
    nuevaGestion.value = { visible: false, nombre: "" };
    aviso.value = `Listo: creé la gestión «${gestion.nombre}» y ya quedó elegida.`;
    emit("guardado");
  } catch (e) {
    error.value = e?.message || "No se pudo crear la gestión.";
  }
}
const abiertas = computed(() =>
  [...props.gestiones, ...gestionesNuevas.value].filter(
    (g, i, l) => !g.fecha_fin && l.findIndex((x) => x.id === g.id) === i,
  ),
);
const nuevoRegistro = () => ({
  id: crypto.randomUUID(),
  gestion_id: "",
  fecha: props.fecha,
  monto: "",
  moneda: "NIO",
  proveedor: "",
  concepto: "",
  factura: "",
  comprobante: "factura",
  quien: "",
  pagado: "",
  origen: "",
  propietario_id: "",
  monto_fondo: "",
  pagador_id: "",
  reparto: [],
});

const pantalla = ref("camara"),
  d = ref(nuevoRegistro()),
  fotos = ref([]),
  actual = ref(0),
  claseCaptura = ref("factura"),
  sinFactura = ref(false),
  editor = ref(null),
  error = ref(""),
  aviso = ref(""),
  ocupado = ref(false),
  guardado = ref(null);
let borradorListo = false;
const diferido = crearGuardadoDiferido((datos) =>
  borradores.guardar(CLAVE_BORRADOR, datos).catch(() => {
    error.value =
      "No se pudo guardar el borrador. No cierres la app hasta terminar.";
  }),
);
let x0 = null;
let arrastre = null;

const estilo = computed(() => variablesTema(props.tema));
const idx = computed(() => PASOS.findIndex((p) => p.id === pantalla.value));
const enAsistente = computed(() => idx.value > 0);
const ayuda = computed(() =>
  props.aprendizaje ? AYUDA[pantalla.value] : null,
);
const falta = computed(() =>
  pantalla.value === "importe" && !d.value.fecha
    ? "Elegí la fecha de la compra."
    : faltaEnPaso(pantalla.value, { ...d.value, fotos: fotos.value }),
);
const nuevas = ref([]);
const todasLasPartes = computed(() => partesUnicas(props.partes, nuevas.value));
const alta = ref({ visible: false, nombre: "", tipo: "empresa" });
const parteNombre = (id) =>
  id === "personal"
    ? "Gasto mío"
    : todasLasPartes.value.find((p) => p.id === id)?.nombre || "";
async function agregarParte() {
  error.value = "";
  const nombre = alta.value.nombre.trim();
  if (!nombre) {
    error.value = "Escribí el nombre de la empresa o persona.";
    return;
  }
  try {
    const { parte } = await props.api.partes.crear({
      nombre,
      tipo: alta.value.tipo,
    });
    if (!todasLasPartes.value.some((p) => p.id === parte.id))
      nuevas.value.push(parte);
    d.value.quien = parte.id;
    d.value.pagado = "";
    d.value.origen = "";
    alta.value = { visible: false, nombre: "", tipo: "empresa" };
    aviso.value = `Listo: agregué a «${parte.nombre}» y ya quedó elegida.`;
  } catch (e) {
    error.value = e?.message || "No se pudo agregar.";
  }
}
const gestionNombre = computed(
  () =>
    [...props.gestiones, ...gestionesNuevas.value].find(
      (g) => g.id === d.value.gestion_id,
    )?.nombre || "Sin gestión",
);
const montoTexto = computed(() => {
  try {
    return dinero(centavos(d.value.monto || "0"), d.value.moneda);
  } catch {
    return d.value.moneda === "USD" ? "US$ 0.00" : "C$ 0.00";
  }
});
const nombreClase = { factura: "Factura", voucher: "Voucher", otro: "Otro" };

/* ---------- Fondos disponibles (solo para habilitar la opción) ---------- */
const hayFondos = computed(() =>
  props.saldos.some(
    (s) =>
      s.tipo === "custodia" &&
      s.gestion_id === d.value.gestion_id &&
      s.moneda === d.value.moneda &&
      s.importe > 0,
  ),
);

/* ---------- Fotos ---------- */
function urlDe(bytes, tipo) {
  return URL.createObjectURL(new Blob([bytes], { type: tipo }));
}
function agregarFoto(bytes) {
  const tipo = bytes[0] === 137 ? "image/png" : "image/jpeg";
  verificarImagen(bytes, tipo);
  fotos.value.push({
    bytes,
    tipo,
    clase: claseCaptura.value,
    ajuste: null,
    url: urlDe(bytes, tipo),
  });
  actual.value = fotos.value.length - 1;
}
async function sacarFoto() {
  error.value = "";
  if (!props.nativo) {
    document.getElementById("guiada-archivo")?.click();
    return;
  }
  try {
    const foto = await props.abrirCamara({
      quality: 85,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    const base64 = foto.dataUrl?.split(",")[1];
    if (!base64) throw new Error("La cámara no devolvió una imagen.");
    agregarFoto(base64ABytes(base64));
  } catch (e) {
    if (!/cancel/i.test(e?.message || ""))
      error.value = e?.message || "No se pudo usar la cámara.";
  }
}
async function elegirArchivos(event) {
  error.value = "";
  try {
    for (const f of event.target.files)
      agregarFoto(new Uint8Array(await f.arrayBuffer()));
  } catch (e) {
    error.value = e?.message || "No se pudo usar esa imagen.";
  }
  event.target.value = "";
}
const fotoActual = computed(
  () => fotos.value[indiceCircular(actual.value, fotos.value.length)],
);
const diapositivas = computed(() => {
  const n = fotos.value.length;
  if (!n) return [];
  const offs = n === 1 ? [0] : n === 2 ? [0, 1] : [-1, 0, 1];
  return offs.map((o) => {
    const i = indiceCircular(actual.value + o, n);
    return { o, i, foto: fotos.value[i] };
  });
});
function pasarFoto(delta) {
  if (fotos.value.length)
    actual.value = indiceCircular(actual.value + delta, fotos.value.length);
}
function toqueInicio(e) {
  x0 = e.touches ? e.touches[0].clientX : e.clientX;
}
function toqueFin(e) {
  if (x0 === null) return;
  const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const dx = x - x0;
  x0 = null;
  if (dx < -40) pasarFoto(1);
  if (dx > 40) pasarFoto(-1);
}
function mover(de, a) {
  if (a < 0 || a >= fotos.value.length) return;
  fotos.value = moverFoto(fotos.value, de, a);
  actual.value = a;
}
function soltarEn(i) {
  if (arrastre !== null) mover(arrastre, i);
  arrastre = null;
}
function quitarFoto() {
  const i = indiceCircular(actual.value, fotos.value.length);
  const [quitada] = fotos.value.splice(i, 1);
  if (quitada) URL.revokeObjectURL(quitada.url);
  actual.value = Math.max(0, i - 1);
}
function girar() {
  const f = fotoActual.value;
  if (!f) return;
  const a = f.ajuste || {};
  f.ajuste = { ...a, rotacion: ((a.rotacion || 0) + 90) % 360 };
}
function recortar() {
  const f = fotoActual.value;
  if (!f) return;
  editor.value = {
    foto: f,
    src: `data:${f.tipo};base64,${bytesABase64(f.bytes)}`,
    ajuste: f.ajuste || {},
  };
}
function guardarRecorte(ajuste) {
  editor.value.foto.ajuste = ajuste;
  editor.value = null;
  aviso.value = "Listo. La foto original se guarda sin cambios.";
}

/* ---------- Navegación ---------- */
function ir(p) {
  error.value = "";
  pantalla.value = p;
  window.scrollTo?.({ top: 0, behavior: "smooth" });
}
function sinFotoDeFactura(estado) {
  d.value.comprobante = estado;
  sinFactura.value = false;
  ir("importe");
}
function avanzar() {
  if (falta.value) {
    error.value = falta.value;
    return;
  }
  if (pantalla.value === "revisar") return guardar();
  ir(PASOS[idx.value + 1].id);
}
function retroceder() {
  if (pantalla.value === "camara") return emit("cerrar");
  if (pantalla.value === "importe" && !fotos.value.length) return ir("camara");
  ir(PASOS[idx.value - 1].id);
}
/** Para el botón atrás de Android: devuelve true si lo atendió el asistente. */
function atras() {
  if (ocupado.value) return true;
  if (editor.value) {
    editor.value = null;
    return true;
  }
  if (pantalla.value === "listo") return false;
  retroceder();
  return true;
}
defineExpose({ atras });

/* ---------- Opciones ---------- */
const opcionesQuien = computed(() => [
  ...todasLasPartes.value
    .filter((p) => p.activa !== 0)
    .map((p) => ({
      id: p.id,
      titulo: p.nombre,
      detalle:
        p.tipo === "empresa"
          ? "Me lo tiene que devolver esta empresa"
          : "Me lo tiene que devolver esta persona",
    })),
  {
    id: "varios",
    titulo: "Es para varias personas o empresas",
    detalle: "Repartir el total entre varios destinos",
  },
  {
    id: "personal",
    titulo: "Es un gasto mío",
    detalle: "Nadie me lo devuelve",
  },
]);
const opcionesPagado = computed(() =>
  d.value.quien === "varios"
    ? [
        {
          id: "si",
          titulo: "Sí, ya se pagó",
          detalle: "Indicá cómo se pagó cada parte",
        },
      ]
    : d.value.quien === "personal"
      ? [
          { id: "si", titulo: "Sí, ya lo pagué", detalle: "Con mi plata" },
          {
            id: "nose",
            titulo: "Lo indico después",
            detalle: "Te lo recuerdo en Inicio",
          },
        ]
      : [
          { id: "si", titulo: "Sí, ya se pagó", detalle: "Se pagó completo" },
          {
            id: "credito",
            titulo: "No, quedó debiendo",
            detalle: "Fue a crédito con el negocio",
          },
          {
            id: "nose",
            titulo: "No sé todavía",
            detalle: "Lo guardo y te lo recuerdo en Inicio",
          },
        ],
);
const opcionesOrigen = computed(() => {
  return [
    { id: "propio", titulo: "Con mi plata", detalle: "Yo puse el dinero" },
    {
      id: "fondo",
      titulo: "Con dinero recibido",
      detalle: hayFondos.value
        ? "Elegí de quién es el fondo disponible"
        : "No hay fondos disponibles en esta gestión y moneda",
      deshabilitada: !hayFondos.value,
    },
    {
      id: "combinado",
      titulo: "Una parte del fondo y otra de mi dinero",
      detalle: hayFondos.value
        ? "Indicá cuánto usaste del fondo"
        : "No hay fondos disponibles en esta gestión y moneda",
      deshabilitada: !hayFondos.value,
    },
    {
      id: "tercero",
      titulo: "Otra persona o empresa pagó directamente",
      detalle: "Yo no puse nada",
    },
  ];
});
const resultado = computed(() => {
  const n = parteNombre(d.value.quien);
  if (d.value.quien === "varios" && d.value.pagado === "si")
    return "Cada parte conserva su destino y su forma de pago.";
  if (d.value.pagado === "nose")
    return "Lo guardo sin el pago. En Inicio te va a aparecer como pendiente.";
  if (d.value.quien === "personal" && d.value.pagado === "si")
    return "Es un gasto tuyo: nadie te debe nada por esto.";
  if (d.value.pagado === "credito")
    return `Queda anotado que ${n} le debe ${montoTexto.value} al negocio.`;
  if (d.value.origen === "propio")
    return `Entonces ${n} te tiene que devolver ${montoTexto.value}.`;
  if (d.value.origen === "combinado")
    return resumenPagoCombinado(
      d.value,
      props.fecha,
      parteNombre(d.value.propietario_id) || "la persona elegida",
    );
  if (d.value.origen === "fondo")
    return `Se descuenta del fondo de ${parteNombre(d.value.propietario_id) || "la persona elegida"}.`;
  if (d.value.origen === "tercero") return "No queda nada pendiente para vos.";
  return "";
});
const resumen = computed(() => [
  {
    etiqueta: "Fotos",
    valor: fotos.value.length
      ? fotos.value.map((f) => nombreClase[f.clase]).join(", ")
      : d.value.comprobante === "pendiente"
        ? "La factura llega después"
        : "Sin factura",
    paso: fotos.value.length ? "fotos" : "camara",
  },
  { etiqueta: "Gestión", valor: gestionNombre.value, paso: "importe" },
  {
    etiqueta: "Negocio",
    valor: `${d.value.proveedor} · ${d.value.concepto}`,
    paso: "donde",
  },
  {
    etiqueta: "Para quién",
    valor:
      d.value.quien === "varios"
        ? d.value.reparto
            .map(
              (r) => `${parteNombre(r.parte_id)}: ${r.monto} ${d.value.moneda}`,
            )
            .join("; ")
        : parteNombre(d.value.quien),
    paso: "quien",
  },
  { etiqueta: "Pago", valor: resultado.value, paso: "pago" },
  ...(d.value.quien === "varios"
    ? d.value.reparto.map((r, i) => ({
        etiqueta: `Pago ${i + 1}`,
        valor: `${parteNombre(r.parte_id)}: ${r.origen === "propio" ? "mi dinero" : r.origen === "fondo" ? `fondo de ${parteNombre(r.pagador_id)}` : `pagó ${parteNombre(r.pagador_id)}`} · ${r.monto} ${d.value.moneda}`,
        paso: "pago",
      }))
    : []),
]);

/* ---------- Teclado ---------- */
function pulsar(k) {
  let m = d.value.monto || "";
  if (k === "del") m = m.slice(0, -1);
  else if (k === ".") {
    if (!m.includes(".")) m = (m || "0") + ".";
  } else {
    const [, dec] = m.split(".");
    if (dec !== undefined && dec.length >= 2) return;
    if (m.replace(".", "").length >= 9) return;
    m = m === "0" ? k : m + k;
  }
  d.value.monto = m;
}

/* ---------- Guardar ---------- */
async function guardar() {
  if (ocupado.value) return;
  ocupado.value = true;
  error.value = "";
  try {
    if (["fondo", "combinado"].includes(d.value.origen) && !hayFondos.value)
      throw new Error(
        "No hay fondos suyos guardados en esta gestión y moneda.",
      );
    const entrada = prepararCompraGuiada(d.value, props.fecha);
    const imagenesConfirmadas = fotos.value.map((f) => ({
      bytes: Uint8Array.from(f.bytes),
      tipo: f.tipo,
      clase: f.clase,
      ...(f.ajuste ? { ajuste: JSON.parse(JSON.stringify(f.ajuste)) } : {}),
    }));
    const confirmado = {
      monto: dinero(entrada.importe, entrada.moneda),
      proveedor: entrada.proveedor,
      fotos: imagenesConfirmadas.length,
      gestion: gestionNombre.value,
    };
    const { creada } = await ejecutarGuardadoGuiado(async () => {
      await diferido.detener();
      try {
        const r = await props.api.compras.registrar({
          ...entrada,
          imagenes: imagenesConfirmadas,
        });
        if (borradorListo) await borradores.descartar(CLAVE_BORRADOR);
        return r;
      } catch (e) {
        diferido.reanudar();
        if (borradorListo) {
          diferido.programar(datosBorrador);
          await diferido.vaciar();
        }
        diferido.reanudar();
        throw e;
      }
    });
    guardado.value = {
      ...confirmado,
      creada,
    };
    const resultadoGuardado = guardado.value;
    pantalla.value = "listo";
    emit("guardado");
    if (entrada.gestion_id) {
      try {
        const { cuentas } = await props.api.saldos.cuentas({
          gestion_id: entrada.gestion_id,
        });
        resultadoGuardado.cuentas = cuentas.filter(
          (c) =>
            c.gestion_id === entrada.gestion_id &&
            c.moneda === entrada.moneda &&
            c.parte_id,
        );
      } catch {
        resultadoGuardado.avisoSaldo =
          "La compra se guardó. Consultá el saldo en Ver mi caja.";
      }
    }
  } catch (e) {
    if (pantalla.value !== "listo") {
      diferido.reanudar();
      if (borradorListo) diferido.programar(datosBorrador);
    }
    error.value = e?.message || "No se pudo guardar el gasto.";
  } finally {
    ocupado.value = false;
  }
}
function otro() {
  fotos.value.forEach((f) => URL.revokeObjectURL(f.url));
  fotos.value = [];
  d.value = nuevoRegistro();
  guardado.value = null;
  actual.value = 0;
  diferido.reanudar();
  ir("camara");
}

/* ---------- Borrador ---------- */
function datosBorrador() {
  return {
    d: JSON.parse(JSON.stringify(d.value)),
    pantalla: pantalla.value,
    fotos: fotos.value.map((f) => ({
      bytes: Uint8Array.from(f.bytes),
      tipo: f.tipo,
      clase: f.clase,
      ajuste: f.ajuste ? JSON.parse(JSON.stringify(f.ajuste)) : null,
    })),
  };
}
watch(
  [d, fotos, pantalla],
  () => {
    if (!borradorListo || pantalla.value === "listo") return;
    diferido.programar(datosBorrador);
  },
  { deep: true, flush: "sync" },
);
onMounted(async () => {
  try {
    await esperarGuardadoGuiado();
    const b = await borradores.obtener(CLAVE_BORRADOR);
    if (b) {
      d.value = { ...nuevoRegistro(), ...b.d };
      fotos.value = (b.fotos || []).map((f) => ({
        ...f,
        url: urlDe(f.bytes, f.tipo),
      }));
      pantalla.value = PASOS.some((p) => p.id === b.pantalla)
        ? b.pantalla
        : "camara";
      aviso.value = "Seguimos donde lo dejaste.";
    }
    borradorListo = true;
  } catch {
    aviso.value = "No se pueden guardar borradores en este teléfono.";
  }
});
onUnmounted(() => {
  diferido.vaciar().catch(() => {});
  fotos.value.forEach((f) => URL.revokeObjectURL(f.url));
});
</script>

<template>
  <div
    class="guiada"
    :style="estilo"
    :aria-busy="ocupado"
    :inert="ocupado || undefined"
  >
    <input
      id="guiada-archivo"
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      hidden
      @change="elegirArchivos"
    />

    <EditorComprobante
      v-if="editor"
      :src="editor.src"
      :inicial="editor.ajuste"
      @guardar="guardarRecorte"
      @cancelar="editor = null"
    />

    <!-- Paso 1 · Cámara -->
    <section v-else-if="pantalla === 'camara'" class="camara">
      <div class="camara-barra">
        <button
          type="button"
          class="redondo oscuro"
          aria-label="Cerrar"
          @click="emit('cerrar')"
        >
          ✕
        </button>
        <strong>Paso 1 de 7 · Fotos</strong>
        <button
          type="button"
          class="redondo oscuro"
          role="switch"
          :aria-checked="aprendizaje"
          aria-label="Modo aprendizaje"
          @click="emit('aprendizaje', !aprendizaje)"
        >
          ?
        </button>
      </div>
      <PasosGuiados :pasos="PASOS" :actual="0" oscuro />
      <div class="consejo">
        <strong v-if="!fotos.length">Sacale foto a la factura</strong>
        <strong v-else-if="fotos.length === 1"
          >¡Bien! ¿Tenés otra parte o el voucher?</strong
        >
        <strong v-else>Llevás {{ fotos.length }} fotos</strong>
        <ol v-if="ayuda">
          <li v-for="p in ayuda.pasos" :key="p">{{ p }}</li>
        </ol>
      </div>
      <div
        class="tipo-captura"
        role="radiogroup"
        aria-label="Qué vas a fotografiar"
      >
        <button
          v-for="(n, k) in nombreClase"
          :key="k"
          type="button"
          role="radio"
          :aria-checked="claseCaptura === k"
          :class="{ activo: claseCaptura === k }"
          @click="claseCaptura = k"
        >
          {{ n }}
        </button>
      </div>
      <button type="button" class="disparador" @click="sacarFoto">
        Sacar foto
      </button>
      <button
        type="button"
        class="enlace-claro"
        @click="sinFactura = !sinFactura"
      >
        No tengo la factura
      </button>
      <div v-if="sinFactura" class="sin-factura">
        <button type="button" @click="sinFotoDeFactura('pendiente')">
          Me la dan después
        </button>
        <button type="button" @click="sinFotoDeFactura('sin_factura')">
          No hay factura
        </button>
      </div>
      <div class="tira">
        <div class="tira-fotos">
          <img
            v-for="(f, i) in fotos"
            :key="f.url"
            :src="f.url"
            :alt="`Foto ${i + 1}: ${nombreClase[f.clase]}`"
          />
        </div>
        <button
          type="button"
          class="primario"
          :disabled="!fotos.length"
          @click="ir('fotos')"
        >
          Listo ({{ fotos.length }})
        </button>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </section>

    <!-- Pasos 2 a 7 -->
    <template v-else-if="enAsistente">
      <header class="barra">
        <button
          type="button"
          class="redondo"
          aria-label="Volver al paso anterior"
          @click="retroceder"
        >
          ‹
        </button>
        <strong>Paso {{ idx + 1 }} de 7 · {{ PASOS[idx].nombre }}</strong>
        <button
          type="button"
          class="redondo"
          :class="{ encendido: aprendizaje }"
          role="switch"
          :aria-checked="aprendizaje"
          aria-label="Modo aprendizaje"
          @click="emit('aprendizaje', !aprendizaje)"
        >
          ?
        </button>
      </header>
      <PasosGuiados :pasos="PASOS" :actual="idx" />

      <main class="cuerpo">
        <p v-if="aviso" class="aviso" role="status">{{ aviso }}</p>

        <div v-if="ayuda" class="ayuda">
          <strong class="ayuda-titulo">Cómo hacerlo</strong>
          <ol>
            <li v-for="p in ayuda.pasos" :key="p">{{ p }}</li>
          </ol>
          <p v-if="ayuda.ejemplo">
            <strong>Ejemplo:</strong> {{ ayuda.ejemplo }}
          </p>
          <p><strong>¿Para qué sirve?</strong> {{ ayuda.porque }}</p>
        </div>

        <!-- 2 · Fotos -->
        <template v-if="pantalla === 'fotos'">
          <h1>Revisá que se lean bien</h1>
          <div
            class="carrusel"
            role="group"
            aria-roledescription="carrusel"
            aria-label="Fotos del gasto"
            @touchstart.passive="toqueInicio"
            @touchend="toqueFin"
            @mousedown="toqueInicio"
            @mouseup="toqueFin"
          >
            <img
              v-for="s in diapositivas"
              :key="s.foto.url + s.o"
              :src="s.foto.url"
              :alt="s.o === 0 ? `Foto ${s.i + 1} de ${fotos.length}` : ''"
              :aria-hidden="s.o !== 0"
              class="diapositiva"
              :style="{
                transform: `translateX(${s.o * 70}%) scale(${s.o === 0 ? 1 : 0.75}) rotate(${s.foto.ajuste?.rotacion || 0}deg)`,
                opacity: s.o === 0 ? 1 : 0.4,
                zIndex: s.o === 0 ? 2 : 1,
              }"
              draggable="false"
            />
            <button
              type="button"
              class="flecha izq"
              aria-label="Foto anterior"
              @click="pasarFoto(-1)"
            >
              ‹
            </button>
            <button
              type="button"
              class="flecha der"
              aria-label="Foto siguiente"
              @click="pasarFoto(1)"
            >
              ›
            </button>
            <span class="posicion" aria-live="polite"
              >{{ indiceCircular(actual, fotos.length) + 1 }} de
              {{ fotos.length }}</span
            >
          </div>
          <div
            v-if="fotoActual"
            class="chips"
            role="radiogroup"
            aria-label="Esta foto es"
          >
            <span>Esta foto es:</span>
            <button
              v-for="(n, k) in nombreClase"
              :key="k"
              type="button"
              role="radio"
              :aria-checked="fotoActual.clase === k"
              :class="{ activo: fotoActual.clase === k }"
              @click="fotoActual.clase = k"
            >
              {{ n }}
            </button>
          </div>
          <div class="acciones3">
            <button type="button" @click="girar">Girar</button>
            <button type="button" @click="recortar">Recortar</button>
            <button type="button" class="peligro" @click="quitarFoto">
              Quitar
            </button>
          </div>
          <p class="nota">Orden en el informe · arrastrá o usá los botones</p>
          <div class="miniaturas">
            <button
              v-for="(f, i) in fotos"
              :key="f.url"
              type="button"
              draggable="true"
              :class="{ activo: i === indiceCircular(actual, fotos.length) }"
              :aria-label="`Foto ${i + 1}, ${nombreClase[f.clase]}`"
              @click="actual = i"
              @dragstart="arrastre = i"
              @dragover.prevent
              @drop.prevent="soltarEn(i)"
            >
              <img :src="f.url" alt="" />
              <span>{{ i + 1 }}</span>
            </button>
            <button
              type="button"
              class="mas"
              aria-label="Sacar otra foto"
              @click="ir('camara')"
            >
              ＋
            </button>
          </div>
          <div class="acciones2">
            <button
              type="button"
              @click="
                mover(
                  indiceCircular(actual, fotos.length),
                  indiceCircular(actual, fotos.length) - 1,
                )
              "
            >
              ← Antes
            </button>
            <button
              type="button"
              @click="
                mover(
                  indiceCircular(actual, fotos.length),
                  indiceCircular(actual, fotos.length) + 1,
                )
              "
            >
              Después →
            </button>
          </div>
        </template>

        <!-- 3 · Importe -->
        <template v-if="pantalla === 'importe'">
          <h1>¿Cuánto fue en total?</h1>
          <label class="campo">
            <span>Fecha de la compra</span>
            <input v-model="d.fecha" type="date" required />
          </label>
          <label class="campo">
            <span>Lo anoto en la gestión</span>
            <select v-model="d.gestion_id">
              <option v-for="g in abiertas" :key="g.id" :value="g.id">
                {{ g.nombre }}
              </option>
              <option value="">Sin gestión</option>
            </select>
          </label>
          <button
            v-if="!nuevaGestion.visible"
            type="button"
            class="secundario"
            @click="nuevaGestion.visible = true"
          >
            ＋ Crear una gestión nueva
          </button>
          <div v-else class="alta">
            <label class="campo">
              <span>Nombre de la gestión (el encargo o viaje)</span>
              <input
                v-model="nuevaGestion.nombre"
                type="text"
                autocomplete="off"
                placeholder="Ej.: Viaje a León"
              />
            </label>
            <div class="acciones2">
              <button type="button" @click="nuevaGestion.visible = false">
                Cancelar
              </button>
              <button type="button" class="primario" @click="crearGestion">
                Crear y elegir
              </button>
            </div>
          </div>
          <div class="segmento" role="radiogroup" aria-label="Moneda">
            <button
              type="button"
              role="radio"
              :aria-checked="d.moneda === 'NIO'"
              :class="{ activo: d.moneda === 'NIO' }"
              @click="d.moneda = 'NIO'"
            >
              C$ Córdobas
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="d.moneda === 'USD'"
              :class="{ activo: d.moneda === 'USD' }"
              @click="d.moneda = 'USD'"
            >
              US$ Dólares
            </button>
          </div>
          <output class="monto" aria-live="polite">{{ montoTexto }}</output>
          <div class="teclado">
            <button
              v-for="k in [
                '1',
                '2',
                '3',
                '4',
                '5',
                '6',
                '7',
                '8',
                '9',
                '.',
                '0',
                'del',
              ]"
              :key="k"
              type="button"
              :aria-label="k === 'del' ? 'Borrar' : k === '.' ? 'Punto' : k"
              @click="pulsar(k)"
            >
              {{ k === "del" ? "⌫" : k }}
            </button>
          </div>
        </template>

        <!-- 4 · Dónde -->
        <template v-if="pantalla === 'donde'">
          <h1>¿Dónde compraste y qué?</h1>
          <label class="campo">
            <span>Nombre del negocio</span>
            <input
              v-model="d.proveedor"
              type="text"
              autocomplete="off"
              placeholder="Como dice arriba en la factura"
            />
          </label>
          <label class="campo">
            <span>¿Qué compraste? En pocas palabras</span>
            <input
              v-model="d.concepto"
              type="text"
              autocomplete="off"
              placeholder="Ej.: combustible, materiales"
            />
          </label>
          <label v-if="d.comprobante === 'factura'" class="campo">
            <span>Número de factura (si lo tiene)</span>
            <input
              v-model="d.factura"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="Con los ceros de adelante"
            />
          </label>
        </template>

        <!-- 5 · Para quién -->
        <template v-if="pantalla === 'quien'">
          <h1>¿Para quién es este gasto?</h1>
          <div class="opciones" role="radiogroup" aria-label="Para quién">
            <button
              v-for="o in opcionesQuien"
              :key="o.id"
              type="button"
              role="radio"
              :aria-checked="d.quien === o.id"
              :class="{ activo: d.quien === o.id }"
              @click="
                d.quien = o.id;
                d.pagado = '';
                d.origen = '';
              "
            >
              <strong>{{ o.titulo }}</strong
              ><small>{{ o.detalle }}</small>
            </button>
          </div>
          <div v-if="d.quien === 'varios'" class="alta">
            <strong>¿Cuánto corresponde a cada uno?</strong>
            <p>La suma debe ser igual al total de la compra.</p>
            <div v-for="(r, i) in d.reparto" :key="i" class="alta">
              <label class="campo"
                ><span>Destino {{ i + 1 }}</span
                ><select v-model="r.parte_id">
                  <option value="">Elegí un destino</option>
                  <option
                    v-for="p in todasLasPartes.filter((x) => x.activa !== 0)"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.nombre }}
                  </option>
                  <option value="personal">Gasto mío</option>
                </select></label
              >
              <label class="campo"
                ><span>Importe</span
                ><input
                  v-model="r.monto"
                  inputmode="decimal"
                  placeholder="0.00"
              /></label>
              <button
                type="button"
                class="secundario"
                @click="d.reparto.splice(i, 1)"
              >
                Quitar parte
              </button>
            </div>
            <button
              type="button"
              class="secundario"
              @click="
                d.reparto.push({
                  parte_id: '',
                  monto: '',
                  origen: '',
                  pagador_id: '',
                })
              "
            >
              Agregar parte del gasto
            </button>
          </div>
          <button
            v-if="!alta.visible"
            type="button"
            class="secundario"
            @click="alta.visible = true"
          >
            ＋ No está en la lista: agregar empresa o persona
          </button>
          <div v-else class="alta">
            <strong>¿A quién agregás?</strong>
            <div class="segmento" role="radiogroup" aria-label="Es una">
              <button
                type="button"
                role="radio"
                :aria-checked="alta.tipo === 'empresa'"
                :class="{ activo: alta.tipo === 'empresa' }"
                @click="alta.tipo = 'empresa'"
              >
                Empresa
              </button>
              <button
                type="button"
                role="radio"
                :aria-checked="alta.tipo === 'persona'"
                :class="{ activo: alta.tipo === 'persona' }"
                @click="alta.tipo = 'persona'"
              >
                Persona
              </button>
            </div>
            <label class="campo">
              <span>Nombre, como querés que salga en el informe</span>
              <input v-model="alta.nombre" type="text" autocomplete="off" />
            </label>
            <div class="acciones2">
              <button type="button" @click="alta.visible = false">
                Cancelar
              </button>
              <button type="button" class="primario" @click="agregarParte">
                Agregar y elegir
              </button>
            </div>
          </div>
        </template>

        <!-- 6 · Pago -->
        <template v-if="pantalla === 'pago'">
          <h1>¿Ya está pagado?</h1>
          <div class="opciones" role="radiogroup" aria-label="Ya está pagado">
            <button
              v-for="o in opcionesPagado"
              :key="o.id"
              type="button"
              role="radio"
              :aria-checked="d.pagado === o.id"
              :class="{ activo: d.pagado === o.id }"
              @click="
                d.pagado = o.id;
                d.origen = '';
              "
            >
              <strong>{{ o.titulo }}</strong
              ><small>{{ o.detalle }}</small>
            </button>
          </div>
          <template v-if="d.pagado === 'si' && d.quien === 'varios'">
            <div v-for="(r, i) in d.reparto" :key="i" class="alta">
              <strong
                >{{ parteNombre(r.parte_id) }} · {{ r.monto }}
                {{ d.moneda }}</strong
              >
              <label class="campo"
                ><span>¿Cómo se pagó esta parte?</span
                ><select v-model="r.origen">
                  <option value="">Elegí una opción</option>
                  <option value="propio">Con mi dinero</option>
                  <option value="fondo">Con dinero recibido</option>
                  <option value="tercero">
                    Pagó otra persona directamente
                  </option>
                </select></label
              >
              <label
                v-if="r.origen === 'fondo' || r.origen === 'tercero'"
                class="campo"
                ><span>{{
                  r.origen === "fondo" ? "Dueño del fondo" : "Quién pagó"
                }}</span
                ><select v-model="r.pagador_id">
                  <option value="">Elegí una persona o empresa</option>
                  <option
                    v-for="p in todasLasPartes.filter(
                      (x) =>
                        x.activa !== 0 &&
                        (r.origen !== 'fondo' ||
                          saldos.some(
                            (s) =>
                              s.tipo === 'custodia' &&
                              s.gestion_id === d.gestion_id &&
                              s.moneda === d.moneda &&
                              s.parte_id === x.id &&
                              s.importe > 0,
                          )),
                    )"
                    :key="p.id"
                    :value="p.id"
                  >
                    {{ p.nombre }}
                  </option>
                </select></label
              >
            </div>
          </template>
          <template
            v-if="
              d.pagado === 'si' && !['personal', 'varios'].includes(d.quien)
            "
          >
            <h2>Y, ¿con qué plata se pagó?</h2>
            <div class="opciones" role="radiogroup" aria-label="Con qué plata">
              <button
                v-for="o in opcionesOrigen"
                :key="o.id"
                type="button"
                role="radio"
                :aria-checked="d.origen === o.id"
                :disabled="o.deshabilitada"
                :class="{ activo: d.origen === o.id }"
                @click="d.origen = o.id"
              >
                <strong>{{ o.titulo }}</strong
                ><small>{{ o.detalle }}</small>
              </button>
            </div>
          </template>
          <label
            v-if="
              d.pagado === 'si' &&
              ['fondo', 'combinado'].includes(d.origen) &&
              d.quien !== 'varios'
            "
            class="campo"
            ><span>¿De quién es el dinero recibido?</span
            ><select v-model="d.propietario_id">
              <option value="">Elegí el dueño del fondo</option>
              <option
                v-for="s in saldos.filter(
                  (s) =>
                    s.tipo === 'custodia' &&
                    s.gestion_id === d.gestion_id &&
                    s.moneda === d.moneda &&
                    s.importe > 0,
                )"
                :key="s.parte_id"
                :value="s.parte_id"
              >
                {{ parteNombre(s.parte_id) }} ·
                {{ dinero(s.importe, s.moneda) }} disponibles
              </option>
            </select></label
          >
          <label
            v-if="d.pagado === 'si' && d.origen === 'combinado'"
            class="campo"
            ><span>¿Cuánto pagaste con el fondo?</span
            ><input
              v-model="d.monto_fondo"
              inputmode="decimal"
              placeholder="0.00"
          /></label>
          <label
            v-if="
              d.pagado === 'si' &&
              d.origen === 'tercero' &&
              d.quien !== 'varios'
            "
            class="campo"
            ><span>¿Quién pagó directamente?</span
            ><select v-model="d.pagador_id">
              <option value="">Elegí una persona o empresa</option>
              <option
                v-for="p in todasLasPartes.filter((x) => x.activa !== 0)"
                :key="p.id"
                :value="p.id"
              >
                {{ p.nombre }}
              </option>
            </select></label
          >
          <p
            v-if="
              resultado &&
              (d.origen || d.pagado !== 'si' || d.quien === 'personal')
            "
            class="resultado"
          >
            {{ resultado }}
          </p>
        </template>

        <!-- 7 · Revisar -->
        <template v-if="pantalla === 'revisar'">
          <h1>Mirá que todo esté bien</h1>
          <div class="resumen">
            <div class="resumen-total">
              <strong>{{ montoTexto }}</strong>
            </div>
            <div v-for="r in resumen" :key="r.etiqueta" class="resumen-fila">
              <div>
                <small>{{ r.etiqueta }}</small>
                <span>{{ r.valor }}</span>
              </div>
              <button type="button" @click="ir(r.paso)">Cambiar</button>
            </div>
          </div>
        </template>
      </main>

      <footer class="pie">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button
          type="button"
          class="primario grande"
          :disabled="ocupado"
          @click="avanzar"
        >
          {{
            pantalla === "revisar"
              ? "Guardar el gasto"
              : `Siguiente: ${PASOS[idx + 1].nombre.toLowerCase()}`
          }}
        </button>
        <small>{{
          falta ||
          (pantalla === "revisar"
            ? "Se guarda en este teléfono"
            : `Quedan ${6 - idx} pasos`)
        }}</small>
      </footer>
    </template>

    <!-- Listo -->
    <section v-else-if="pantalla === 'listo' && guardado" class="listo">
      <span class="check" aria-hidden="true">✓</span>
      <h1>
        {{
          guardado.creada
            ? "¡Listo! Quedó guardado"
            : "Este gasto ya estaba guardado"
        }}
      </h1>
      <strong class="monto">{{ guardado.monto }}</strong>
      <p v-if="guardado.avisoSaldo">{{ guardado.avisoSaldo }}</p>
      <div
        v-for="c in guardado.cuentas || []"
        :key="`${c.parte_id}-${c.moneda}`"
      >
        <strong>{{ parteNombre(c.parte_id) }}</strong>
        <p>
          Disponible: {{ dinero(c.custodia, c.moneda) }} · Pendiente de
          reembolso: {{ dinero(c.por_reembolsar, c.moneda) }}
        </p>
      </div>
      <p>
        {{ guardado.proveedor }} · {{ guardado.fotos }} fotos ·
        {{ guardado.gestion }}
      </p>
      <h2>¿Y ahora qué querés hacer?</h2>
      <button type="button" class="primario grande" @click="otro">
        Registrar otro gasto
      </button>
      <button
        type="button"
        class="secundario grande"
        @click="emit('cerrar', 'compras')"
      >
        Ver mis compras
      </button>
      <button type="button" class="enlace" @click="emit('cerrar')">
        Terminé por ahora
      </button>
    </section>
  </div>
</template>

<style src="./guiada.css"></style>
