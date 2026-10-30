<script setup>
import PasosGuiados from "./PasosGuiados.vue";
import { ref, computed } from "vue";
import { centavos, dinero } from "../../dominio/compra.js";
import {
  PASOS_RECIBIR,
  AYUDA_RECIBIR,
  variablesTema,
  partesUnicas,
  textoAnticipoRecibido,
  aplicacionesDeRecepcion,
  faltaEnRecibir,
} from "./guia.js";

const props = defineProps({
  api: { type: Object, required: true },
  gestiones: { type: Array, default: () => [] },
  partes: { type: Array, default: () => [] },
  saldos: { type: Array, default: () => [] },
  aprendizaje: { type: Boolean, default: true },
  tema: { type: String, default: "bosque" },
  fecha: { type: String, required: true },
});
const emit = defineEmits(["guardado", "cerrar", "aprendizaje"]);

const nuevo = () => ({
  id: crypto.randomUUID(),
  parte_id: "",
  monto: "",
  moneda: "NIO",
  fecha: props.fecha,
  para: "",
  gestion_id: "",
  referencia: "",
});
const pantalla = ref("quien"),
  d = ref(nuevo()),
  nuevas = ref([]),
  alta = ref({ visible: false, nombre: "", tipo: "empresa" }),
  error = ref(""),
  aviso = ref(""),
  ocupado = ref(false),
  guardado = ref(null);

const estilo = computed(() => variablesTema(props.tema));
const idx = computed(() =>
  PASOS_RECIBIR.findIndex((p) => p.id === pantalla.value),
);
const ayuda = computed(() =>
  props.aprendizaje ? AYUDA_RECIBIR[pantalla.value] : null,
);
const falta = computed(() =>
  pantalla.value === "cuanto" && !d.value.fecha
    ? "Elegí la fecha en que recibiste el dinero."
    : faltaEnRecibir(pantalla.value, d.value),
);
const partes = computed(() =>
  partesUnicas(props.partes, nuevas.value).filter((p) => p.activa !== 0),
);
const nombreParte = computed(
  () => partes.value.find((p) => p.id === d.value.parte_id)?.nombre || "",
);
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
const nombreGestion = (id) =>
  [...props.gestiones, ...gestionesNuevas.value].find((g) => g.id === id)
    ?.nombre || "";
const montoTexto = computed(() => {
  try {
    return dinero(centavos(d.value.monto || "0"), d.value.moneda);
  } catch {
    return d.value.moneda === "USD" ? "US$ 0.00" : "C$ 0.00";
  }
});
/** Lo que esta parte te debe, por gestión, tal como lo calcula la API. */
const deudas = computed(() =>
  props.saldos.filter(
    (s) =>
      s.tipo === "por_reembolsar" &&
      s.parte_id === d.value.parte_id &&
      s.moneda === d.value.moneda &&
      s.importe > 0 &&
      s.gestion_id,
  ),
);
/** Deudas de compras sin gestión: no se les puede aplicar una devolución aquí. */
const deudasSinGestion = computed(() =>
  props.saldos.some(
    (s) =>
      s.tipo === "por_reembolsar" &&
      s.parte_id === d.value.parte_id &&
      s.moneda === d.value.moneda &&
      s.importe > 0 &&
      !s.gestion_id,
  ),
);
const opcionesGestion = computed(() => {
  if (d.value.para === "devolucion") {
    const conDeuda = deudas.value.map((s) => ({
      id: s.gestion_id,
      titulo: nombreGestion(s.gestion_id),
      detalle: `Te debe ${dinero(s.importe, s.moneda)} en esta gestión`,
    }));
    const resto = abiertas.value
      .filter((g) => !conDeuda.some((c) => c.id === g.id))
      .map((g) => ({
        id: g.id,
        titulo: g.nombre,
        detalle: "No figura que te deba en esta",
      }));
    return [...conDeuda, ...resto];
  }
  return abiertas.value.map((g) => ({
    id: g.id,
    titulo: g.nombre,
    detalle: "Gestión abierta",
  }));
});
const resultado = computed(() => {
  if (d.value.para === "nose")
    return "La guardo sin aplicar. En «Recibir dinero» de la versión clásica podés indicar después a qué va.";
  if (d.value.para === "devolucion")
    return `Lo que ${nombreParte.value} te debía en ${nombreGestion(d.value.gestion_id) || "la gestión"} baja ${montoTexto.value}. No es una ganancia: es tu plata que vuelve.`;
  if (d.value.para === "gastar")
    return textoAnticipoRecibido(
      montoTexto.value,
      nombreParte.value,
      nombreGestion(d.value.gestion_id) || "la gestión",
    );
  return "";
});

