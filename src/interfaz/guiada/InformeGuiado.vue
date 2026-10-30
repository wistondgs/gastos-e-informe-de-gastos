<script setup>
import PasosGuiados from "./PasosGuiados.vue";
import { ref, computed } from "vue";
import { dinero } from "../../dominio/compra.js";
import { compartir, bytesABase64 } from "../../datos/archivos.js";
import {
  PASOS_INFORME,
  AYUDA_INFORME,
  variablesTema,
  alcanceDeInforme,
  faltaEnInforme,
} from "./guia.js";

const props = defineProps({
  api: { type: Object, required: true },
  gestiones: { type: Array, default: () => [] },
  partes: { type: Array, default: () => [] },
  ajustes: { type: Object, default: () => ({}) },
  aprendizaje: { type: Boolean, default: true },
  tema: { type: String, default: "bosque" },
  fecha: { type: String, required: true },
});
const emit = defineEmits(["emitido", "cerrar", "aprendizaje"]);

const pantalla = ref("que"),
  d = ref({
    tipo: "",
    gestion_id: "",
    gestion_ids: [],
    parte_id: "",
    desde: props.fecha.slice(0, 8) + "01",
    hasta: props.fecha,
    destinatario: props.ajustes?.destinatario || "",
    responsable: props.ajustes?.responsable || "",
    incluirFotos: true,
    papel: "carta",
    estilo: "ejecutivo",
    logotipo: null,
  }),
  vista = ref(null),
  emitido = ref(null),
  error = ref(""),
  ocupado = ref(false);

const estilo = computed(() => variablesTema(props.tema));
const idx = computed(() =>
  PASOS_INFORME.findIndex((p) => p.id === pantalla.value),
);
const ayuda = computed(() =>
  props.aprendizaje ? AYUDA_INFORME[pantalla.value] : null,
);
const falta = computed(() =>
  faltaEnInforme(pantalla.value, d.value, props.gestiones, props.fecha),
);
const partesActivas = computed(() =>
  props.partes.filter((p) => p.activa !== 0),
);
const tipos = [
  { id: "gestion", titulo: "De una gestión", detalle: "Un encargo o viaje" },
  {
    id: "gestiones",
    titulo: "De varias gestiones",
    detalle: "Reuní varios encargos en un informe",
  },
  {
    id: "parte",
    titulo: "De una empresa o persona",
    detalle: "Solo lo que le corresponde, sin lo de otros",
  },
  { id: "periodo", titulo: "De unas fechas", detalle: "Todo lo de esos días" },
];
const descripcion = computed(() => {
  if (d.value.tipo === "gestiones")
    return props.gestiones
      .filter((g) => d.value.gestion_ids.includes(g.id))
      .map((g) => g.nombre)
      .join(", ");
  if (d.value.tipo === "gestion")
    return (
      props.gestiones.find((g) => g.id === d.value.gestion_id)?.nombre || ""
    );
  if (d.value.tipo === "parte")
    return (
      "Lo de " +
      (props.partes.find((p) => p.id === d.value.parte_id)?.nombre || "")
    );
  if (d.value.tipo === "periodo")
    return `Del ${d.value.desde} al ${d.value.hasta}`;
  return "";
});

function entrada() {
  const { alcance, corte } = alcanceDeInforme(
    d.value,
    props.gestiones,
    props.fecha,
  );
  return {
    alcance,
    opciones: {
      titulo: props.ajustes?.encabezado || "Informe de gastos",
      corte,
      responsable: d.value.responsable.trim(),
      destinatario: d.value.destinatario.trim(),
      papel: d.value.papel,
      estilo: d.value.estilo,
      incluirFotos: d.value.incluirFotos,
      logotipo: d.value.logotipo,
    },
  };
}
async function elegirLogotipo(event) {
  const archivo = event.target.files?.[0];
  event.target.value = "";
  if (!archivo) return;
  if (
    !["image/png", "image/jpeg"].includes(archivo.type) ||
    archivo.size > 1000000
  ) {
    error.value = "Elegí una imagen PNG o JPEG de hasta 1 MB.";
    return;
  }
  d.value.logotipo = `data:${archivo.type};base64,${bytesABase64(new Uint8Array(await archivo.arrayBuffer()))}`;
  error.value = "";
}
async function operar(fn) {
  if (ocupado.value) return;
  ocupado.value = true;
  error.value = "";
  try {
    await fn();
  } catch (e) {
    error.value = e?.message || "No se pudo hacer el informe.";
  } finally {
    ocupado.value = false;
  }
}
function ir(p) {
  error.value = "";
  pantalla.value = p;
  window.scrollTo?.({ top: 0, behavior: "smooth" });
}
async function avanzar() {
  if (falta.value) {
    error.value = falta.value;
    return;
  }
  if (pantalla.value === "revisar") return hacer();
  const siguiente = PASOS_INFORME[idx.value + 1].id;
  if (siguiente === "revisar")
    await operar(async () => {
      vista.value = await props.api.informes.previsualizar(entrada());
      ir("revisar");
    });
  else ir(siguiente);
}
function retroceder() {
  if (idx.value <= 0) return emit("cerrar");
  ir(PASOS_INFORME[idx.value - 1].id);
}
function atras() {
  if (pantalla.value === "listo") return false;
  retroceder();
  return true;
}
defineExpose({ atras });

