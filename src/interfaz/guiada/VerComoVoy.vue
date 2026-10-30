<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { dinero } from "../../dominio/compra.js";
import { variablesTema } from "./guia.js";
const props = defineProps({
  api: { type: Object, required: true },
  gestiones: { type: Array, default: () => [] },
  partes: { type: Array, default: () => [] },
  compras: { type: Array, default: () => [] },
  tema: { type: String, default: "bosque" },
  aprendizaje: { type: Boolean, default: true },
});
const emit = defineEmits([
  "cerrar",
  "gestion",
  "compra",
  "registrar",
  "recibir",
  "aprendizaje",
]);
const cuentas = ref([]),
  recepciones = ref([]),
  gestion = ref("todas"),
  parte = ref("todas"),
  error = ref(""),
  cargando = ref(true);
const historial = ref([]),
  errorHistorial = ref("");
let peticionHistorial = 0;
const estilo = computed(() => variablesTema(props.tema));
const nombreParte = (id) =>
  props.partes.find((p) => p.id === id)?.nombre ||
  (id ? "Persona o empresa no disponible" : "Personal o sin asignar");
const nombreGestion = (id) =>
  props.gestiones.find((g) => g.id === id)?.nombre ||
  (id ? "Gestión no disponible" : "Sin gestión");
const filas = computed(() =>
  cuentas.value.filter(
    (c) =>
      (gestion.value === "todas" ||
        (gestion.value === "sin-gestion"
          ? !c.gestion_id
          : c.gestion_id === gestion.value)) &&
      (parte.value === "todas" || c.parte_id === parte.value),
  ),
);
const sinAplicar = computed(() =>
  recepciones.value.filter(
    (r) =>
      !r.anulada &&
      r.sin_aplicar > 0 &&
      (parte.value === "todas" || r.parte_id === parte.value),
  ),
);
const sinGestion = computed(() =>
  props.compras.filter((c) => !c.gestion_id && !c.anulada),
);
watch(gestion, async (id) => {
  const turno = ++peticionHistorial;
  historial.value = [];
  errorHistorial.value = "";
  if (id === "todas" || id === "sin-gestion") return;
  try {
    const detalle = await props.api.gestiones.detalle(id);
    if (turno === peticionHistorial) historial.value = detalle.historial;
  } catch (e) {
    if (turno === peticionHistorial)
      errorHistorial.value = e?.message || "No se pudo cargar el historial.";
  }
});
const movimientos = computed(() =>
  historial.value.filter(
    (m) =>
      !m.anulada &&
      [
        "anticipo",
        "reembolso",
        "compra",
        "pago",
        "devolucion",
        "traslado",
      ].includes(m.tipo) &&
      (parte.value === "todas" ||
        (m.tipo !== "compra" && m.parte_id === parte.value)),
  ),
);
const tipoMovimiento = (m) =>
  ({
    anticipo: "Dinero aplicado a la gestión",
    reembolso: "Reembolso recibido",
    compra: "Compra registrada",
    pago:
      m.origen === "fondo"
        ? "Pagado con fondos"
        : m.origen === "propio"
          ? "Pagado con dinero propio"
          : "Pago directo",
    devolucion: "Fondos devueltos",
    traslado: "Traslado de fondos",
  })[m.tipo];
