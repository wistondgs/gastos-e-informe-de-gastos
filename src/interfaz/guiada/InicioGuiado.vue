<script setup>
import { ref, computed } from "vue";
import { TEMAS, variablesTema } from "./guia.js";
import { dinero } from "../../dominio/compra.js";
import iconoGastos from "../imagenes/icono-gastos.png";

const props = defineProps({
  compras: { type: Array, default: () => [] },
  aprendizaje: { type: Boolean, default: true },
  tema: { type: String, default: "bosque" },
  nombre: { type: String, default: "" },
  gestiones: { type: Array, default: () => [] },
  saldos: { type: Array, default: () => [] },
  partes: { type: Array, default: () => [] },
});
const emit = defineEmits(["registrar", "ir", "aprendizaje", "tema", "clasica"]);

const verTemas = ref(false);
const estilo = computed(() => variablesTema(props.tema));
const abiertas = computed(() => props.gestiones.filter((g) => !g.fecha_fin));
const gestionActiva = computed(() =>
  abiertas.value.length === 1 ? abiertas.value[0] : null,
);
const fondosActivos = computed(() =>
  props.saldos.filter(
    (s) =>
      gestionActiva.value &&
      s.gestion_id === gestionActiva.value.id &&
      s.tipo === "custodia",
  ),
);
const parteNombre = (id) =>
  props.partes.find((p) => p.id === id)?.nombre || "Persona o empresa";