const totales = computed(() =>
  Object.entries(vista.value?.totales || {})
    .filter(([, t]) => t.cantidad > 0)
    .map(([moneda, t]) => ({
      moneda,
      texto: dinero(t.importe, moneda),
      cantidad: t.cantidad,
    })),
);
async function verComoQueda() {
  await operar(() =>
    compartir(
      `vista-previa-${vista.value.codigo}.pdf`,
      vista.value.bytes,
      "application/pdf",
    ),
  );
}
async function hacer() {
  await operar(async () => {
    const { informe } = await props.api.informes.emitir(entrada());
    emitido.value = informe;
    pantalla.value = "listo";
    emit("emitido");
  });
}
async function compartirPdf() {
  await operar(async () => {
    const { bytes, nombre } = await props.api.informes.abrir(emitido.value.id);
    await compartir(nombre, bytes, "application/pdf");
  });
}
async function compartirExcel() {
  await operar(async () => {
    const { bytes, nombre } = await props.api.informes.excel(emitido.value.id);
    await compartir(
      nombre,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
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
          >Informe · paso {{ idx + 1 }} de 4 ·
          {{ PASOS_INFORME[idx].nombre }}</strong
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
      <PasosGuiados :pasos="PASOS_INFORME" :actual="idx" />

      <main class="cuerpo">
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

        <template v-if="pantalla === 'que'">
          <h1>¿De qué es el informe?</h1>
          <div class="opciones" role="radiogroup" aria-label="De qué">
            <button
              v-for="t in tipos"
              :key="t.id"
              type="button"
              role="radio"
              :aria-checked="d.tipo === t.id"
              :class="{ activo: d.tipo === t.id }"
              @click="d.tipo = t.id"
            >
              <strong>{{ t.titulo }}</strong
              ><small>{{ t.detalle }}</small>
            </button>
          </div>
          <template v-if="d.tipo === 'gestion'">
            <h2>¿Qué gestión?</h2>
            <p v-if="!gestiones.length" class="nota">
              Todavía no tenés gestiones.
            </p>
            <div class="opciones" role="radiogroup" aria-label="Gestión">
              <button
                v-for="g in gestiones"
                :key="g.id"
                type="button"
                role="radio"
                :aria-checked="d.gestion_id === g.id"
                :class="{ activo: d.gestion_id === g.id }"
                @click="d.gestion_id = g.id"
              >
                <strong>{{ g.nombre }}</strong
                ><small>{{
                  g.fecha_fin ? `Terminada el ${g.fecha_fin}` : "Abierta"
                }}</small>
              </button>
            </div>
          </template>
          <template v-if="d.tipo === 'gestiones'">
            <h2>¿Qué gestiones querés incluir?</h2>
            <p class="nota">
              Elegí al menos dos. Podés tocar una opción otra vez para quitarla.
            </p>
            <div class="opciones" aria-label="Gestiones seleccionadas">
              <button
                v-for="g in gestiones"
                :key="g.id"
                type="button"
                :aria-pressed="d.gestion_ids.includes(g.id)"
                :class="{ activo: d.gestion_ids.includes(g.id) }"
                @click="
                  d.gestion_ids = d.gestion_ids.includes(g.id)
                    ? d.gestion_ids.filter((id) => id !== g.id)
                    : [...d.gestion_ids, g.id]
                "
              >
                <strong>{{ g.nombre }}</strong
                ><small>{{
                  g.fecha_fin ? `Terminada el ${g.fecha_fin}` : "Abierta"
                }}</small>
              </button>
            </div>
          </template>
          <template v-if="d.tipo === 'parte'">
            <h2>¿De quién?</h2>
            <div class="opciones" role="radiogroup" aria-label="De quién">
              <button
                v-for="p in partesActivas"
                :key="p.id"
                type="button"
                role="radio"
                :aria-checked="d.parte_id === p.id"
                :class="{ activo: d.parte_id === p.id }"
                @click="
                  d.parte_id = p.id;
                  if (!d.destinatario) d.destinatario = p.nombre;
                "
              >
                <strong>{{ p.nombre }}</strong
                ><small>{{
                  p.tipo === "empresa" ? "Empresa" : "Persona"
                }}</small>
              </button>
            </div>
          </template>
          <template v-if="d.tipo === 'periodo'">
            <label class="campo">
              <span>Desde el día</span>
              <input v-model="d.desde" type="date" />
            </label>
            <label class="campo">
              <span>Hasta el día</span>
              <input v-model="d.hasta" type="date" />
            </label>
          </template>
        </template>

        <template v-if="pantalla === 'para'">
          <h1>¿Para quién es?</h1>
          <label class="campo">
            <span>Quién lo recibe</span>
            <input
              v-model="d.destinatario"
              type="text"
              autocomplete="off"
              placeholder="Ej.: nombre de la empresa"
            />
          </label>
          <label class="campo">
            <span>Tu nombre, como responsable</span>
            <input v-model="d.responsable" type="text" autocomplete="off" />
          </label>
        </template>

        <template v-if="pantalla === 'como'">
          <h1>¿Cómo lo querés?</h1>
          <label class="campo"
            ><span>Logotipo de la empresa (opcional)</span
            ><input
              type="file"
              accept="image/png,image/jpeg"
              @change="elegirLogotipo"
          /></label>
          <p v-if="d.logotipo" class="nota">
            Imagen elegida para este informe.
            <button type="button" @click="d.logotipo = null">
              Quitar imagen
            </button>
          </p>
          <img
            v-if="d.logotipo"
            :src="d.logotipo"
            alt="Vista previa del logotipo de la empresa"
            style="max-width: 120px; max-height: 80px; object-fit: contain"
          />
          <h2>Estilo del informe</h2>
          <div
            class="opciones"
            role="radiogroup"
            aria-label="Estilo del informe"
          >
            <button
              type="button"
              role="radio"
              :aria-checked="d.estilo === 'ejecutivo'"
              :class="{ activo: d.estilo === 'ejecutivo' }"
              @click="d.estilo = 'ejecutivo'"
            >
              <strong>Ejecutivo</strong
              ><small>Resumen para una revisión rápida</small>
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="d.estilo === 'formal'"
              :class="{ activo: d.estilo === 'formal' }"
              @click="d.estilo = 'formal'"
            >
              <strong>Detallado</strong
              ><small>Presentación para imprimir y revisar</small>
            </button>
          </div>
          <h2>Incluir fotografías de comprobantes</h2>
          <div
            class="opciones"
            role="radiogroup"
            aria-label="Fotografías de comprobantes"
          >
            <button
              type="button"
              role="radio"
              :aria-checked="d.incluirFotos"
              :class="{ activo: d.incluirFotos }"
              @click="d.incluirFotos = true"
            >
              <strong>Con fotografías</strong
              ><small>Para que puedan revisarlas</small>
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="!d.incluirFotos"
              :class="{ activo: !d.incluirFotos }"
              @click="d.incluirFotos = false"
            >
              <strong>Sin fotografías</strong
              ><small>Pesa menos y se manda más rápido</small>
            </button>
          </div>
          <h2>Papel</h2>
          <div class="segmento" role="radiogroup" aria-label="Papel">
            <button
              type="button"
              role="radio"
              :aria-checked="d.papel === 'carta'"
              :class="{ activo: d.papel === 'carta' }"
              @click="d.papel = 'carta'"
            >
              Carta
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="d.papel === 'a4'"
              :class="{ activo: d.papel === 'a4' }"
              @click="d.papel = 'a4'"
            >
              A4
            </button>
          </div>
        </template>

        <template v-if="pantalla === 'revisar' && vista">
          <h1>Así va a salir</h1>
          <div class="resumen">
            <div class="resumen-total">
              <strong v-for="t in totales" :key="t.moneda" class="total-linea"
                >{{ t.texto }}
                <small
                  >{{ t.cantidad }}
                  {{ t.cantidad === 1 ? "compra" : "compras" }}</small
                ></strong
              >
              <strong v-if="!totales.length" class="total-linea"
                >Sin compras</strong
              >
            </div>
            <div class="resumen-fila">
              <div>
                <small>De qué</small><span>{{ descripcion }}</span>
              </div>
              <button type="button" @click="ir('que')">Cambiar</button>
            </div>
            <div class="resumen-fila">
              <div>
                <small>Para quién</small><span>{{ d.destinatario }}</span>
              </div>
              <button type="button" @click="ir('para')">Cambiar</button>
            </div>
            <div class="resumen-fila">
              <div>
                <small>Cómo</small
                ><span
                  >{{
                    d.incluirFotos ? `Con ${vista.anexos} fotos` : "Sin fotos"
                  }}
                  · papel {{ d.papel === "a4" ? "A4" : "Carta" }} ·
                  {{ d.estilo === "formal" ? "Detallado" : "Ejecutivo" }}</span
                >
              </div>
              <button type="button" @click="ir('como')">Cambiar</button>
            </div>
          </div>
          <section v-if="vista.financiero?.cuentas?.length">
            <h2>Dinero de la gestión</h2>
            <article
              v-for="c in vista.financiero.cuentas"
              :key="`${c.gestion_id}-${c.parte_id}-${c.moneda}`"
            >
              <strong
                >{{ c.gestion || "Sin gestión" }} · {{ c.parte }} ·
                {{ c.moneda }}</strong
              >
              <p>Recibido y aplicado: {{ dinero(c.recibido, c.moneda) }}</p>
              <p>Usado del fondo: {{ dinero(c.usado_fondo, c.moneda) }}</p>
              <p>
                Dinero propio aportado:
                {{ dinero(c.aportado_propio, c.moneda) }}
              </p>
              <p>Reembolsos recibidos: {{ dinero(c.reembolsado, c.moneda) }}</p>
              <p>Disponible: {{ dinero(c.custodia, c.moneda) }}</p>
              <p>
                Pendiente de reembolso: {{ dinero(c.por_reembolsar, c.moneda) }}
              </p>
              <p>
                Deuda a proveedores: {{ dinero(c.deuda_proveedor, c.moneda) }}
              </p>
              <p v-if="c.por_regularizar">
                Por regularizar: {{ dinero(c.por_regularizar, c.moneda) }}
              </p>
            </article>
          </section>
          <section v-else-if="vista.financiero?.saldos?.length">
            <h2>Obligaciones y fondos al corte</h2>
            <p v-for="(s, i) in vista.financiero.saldos" :key="i">
              {{ s.gestion || "Sin gestión" }} · {{ s.parte }} ·
              {{
                {
                  custodia: "Disponible",
                  por_reembolsar: "Pendiente de reembolso",
                  por_regularizar: "Por regularizar",
                  deuda_proveedor: "Deuda a proveedor",
                }[s.tipo] || s.tipo
              }}:
              {{ dinero(s.importe, s.moneda) }}
            </p>
          </section>
          <p v-else-if="vista.financieroLimitado" class="nota">
            Este alcance muestra compras seleccionadas; no le atribuye los
            saldos de toda la gestión.
          </p>
          <p v-if="!totales.length" class="nota">
            No hay compras en este alcance. Si existen movimientos de dinero
            aplicables, el informe los mostrará por separado.
          </p>
          <button
            type="button"
            class="secundario grande"
            :disabled="ocupado"
            @click="verComoQueda"
          >
            Ver cómo queda (no se guarda)
          </button>
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
              ? "Hacer el informe"
              : `Siguiente: ${PASOS_INFORME[idx + 1].nombre.toLowerCase()}`
          }}
        </button>
        <small>{{
          falta ||
          (pantalla === "revisar"
            ? "Queda guardado y no cambia"
            : `Quedan ${3 - idx} pasos`)
        }}</small>
      </footer>
    </template>

    <section v-else-if="emitido" class="listo">
      <span class="check" aria-hidden="true">✓</span>
      <h1>¡Listo! El informe está hecho</h1>
      <strong class="monto">{{ emitido.codigo }}</strong>
      <p>Revisión {{ emitido.revision }} · al {{ emitido.fecha_corte }}</p>
      <h2>¿Cómo lo mandás?</h2>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button
        type="button"
        class="primario grande"
        :disabled="ocupado"
        @click="compartirPdf"
      >
        Mandar el PDF
      </button>
      <button
        type="button"
        class="secundario grande"
        :disabled="ocupado"
        @click="compartirExcel"
      >
        Mandar el Excel
      </button>
      <p class="nota">
        Revisá a quién se lo mandás: el informe tiene tus compras. Hacer el
        informe no significa que ya te pagaron.
      </p>
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
.total-linea {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.total-linea small {
  font-size: 14px;
  font-weight: 700;
}
.resumen-total {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
