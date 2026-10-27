<script setup>
import { ref, onMounted } from "vue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
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
import { excel, pdf } from "../exportaciones/informes.js";
import { crearRespaldo, restaurarRespaldo } from "../datos/respaldo.js";
const repo = ref(null),
  compras = ref([]),
  seleccion = ref(null),
  fotos = ref([]),
  vistas = ref([]),
  imagenes = ref([]),
  error = ref(""),
  mensaje = ref(""),
  ocupado = ref(false),
  encabezado = ref("Informe de gastos");
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
  encabezado.value = await repo.value.ajuste();
  if (seleccion.value) {
    seleccion.value =
      compras.value.find((c) => c.id === seleccion.value.id) || null;
    fotos.value = seleccion.value
      ? await repo.value.fotos(seleccion.value.id)
      : [];
  }
}
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
async function guardar() {
  await operacion(async () => {
    const c = { ...form.value, importe: centavos(form.value.monto) };
    delete c.monto;
    const creada = await guardarCompra(repo.value, archivos, c, imagenes.value);
    form.value = nuevo();
    imagenes.value = [];
    await cargar();
    mensaje.value = creada
      ? "Compra guardada en el dispositivo."
      : "Esta compra ya estaba guardada.";
  });
}
async function ver(c) {
  await operacion(async () => {
    seleccion.value = c;
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
      <section class="card" aria-labelledby="registro">
        <h2 id="registro">Registrar compra</h2>
        <p class="hint">
          Completá los datos y agregá los comprobantes que tengas.
        </p>
        <form @submit.prevent="guardar">
          <div class="grid">
            <label
              >Fecha de compra<input
                v-model="form.fecha_compra"
                type="date"
                required
            /></label>
            <label
              >Proveedor<input
                v-model.trim="form.proveedor"
                maxlength="250"
                required
            /></label>
            <label class="wide"
              >Concepto<input
                v-model.trim="form.concepto"
                maxlength="250"
                required
            /></label>
            <label
              >Importe<input
                v-model="form.monto"
                inputmode="decimal"
                placeholder="0.00"
                required
            /></label>
            <label
              >Moneda<select v-model="form.moneda">
                <option value="NIO">Córdobas (C$)</option>
                <option value="USD">Dólares (US$)</option>
              </select></label
            >
            <label
              >Número de factura <small>(opcional)</small
              ><input v-model="form.factura" maxlength="100"
            /></label>
            <label
              >Estado del comprobante<select v-model="form.estado">
                <option value="factura">Con factura</option>
                <option value="sin_factura">Sin factura</option>
                <option value="pendiente">Comprobante pendiente</option>
              </select></label
            >
          </div>
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
          <p class="hint">
            Las imágenes se copian al almacenamiento de la aplicación. JPEG o
            PNG, hasta 15 MB cada una.
          </p>
          <div v-for="(imagen, i) in imagenes" :key="i" class="photo-row">
            <span>Imagen {{ i + 1 }}</span
            ><label
              >Tipo<select v-model="imagen.clase">
                <option value="factura">Factura</option>
                <option value="voucher">Voucher</option>
                <option value="otro">Otro</option>
              </select></label
            ><button type="button" class="link" @click="imagenes.splice(i, 1)">
              Quitar
            </button>
          </div>
          <button class="primary" type="submit" :disabled="ocupado || !repo">
            Guardar compra
          </button>
        </form>
      </section>
      <section class="card">
        <h2>Compras guardadas</h2>
        <p v-if="!compras.length" class="hint">
          Todavía no hay compras registradas.
        </p>
        <button
          v-for="c in compras"
          :key="c.id"
          class="purchase"
          type="button"
          @click="ver(c)"
        >
          <span
            ><strong>{{ c.concepto }}</strong
            ><small>{{ c.proveedor }} · {{ c.fecha_compra }}</small></span
          ><strong>{{ dinero(c.importe, c.moneda) }}</strong>
        </button>
      </section>
      <section v-if="seleccion" class="card">
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
      <section class="card">
        <h2>Informes y respaldo</h2>
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
          El respaldo incluye compras y fotos. No tiene contraseña adicional:
          guardalo en un lugar privado. Restaurarlo reemplaza los datos
          actuales.
        </p>
      </section>
      <p class="footer">
        Los datos se guardan en este dispositivo. La aplicación todavía no
        sincroniza información.
      </p>
    </main>
  </div>
</template>
<style scoped>
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
  padding: 0 16px 32px;
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