const vigentes = computed(() => props.compras.filter((c) => !c.anulada));
const sinPago = computed(
  () => vigentes.value.filter((c) => c.forma_pago === "sin_detalle").length,
);
const sinFactura = computed(
  () => vigentes.value.filter((c) => c.estado === "pendiente").length,
);
const pendientes = computed(() => {
  const l = [];
  if (sinPago.value)
    l.push(
      sinPago.value === 1
        ? "Indicar cómo se pagó 1 compra."
        : `Indicar cómo se pagaron ${sinPago.value} compras.`,
    );
  if (sinFactura.value)
    l.push(
      sinFactura.value === 1
        ? "Sacarle foto a 1 factura que quedó pendiente."
        : `Sacarle foto a ${sinFactura.value} facturas que quedaron pendientes.`,
    );
  return l;
});
const fecha = new Date().toLocaleDateString("es-NI", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const caminos = [
  {
    destino: "fondos",
    titulo: "Recibí dinero",
    detalle: "Alguien te dio plata o te devolvió lo que pusiste",
  },
  {
    destino: "respaldo",
    titulo: "Generar informe",
    detalle: "Armar el PDF o Excel para quien te pidió cuentas",
  },
  {
    destino: "gestiones",
    titulo: "Ver mi caja",
    detalle: "Tus gestiones, lo que te deben y lo que debés",
  },
  {
    destino: "compras",
    titulo: "Ver mis compras",
    detalle: "Todo lo que ya registraste",
  },
];
</script>

<template>
  <div class="inicio" :style="estilo">
    <header class="saludo">
      <div>
        <img :src="iconoGastos" class="icono-app" alt="" />
        <span class="fecha">{{ fecha }}</span>
        <h1>Hola{{ nombre ? `, ${nombre}` : "" }}.<br />¿Qué querés hacer?</h1>
      </div>
      <button
        type="button"
        class="paleta"
        aria-label="Cambiar los colores de la app"
        :aria-expanded="verTemas"
        @click="verTemas = !verTemas"
      >
        Colores
      </button>
    </header>

    <section v-if="gestionActiva" class="pendiente">
      <strong>Gestión abierta: {{ gestionActiva.nombre }}</strong>
      <p v-if="!fondosActivos.length">No hay fondos disponibles registrados.</p>
      <p v-for="f in fondosActivos" :key="`${f.parte_id}-${f.moneda}`">
        {{ parteNombre(f.parte_id) }} · Disponible:
        {{ dinero(f.importe, f.moneda) }}
      </p>
      <button type="button" @click="emit('ir', 'gestiones')">
        Ver mi caja
      </button>
    </section>
    <p v-else-if="abiertas.length > 1">
      Tenés varias gestiones abiertas. Elegí una en Ver mi caja.
    </p>

    <div
      v-if="verTemas"
      class="temas"
      role="radiogroup"
      aria-label="Colores de la app"
    >
      <button
        v-for="(t, id) in TEMAS"
        :key="id"
        type="button"
        role="radio"
        :aria-checked="tema === id"
        :class="{ activo: tema === id }"
        @click="emit('tema', id)"
      >
        <span
          class="muestra"
          :style="{ background: t.bg, borderColor: t.line }"
        >
          <span :style="{ background: t.acc }"></span>
          <span :style="{ background: t.sur, borderColor: t.line }"></span>
        </span>
        <strong>{{ t.nombre }}</strong>
        <small>{{ t.desc }}</small>
      </button>
    </div>

    <button
      type="button"
      class="interruptor"
      role="switch"
      :aria-checked="aprendizaje"
      @click="emit('aprendizaje', !aprendizaje)"
    >
      <span class="texto">
        <strong
          >Modo aprendizaje: {{ aprendizaje ? "encendido" : "apagado" }}</strong
        >
        <small>{{
          aprendizaje
            ? "Te explico cada paso con ejemplos. Apagalo cuando ya sepás usar la app."
            : "Ves solo lo justo. Prendelo si querés que te vuelva a explicar."
        }}</small>
      </span>
      <span class="riel" :class="{ on: aprendizaje }" aria-hidden="true"
        ><span></span
      ></span>
    </button>

    <button type="button" class="principal" @click="emit('registrar')">
      <strong>Registrar un gasto</strong>
      <span
        >Te abro la cámara. Empezá sacándole foto a la factura; después te
        pregunto lo demás, de a una cosa.</span
      >
      <em>Abrir la cámara →</em>
    </button>

    <section class="caminos">
      <h2>O elegí otra cosa</h2>
      <button
        v-for="c in caminos"
        :key="c.destino"
        type="button"
        @click="emit('ir', c.destino)"
      >
        <strong>{{ c.titulo }}</strong>
        <small>{{ c.detalle }}</small>
      </button>
    </section>

    <section v-if="pendientes.length" class="pendiente">
      <strong
        >Te
        {{
          pendientes.length === 1
            ? "queda 1 cosa"
            : `quedan ${pendientes.length} cosas`
        }}
        por hacer</strong
      >
      <ol>
        <li v-for="p in pendientes" :key="p">{{ p }}</li>
      </ol>
      <button type="button" @click="emit('ir', 'compras')">Ir a hacerlo</button>
    </section>
    <p v-else class="aldia">Estás al día: no te queda nada pendiente.</p>

    <button type="button" class="clasica" @click="emit('clasica')">
      Usar Modo Estándar
    </button>
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
}
.inicio {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24px 20px 32px;
  background: var(--g-bg);
  color: var(--g-ink);
  font-family: var(--g-font);
}
button {
  font-family: inherit;
  cursor: pointer;
  color: inherit;
  text-align: left;
}
.saludo {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.fecha {
  font-size: 15px;
  font-weight: 600;
  color: var(--g-ink2);
  display: inline-block;
}
.fecha::first-letter {
  text-transform: uppercase;
}
h1 {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1.2;
}
h2 {
  margin: 0;
  font-size: 15px;
  color: var(--g-ink2);
}
.paleta {
  flex: none;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  border: var(--g-borde) solid var(--g-line);
  background: var(--g-sur);
  font-weight: 800;
}
.temas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.temas button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 16px;
  border: 3px solid transparent;
  background: var(--g-sur);
}
.temas button.activo {
  border-color: var(--g-acc);
}
.muestra {
  display: flex;
  gap: 6px;
  height: 48px;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid;
}
.muestra span {
  flex: 1;
  border-radius: 6px;
  border: 1px solid transparent;
}
.temas small {
  color: var(--g-ink2);
}
.interruptor {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--g-r);
  border: 2px solid var(--g-line);
  background: var(--g-sur);
}
.interruptor[aria-checked="true"] {
  border-color: var(--g-acc);
}
.texto {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.texto strong {
  font-size: 16px;
}
.texto small {
  font-size: 14px;
  color: var(--g-ink2);
  line-height: 1.4;
}
.riel {
  flex: none;
  position: relative;
  width: 56px;
  height: 32px;
  border-radius: 999px;
  background: var(--g-ink2);
}
.riel span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
}
.riel.on {
  background: var(--g-acc);
}
.riel.on span {
  left: 27px;
}
.principal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 20px;
  border: none;
  border-radius: var(--g-r);
  background: var(--g-acc);
  color: var(--g-onAcc);
}
.principal strong {
  font-size: 24px;
}
.principal span {
  font-size: 16px;
  line-height: 1.45;
}
.principal em {
  font-style: normal;
  font-weight: 800;
  font-size: 17px;
}
.caminos {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.caminos button {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 72px;
  padding: 12px 16px;
  border-radius: var(--g-r);
  border: var(--g-borde) solid var(--g-line);
  background: var(--g-sur);
}
.caminos strong {
  font-size: 18px;
}
.caminos small {
  font-size: 14px;
  color: var(--g-ink2);
}
.pendiente {
  padding: 16px;
  border-radius: var(--g-r);
  background: var(--g-warnBg);
  color: var(--g-warnInk);
}
.pendiente ol {
  margin: 8px 0 12px;
  padding-left: 22px;
  line-height: 1.5;
}
.pendiente button {
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  border: none;
  background: var(--g-warnInk);
  color: var(--g-warnBg);
  font-weight: 800;
}
.aldia {
  margin: 0;
  padding: 14px 16px;
  border-radius: var(--g-r);
  background: var(--g-accSoft);
  color: var(--g-accSoftInk);
  font-weight: 700;
}
.clasica {
  align-self: center;
  min-height: 48px;
  border: none;
  background: none;
  color: var(--g-ink2);
  text-decoration: underline;
  font-weight: 700;
}
</style>