function ir(p) {
  error.value = "";
  pantalla.value = p;
  window.scrollTo?.({ top: 0, behavior: "smooth" });
}
function avanzar() {
  if (falta.value) {
    error.value = falta.value;
    return;
  }
  if (pantalla.value === "revisar") return guardar();
  ir(PASOS_RECIBIR[idx.value + 1].id);
}
function retroceder() {
  if (idx.value <= 0) return emit("cerrar");
  ir(PASOS_RECIBIR[idx.value - 1].id);
}
function atras() {
  if (pantalla.value === "listo") return false;
  retroceder();
  return true;
}
defineExpose({ atras });

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
    if (!partes.value.some((p) => p.id === parte.id)) nuevas.value.push(parte);
    d.value.parte_id = parte.id;
    alta.value = { visible: false, nombre: "", tipo: "empresa" };
    aviso.value = `Listo: agregué a «${parte.nombre}» y ya quedó elegida.`;
  } catch (e) {
    error.value = e?.message || "No se pudo agregar.";
  }
}
async function guardar() {
  if (ocupado.value) return;
  ocupado.value = true;
  error.value = "";
  try {
    const { creada } = await props.api.fondos.recibir({
      id: d.value.id,
      fecha: d.value.fecha,
      parte_id: d.value.parte_id,
      importe: centavos(d.value.monto),
      moneda: d.value.moneda,
      referencia: d.value.referencia.trim(),
      aplicaciones: aplicacionesDeRecepcion(d.value),
    });
    guardado.value = {
      monto: montoTexto.value,
      parte: nombreParte.value,
      resultado: resultado.value,
      creada,
    };
    pantalla.value = "listo";
    emit("guardado");
  } catch (e) {
    error.value = e?.message || "No se pudo guardar.";
  } finally {
    ocupado.value = false;
  }
}
function otra() {
  aviso.value = "";
  d.value = nuevo();
  guardado.value = null;
  ir("quien");
}
</script>

