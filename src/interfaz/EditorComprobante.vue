<script setup>
import { ref, watch, onMounted, nextTick } from "vue";
const props = defineProps({
  src: { type: String, required: true },
  inicial: { type: Object, required: true },
});
const emit = defineEmits(["guardar", "cancelar"]);
const lienzo = ref(null),
  error = ref("");
const anterior =
  typeof props.inicial.recorte === "string"
    ? JSON.parse(props.inicial.recorte)
    : props.inicial.recorte;
const rotacion = ref(props.inicial.rotacion || 0),
  enderezar = ref(props.inicial.enderezar || 0);
const recorte = ref(anterior || { x: 0, y: 0, w: 1, h: 1 });
let foto = null;
function parametros() {
  const r = Object.fromEntries(
    Object.entries(recorte.value).map(([k, v]) => [k, Number(v)]),
  );
  if (
    r.x < 0 ||
    r.y < 0 ||
    r.w < 0.2 ||
    r.h < 0.2 ||
    r.x + r.w > 1 ||
    r.y + r.h > 1
  )
    throw new Error(
      "El recorte debe quedar dentro de la imagen y conservar al menos un 20 % por lado.",
    );
  return {
    rotacion: Number(rotacion.value),
    enderezar: Number(enderezar.value),
    recorte: r,
  };
}
async function dibujar() {
  if (!foto || !lienzo.value) return;
  try {
    const a = parametros();
    error.value = "";
    const escala = Math.min(
      1,
      1200 / Math.max(foto.naturalWidth, foto.naturalHeight),
    );
    const w = Math.round(foto.naturalWidth * escala),
      h = Math.round(foto.naturalHeight * escala);
    const girado = document.createElement("canvas");
    girado.width = a.rotacion % 180 ? h : w;
    girado.height = a.rotacion % 180 ? w : h;
    const ctx = girado.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, girado.width, girado.height);
    ctx.translate(girado.width / 2, girado.height / 2);
    ctx.rotate(((a.rotacion + a.enderezar) * Math.PI) / 180);
    ctx.drawImage(foto, -w / 2, -h / 2, w, h);
    const { x, y, w: rw, h: rh } = a.recorte;
    lienzo.value.width = Math.max(1, Math.round(girado.width * rw));
    lienzo.value.height = Math.max(1, Math.round(girado.height * rh));
    lienzo.value
      .getContext("2d")
      .drawImage(
        girado,
        x * girado.width,
        y * girado.height,
        rw * girado.width,
        rh * girado.height,
        0,
        0,
        lienzo.value.width,
        lienzo.value.height,
      );
  } catch (e) {
    error.value = e.message;
  }
}
function guardar() {
  try {
    emit("guardar", parametros());
  } catch (e) {
    error.value = e.message;
  }
}
function restablecer() {
  rotacion.value = 0;
  enderezar.value = 0;
  recorte.value = { x: 0, y: 0, w: 1, h: 1 };
}
onMounted(async () => {
  foto = new Image();
  foto.onload = () => dibujar();
  foto.onerror = () => {
    error.value = "No se pudo abrir la imagen.";
  };
  foto.src = props.src;
  await nextTick();
});
watch([rotacion, enderezar, recorte], dibujar, { deep: true });
</script>
<template>
  <section class="editor">
    <h3>Ajustar comprobante</h3>
    <p>
      La imagen original se conserva. El recorte usa fracciones entre 0 y 1.
    </p>
    <canvas
      ref="lienzo"
      aria-label="Vista previa del comprobante ajustado"
    ></canvas>
    <label
      >Giro<select v-model.number="rotacion">
        <option :value="0">Sin giro</option>
        <option :value="90">90°</option>
        <option :value="180">180°</option>
        <option :value="270">270°</option>
      </select></label
    >
    <label
      >Enderezar: {{ enderezar }}°<input
        v-model.number="enderezar"
        type="range"
        min="-15"
        max="15"
        step="0.5"
    /></label>
    <div class="campos">
      <label
        v-for="(titulo, campo) in {
          x: 'Izquierda',
          y: 'Arriba',
          w: 'Ancho',
          h: 'Alto',
        }"
        :key="campo"
        >{{ titulo
        }}<input
          v-model.number="recorte[campo]"
          type="number"
          min="0"
          max="1"
          step="0.01"
      /></label>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="botones">
      <button type="button" @click="restablecer">Restablecer</button
      ><button type="button" @click="emit('cancelar')">Cancelar</button
      ><button type="button" @click="guardar">Guardar ajustes</button>
    </div>
  </section>
</template>
<style scoped>
.editor {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid #b9cfc1;
  border-radius: 12px;
  background: white;
}
canvas {
  display: block;
  max-width: 100%;
  max-height: 400px;
  margin: auto;
  object-fit: contain;
}
label {
  display: grid;
  gap: 4px;
}
.campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