onMounted(async () => {
  try {
    const [c, r] = await Promise.all([
      props.api.saldos.cuentas(),
      props.api.fondos.recepciones(),
    ]);
    cuentas.value = c.cuentas;
    recepciones.value = r;
  } catch (e) {
    error.value = e?.message || "No se pudo cargar el estado.";
  } finally {
    cargando.value = false;
  }
});
</script>
<template>
  <div class="guiada" :style="estilo">
    <header class="barra">
      <button
        type="button"
        class="redondo"
        aria-label="Volver al inicio"
        @click="emit('cerrar')"
      >
        ‹</button
      ><strong>Ver mi caja</strong
      ><button
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
    <main class="cuerpo">
      <h1>Tu dinero, explicado</h1>
      <p v-if="aprendizaje">
        Elegí una gestión o persona para ver sus importes. Cada moneda se
        muestra por separado. La custodia es dinero que recibiste para gastar;
        el reembolso es dinero propio que alguien te debe.
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="cargando">Cargando tus movimientos…</p>
      <label
        >Gestión
        <select v-model="gestion">
          <option value="todas">Todas las gestiones</option>
          <option value="sin-gestion">Sin gestión</option>
          <option v-for="g in gestiones" :key="g.id" :value="g.id">
            {{ g.nombre }}{{ g.fecha_fin ? " · Cerrada" : " · Abierta" }}
          </option>
        </select></label
      >
      <label
        >Persona o empresa
        <select v-model="parte">
          <option value="todas">Todas las personas y empresas</option>
          <option v-for="p in partes" :key="p.id" :value="p.id">
            {{ p.nombre }}
          </option>
        </select></label
      >
      <p v-if="!cargando && !filas.length">
        No hay movimientos para esta selección.
      </p>
      <article
        v-for="c in filas"
        :key="`${c.gestion_id}-${c.parte_id}-${c.moneda}`"
        class="tarjeta-cuenta"
      >
        <h2>{{ nombreGestion(c.gestion_id) }}</h2>
        <p>
          <strong>{{ nombreParte(c.parte_id) }} · {{ c.moneda }}</strong>
        </p>
        <dl>
          <div>
            <dt>Fondos aplicados a esta gestión</dt>
            <dd>{{ dinero(c.recibido, c.moneda) }}</dd>
          </div>
          <div>
            <dt>Usado de esos fondos</dt>
            <dd>{{ dinero(c.usado_fondo, c.moneda) }}</dd>
          </div>
          <div>
            <dt>Dinero disponible en custodia</dt>
            <dd>{{ dinero(c.custodia, c.moneda) }}</dd>
          </div>
          <div>
            <dt>Puesto de mi dinero</dt>
            <dd>{{ dinero(c.aportado_propio, c.moneda) }}</dd>
          </div>
          <div>
            <dt>
              {{
                c.parte_id
                  ? nombreParte(c.parte_id) + " me debe reembolsar"
                  : "Reembolso pendiente"
              }}
            </dt>
            <dd>{{ dinero(c.por_reembolsar, c.moneda) }}</dd>
          </div>
          <div>
            <dt>Reembolsos recibidos</dt>
            <dd>{{ dinero(c.reembolsado, c.moneda) }}</dd>
          </div>
          <div>
            <dt>
              {{
                c.parte_id
                  ? nombreParte(c.parte_id) + " debe a proveedores"
                  : "Deuda a proveedores"
              }}
            </dt>
            <dd>{{ dinero(c.deuda_proveedor, c.moneda) }}</dd>
          </div>
          <div v-if="c.por_regularizar">
            <dt>Importe que necesita regularización</dt>
            <dd>{{ dinero(c.por_regularizar, c.moneda) }}</dd>
          </div>
        </dl>
        <button
          v-if="c.gestion_id"
          type="button"
          class="secundario"
          @click="emit('gestion', c.gestion_id)"
        >
          Ver movimientos e historial
        </button>
        <p v-else>
          Estos movimientos no tienen gestión. Abrí la compra para revisarla o
          regularizarla.
        </p>
      </article>
      <section v-if="sinAplicar.length">
        <h2>Dinero recibido sin aplicar</h2>
        <p>
          Está disponible para asignar después; no forma parte del saldo de una
          gestión.
        </p>
        <p v-for="r in sinAplicar" :key="r.id">
          {{ nombreParte(r.parte_id) }} ·
          {{ dinero(r.sin_aplicar, r.moneda) }} · {{ r.fecha }}
        </p>
        <button class="secundario" type="button" @click="emit('recibir')">
          Ver entradas y aplicar dinero
        </button>
      </section>
      <section v-if="gestion !== 'todas' && gestion !== 'sin-gestion'">
        <h2>Movimientos de la gestión</h2>
        <p>
          La compra se muestra una vez; sus pagos explican cómo se financió.
        </p>
        <p v-if="parte !== 'todas'">
          Con un filtro de persona se muestran solo movimientos que la
          identifican; consultá la gestión completa para ver todas las compras y
          pagos.
        </p>
        <p v-if="errorHistorial" role="alert" class="error">
          {{ errorHistorial }}
        </p>
        <p v-else-if="!movimientos.length">
          No hay movimientos visibles para esta selección.
        </p>
        <article
          v-for="m in movimientos"
          :key="`${m.tipo}-${m.id}`"
          class="tarjeta-cuenta"
        >
          <strong>{{ tipoMovimiento(m) }}</strong>
          <p>
            {{ m.fecha }} · {{ m.moneda ? dinero(m.importe, m.moneda) : "" }}
          </p>
          <p
            v-if="
              ['anticipo', 'reembolso'].includes(m.tipo) &&
              !m.fecha_aplicacion_conocida
            "
          >
            La fecha mostrada es de recepción; la fecha de aplicación no está
            registrada.
          </p>
          <p v-if="m.concepto">{{ m.concepto }} · {{ m.proveedor }}</p>
          <p v-if="m.referencia">Referencia: {{ m.referencia }}</p>
          <p v-if="m.parte_id">{{ nombreParte(m.parte_id) }}</p>
          <button
            v-if="m.tipo === 'compra' || m.tipo === 'pago'"
            class="secundario"
            type="button"
            @click="emit('compra', m.tipo === 'compra' ? m.id : m.compra_id)"
          >
            Ver compra y comprobantes
          </button>
        </article>
      </section>
      <section
        v-if="
          sinGestion.length &&
          gestion !== 'todas' &&
          gestion === 'sin-gestion' &&
          parte === 'todas'
        "
      >
        <h2>Compras sin gestión</h2>
        <button
          v-for="c in sinGestion"
          :key="c.id"
          class="secundario"
          type="button"
          @click="emit('compra', c.id)"
        >
          {{ c.concepto }} · {{ dinero(c.importe, c.moneda) }}
        </button>
      </section>
      <div class="acciones">
        <button class="primario" type="button" @click="emit('registrar')">
          Registrar una compra</button
        ><button class="secundario" type="button" @click="emit('recibir')">
          Ver movimientos de dinero
        </button>
      </div>
    </main>
  </div>
</template>
<style scoped>
.tarjeta-cuenta {
  background: var(--g-sur);
  border: 1px solid var(--g-line);
  border-radius: var(--g-r);
  padding: 16px;
}
.tarjeta-cuenta p {
  margin: 5px 0 12px;
}
dl {
  margin: 0 0 12px;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--g-line);
}
dt {
  flex: 1;
}
dd {
  margin: 0;
  font-weight: 800;
  white-space: nowrap;
}
select {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 5px;
  font: inherit;
  color: var(--g-ink);
  background: var(--g-sur);
  border: 1px solid var(--g-line);
  border-radius: 10px;
}
.acciones {
  display: grid;
  gap: 8px;
}
</style>