<template>
  <div class="guiada" :style="estilo">
    <template v-if="pantalla !== 'listo'">
      <header class="barra">
        <button
          type="button"
          class="redondo"
          aria-label="Volver al paso anterior"
          @click="retroceder"
        >
          ‹
        </button>
        <strong
          >Recibí dinero · paso {{ idx + 1 }} de 4 ·
          {{ PASOS_RECIBIR[idx].nombre }}</strong
        >
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
      <PasosGuiados :pasos="PASOS_RECIBIR" :actual="idx" />

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

        <template v-if="pantalla === 'quien'">
          <h1>¿Quién te dio la plata?</h1>
          <div class="opciones" role="radiogroup" aria-label="Quién">
            <button
              v-for="p in partes"
              :key="p.id"
              type="button"
              role="radio"
              :aria-checked="d.parte_id === p.id"
              :class="{ activo: d.parte_id === p.id }"
              @click="d.parte_id = p.id"
            >
              <strong>{{ p.nombre }}</strong
              ><small>{{ p.tipo === "empresa" ? "Empresa" : "Persona" }}</small>
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
              <span>Nombre</span>
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

        <template v-if="pantalla === 'cuanto'">
          <h1>¿Cuánto te dio {{ nombreParte }}?</h1>
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
          <label class="campo">
            <span>Fecha en que recibiste el dinero</span>
            <input v-model="d.fecha" type="date" required />
          </label>
          <label class="campo">
            <span>Número de depósito o transferencia (si tiene)</span>
            <input v-model="d.referencia" type="text" autocomplete="off" />
          </label>
        </template>

        <template v-if="pantalla === 'para'">
          <h1>¿Para qué es esta plata?</h1>
          <div class="opciones" role="radiogroup" aria-label="Para qué">
            <button
              v-for="o in [
                {
                  id: 'devolucion',
                  titulo: 'Me están devolviendo',
                  detalle: 'Es plata que yo puse de mi bolsa',
                },
                {
                  id: 'gastar',
                  titulo: 'Me la dieron para gastar',
                  detalle: 'Para comprar cosas de un encargo',
                },
                {
                  id: 'nose',
                  titulo: 'No sé todavía',
                  detalle: 'La guardo y lo indico después',
                },
              ]"
              :key="o.id"
              type="button"
              role="radio"
              :aria-checked="d.para === o.id"
              :class="{ activo: d.para === o.id }"
              @click="
                d.para = o.id;
                d.gestion_id = '';
              "
            >
              <strong>{{ o.titulo }}</strong
              ><small>{{ o.detalle }}</small>
            </button>
          </div>
          <template v-if="d.para && d.para !== 'nose'">
            <h2>¿En qué gestión va?</h2>
            <p v-if="d.para === 'devolucion' && deudasSinGestion" class="nota">
              También te debe por compras que no están en ninguna gestión; esas
              se arreglan desde «Mis compras».
            </p>
            <p v-if="!opcionesGestion.length" class="nota">
              Todavía no tenés ninguna gestión abierta. Creala acá abajo.
            </p>
            <div class="opciones" role="radiogroup" aria-label="Gestión">
              <button
                v-for="g in opcionesGestion"
                :key="g.id"
                type="button"
                role="radio"
                :aria-checked="d.gestion_id === g.id"
                :class="{ activo: d.gestion_id === g.id }"
                @click="d.gestion_id = g.id"
              >
                <strong>{{ g.titulo }}</strong
                ><small>{{ g.detalle }}</small>
              </button>
            </div>
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
          </template>
          <p
            v-if="resultado && (d.para === 'nose' || d.gestion_id)"
            class="resultado"
          >
            {{ resultado }}
          </p>
        </template>

        <template v-if="pantalla === 'revisar'">
          <h1>Mirá que todo esté bien</h1>
          <div class="resumen">
            <div class="resumen-total">
              <strong>{{ montoTexto }}</strong>
            </div>
            <div class="resumen-fila">
              <div>
                <small>De quién</small><span>{{ nombreParte }}</span>
              </div>
              <button type="button" @click="ir('quien')">Cambiar</button>
            </div>
            <div class="resumen-fila">
              <div>
                <small>Cuánto y cuándo</small
                ><span>{{ montoTexto }} · {{ d.fecha }}</span>
              </div>
              <button type="button" @click="ir('cuanto')">Cambiar</button>
            </div>
            <div class="resumen-fila">
              <div>
                <small>Para qué</small><span>{{ resultado }}</span>
              </div>
              <button type="button" @click="ir('para')">Cambiar</button>
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
              ? "Guardar"
              : `Siguiente: ${PASOS_RECIBIR[idx + 1].nombre.toLowerCase()}`
          }}
        </button>
        <small>{{
          falta ||
          (pantalla === "revisar"
            ? "Se guarda en este teléfono"
            : `Quedan ${3 - idx} pasos`)
        }}</small>
      </footer>
    </template>

    <section v-else-if="guardado" class="listo">
      <span class="check" aria-hidden="true">✓</span>
      <h1>
        {{
          guardado.creada ? "¡Listo! Quedó anotado" : "Esto ya estaba anotado"
        }}
      </h1>
      <strong class="monto">{{ guardado.monto }}</strong>
      <p>de {{ guardado.parte }}</p>
      <p class="resultado">{{ guardado.resultado }}</p>
      <h2>¿Y ahora qué querés hacer?</h2>
      <button type="button" class="primario grande" @click="otra">
        Anotar otra plata recibida
      </button>
      <button type="button" class="enlace" @click="emit('cerrar')">
        Terminé por ahora
      </button>
    </section>
  </div>
</template>

<style src="./guiada.css"></style>
<style scoped>
.progreso.cuatro {
  grid-template-columns: repeat(4, 1fr);
}
</style>
