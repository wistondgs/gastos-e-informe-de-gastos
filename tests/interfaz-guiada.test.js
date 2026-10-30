import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse, compileTemplate, compileScript } from "@vue/compiler-sfc";
import { entorno, basico, saldo, memoria } from "./apoyo-api.js";
import {
  TEMAS,
  variablesTema,
  leerPreferencias,
  guardarPreferencias,
  indiceCircular,
  moverFoto,
  seleccionDePago,
  faltaEnPaso,
  prepararCompraGuiada,
} from "../src/interfaz/guiada/guia.js";

const respuestas = (extra) => ({
  id: crypto.randomUUID(),
  gestion_id: "g1",
  monto: "4250.75",
  moneda: "NIO",
  proveedor: "Ferretería de prueba",
  concepto: "Materiales",
  factura: "0000124",
  comprobante: "factura",
  quien: "agricola",
  pagado: "si",
  origen: "propio",
  ...extra,
});

test("cada respuesta del asistente produce el saldo que explica en pantalla", async () => {
  const casos = [
    [{ pagado: "si", origen: "propio" }, "por_reembolsar", 425075],
    [{ pagado: "credito", origen: "" }, "deuda_proveedor", 425075],
    [{ pagado: "si", origen: "tercero", pagador_id: "agricola" }, null, 0],
    [{ quien: "personal", pagado: "si", origen: "" }, null, 0],
  ];
  for (const [extra, tipo, esperado] of casos) {
    const { api } = await entorno();
    await basico(api);
    const entrada = prepararCompraGuiada(respuestas(extra), "2026-10-27");
    await api.compras.registrar(entrada);
    const saldos = (await api.saldos.consultar()).saldos;
    if (tipo) assert.equal(saldo(saldos, tipo, "agricola"), esperado);
    else
      assert.deepEqual(
        saldos.filter((s) => s.parte_id === "agricola"),
        [],
        JSON.stringify(extra),
      );
  }
});

test("«No sé todavía» guarda la compra sin detalle, sin inventar deudas", async () => {
  const { api } = await entorno();
  await basico(api);
  const entrada = prepararCompraGuiada(
    respuestas({ pagado: "nose", origen: "" }),
    "2026-10-27",
  );
  const { compra } = await api.compras.registrar(entrada);
  assert.equal(compra.forma_pago, "sin_detalle");
  assert.deepEqual((await api.saldos.consultar()).saldos, []);
});

test("la selección de pago traduce las respuestas simples", () => {
  assert.equal(
    faltaEnPaso("pago", { quien: "a", pagado: "si", origen: "fondo" }),
    "Elegí el dueño del fondo.",
  );
  assert.deepEqual(seleccionDePago({ quien: "a", pagado: "si", origen: "" }), {
    tipo: "",
  });
});

test("cada paso explica qué falta, y el de pago pide el pago, no una persona (E-15)", () => {
  const vacio = respuestas({
    monto: "",
    proveedor: "",
    concepto: "",
    quien: "",
    pagado: "",
    origen: "",
  });
  assert.match(faltaEnPaso("importe", { ...vacio, fotos: [] }), /total/);
  assert.match(faltaEnPaso("donde", { ...vacio, fotos: [] }), /negocio/);
  assert.match(faltaEnPaso("quien", { ...vacio, fotos: [] }), /para quién/);
  assert.match(
    faltaEnPaso("pago", { ...vacio, quien: "agricola", fotos: [] }),
    /ya se pagó/,
  );
  assert.match(
    faltaEnPaso("pago", {
      ...vacio,
      quien: "agricola",
      pagado: "si",
      fotos: [],
    }),
    /con qué plata/,
  );
  assert.equal(
    faltaEnPaso("pago", {
      ...vacio,
      quien: "personal",
      pagado: "si",
      fotos: [],
    }),
    "",
  );
  assert.match(faltaEnPaso("fotos", { ...vacio, fotos: [] }), /foto/);
  assert.equal(
    faltaEnPaso("fotos", { ...vacio, comprobante: "pendiente", fotos: [] }),
    "",
  );
});

test("el carrusel es circular y el orden de fotos se mueve sin perder ninguna", () => {
  assert.equal(indiceCircular(3, 3), 0);
  assert.equal(indiceCircular(-1, 3), 2);
  assert.equal(indiceCircular(5, 0), 0);
  assert.deepEqual(moverFoto(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moverFoto(["a", "b", "c"], 0, 5), ["a", "b", "c"]);
});

test("las preferencias se guardan y un tema desconocido vuelve al inicial", () => {
  const s = memoria();
  assert.deepEqual(leerPreferencias(s), {
    guiada: true,
    aprendizaje: true,
    tema: "bosque",
  });
  guardarPreferencias(s, { guiada: false, aprendizaje: false, tema: "noche" });
  assert.deepEqual(leerPreferencias(s), {
    guiada: false,
    aprendizaje: false,
    tema: "noche",
  });
  s.setItem("gastos.tema", "inexistente");
  assert.equal(leerPreferencias(s).tema, "bosque");
  const roto = {
    getItem() {
      throw new Error("bloqueado");
    },
  };
  assert.equal(leerPreferencias(roto).aprendizaje, true);
});

test("hay diez temas y todos definen las mismas variables", () => {
  const ids = Object.keys(TEMAS);
  assert.equal(ids.length, 10);
  const base = Object.keys(variablesTema("bosque")).sort();
  for (const id of ids)
    assert.deepEqual(Object.keys(variablesTema(id)).sort(), base, id);
});

for (const archivo of [
  "guiada/InicioGuiado.vue",
  "guiada/AsistenteGasto.vue",
]) {
  test(`${archivo} compila`, async () => {
    const fuente = await readFile(
      new URL(`../src/interfaz/${archivo}`, import.meta.url),
      "utf8",
    );
    const { descriptor, errors } = parse(fuente, { filename: archivo });
    assert.deepEqual(errors, []);
    compileScript(descriptor, { id: archivo });
    const r = compileTemplate({
      source: descriptor.template.content,
      filename: archivo,
      id: archivo,
    });
    assert.deepEqual(r.errors, []);
  });
}

test("App.vue abre la versión guiada y el registro guiado desde Inicio y el menú", async () => {
  const fuente = await readFile(
    new URL("../src/interfaz/App.vue", import.meta.url),
    "utf8",
  );
  assert.match(fuente, /<InicioGuiado[\s\S]*?@registrar="ir\('guiado'\)"/);
  assert.match(fuente, /<AsistenteGasto[\s\S]*?v-if="pantalla === 'guiado'"/);
  assert.match(fuente, /ir\(preferencias\.guiada \? 'guiado' : 'registro'\)/);
  assert.match(
    fuente,
    /"guiado-recibir", "guiado-informe"\]\.includes\(pantalla\.value\) &&\s*asistente\.value\?\.atras\(\)/,
  );
});

test("Recibí dinero: devolver baja lo adelantado, para gastar queda en custodia, no sé queda sin aplicar", async () => {
  const { aplicacionesDeRecepcion, faltaEnRecibir } =
    await import("../src/interfaz/guiada/guia.js");
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    prepararCompraGuiada(respuestas({ monto: "1200" }), "2026-10-27"),
  );
  const antes = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(antes, "por_reembolsar", "agricola"), 120000);
  const recibir = (id, para, monto) =>
    api.fondos.recibir({
      id,
      fecha: "2026-10-28",
      parte_id: "agricola",
      importe: 120000,
      moneda: "NIO",
      aplicaciones: aplicacionesDeRecepcion({ para, gestion_id: "g1", monto }),
    });
  await recibir("r-dev", "devolucion", "1200");
  await recibir("r-gas", "gastar", "1200");
  const { recepcion } = await recibir("r-nose", "nose", "1200");
  const despues = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(despues, "por_reembolsar", "agricola"), 0);
  assert.equal(saldo(despues, "custodia", "agricola"), 120000);
  const lista = await api.fondos.recepciones();
  assert.equal(lista.find((r) => r.id === recepcion.id).sin_aplicar, 120000);
  assert.match(faltaEnRecibir("para", { para: "gastar" }), /gestión/);
  assert.equal(faltaEnRecibir("para", { para: "nose" }), "");
});

test("RecibirGuiado compila y Inicio lo abre", async () => {
  const fuente = await readFile(
    new URL("../src/interfaz/guiada/RecibirGuiado.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(fuente, {
    filename: "RecibirGuiado.vue",
  });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "recibir" });
  const r = compileTemplate({
    source: descriptor.template.content,
    filename: "RecibirGuiado.vue",
    id: "recibir",
  });
  assert.deepEqual(r.errors, []);
  const app = await readFile(
    new URL("../src/interfaz/App.vue", import.meta.url),
    "utf8",
  );
  assert.match(app, /if \(destino === "fondos"\) ir\("guiado-recibir"\)/);
  assert.match(
    app,
    /<RecibirGuiado[\s\S]*?v-if="pantalla === 'guiado-recibir'"/,
  );
});

test("al guardar, un borrador pendiente no se vuelve a escribir (E-16)", async () => {
  const { crearGuardadoDiferido } =
    await import("../src/interfaz/guiada/guia.js");
  const escritos = [];
  const diferido = crearGuardadoDiferido((x) => escritos.push(x), 20);
  diferido.programar(() => "viejo");
  diferido.detener();
  diferido.programar(() => "después de guardar");
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(escritos, []);
  diferido.reanudar();
  diferido.programar(() => "nuevo registro");
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(escritos, ["nuevo registro"]);
});

test("Informe guiado: por gestión, por empresa y por fechas, con totales de la API", async () => {
  const { alcanceDeInforme, faltaEnInforme } =
    await import("../src/interfaz/guiada/guia.js");
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    prepararCompraGuiada(respuestas({ monto: "1200" }), "2026-10-27"),
  );
  await api.compras.registrar(
    prepararCompraGuiada(
      respuestas({ monto: "300", quien: "otra", proveedor: "Otro negocio" }),
      "2026-10-27",
    ),
  );
  const gestiones = await api.gestiones.listar({ estado: "todas" });
  const opciones = (corte) => ({
    titulo: "Informe de gastos",
    corte,
    responsable: "Responsable de prueba",
    destinatario: "Empresa de prueba",
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: false,
  });
  const porGestion = alcanceDeInforme(
    { tipo: "gestion", gestion_id: "g1" },
    gestiones,
    "2026-10-28",
  );
  const vista = await api.informes.previsualizar({
    alcance: porGestion.alcance,
    opciones: opciones(porGestion.corte),
  });
  assert.equal(vista.totales.NIO.importe, 150000);
  const { informe } = await api.informes.emitir({
    alcance: porGestion.alcance,
    opciones: opciones(porGestion.corte),
  });
  assert.match(informe.codigo, /R01$/);
  const deEmpresa = alcanceDeInforme(
    { tipo: "parte", parte_id: "agricola" },
    gestiones,
    "2026-10-28",
  );
  const soloSuyo = await api.informes.previsualizar({
    alcance: deEmpresa.alcance,
    opciones: opciones(deEmpresa.corte),
  });
  assert.equal(soloSuyo.totales.NIO.importe, 120000);
  assert.throws(
    () =>
      alcanceDeInforme(
        { tipo: "periodo", desde: "2026-10-30", hasta: "2026-10-01" },
        gestiones,
        "2026-10-28",
      ),
    /antes/,
  );
  assert.match(faltaEnInforme("que", { tipo: "" }, gestiones, ""), /de qué/);
  assert.match(
    faltaEnInforme("para", { tipo: "gestion", destinatario: " " }),
    /para quién/,
  );
});

test("Informe guiado valida y entrega varias gestiones al contrato existente", async () => {
  const { alcanceDeInforme } = await import("../src/interfaz/guiada/guia.js");
  const gestiones = [
    { id: "a", fecha_inicio: "2026-10-01", fecha_fin: "2026-10-15" },
    { id: "b", fecha_inicio: "2026-10-02", fecha_fin: null },
  ];
  assert.throws(
    () =>
      alcanceDeInforme(
        { tipo: "gestiones", gestion_ids: ["a"] },
        gestiones,
        "2026-10-28",
      ),
    /dos gestiones/,
  );
  assert.throws(
    () =>
      alcanceDeInforme(
        { tipo: "gestiones", gestion_ids: ["a", "desconocida"] },
        gestiones,
        "2026-10-28",
      ),
    /Revisá/,
  );
  assert.deepEqual(
    alcanceDeInforme(
      { tipo: "gestiones", gestion_ids: ["a", "b", "a"] },
      gestiones,
      "2026-10-28",
    ),
    {
      alcance: { tipo: "gestiones", gestion_ids: ["a", "b"] },
      corte: "2026-10-28",
    },
  );
});

test("InformeGuiado compila y Inicio lo abre", async () => {
  const fuente = await readFile(
    new URL("../src/interfaz/guiada/InformeGuiado.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(fuente, {
    filename: "InformeGuiado.vue",
  });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "informe" });
  const r = compileTemplate({
    source: descriptor.template.content,
    filename: "InformeGuiado.vue",
    id: "informe",
  });
  assert.deepEqual(r.errors, []);
  const app = await readFile(
    new URL("../src/interfaz/App.vue", import.meta.url),
    "utf8",
  );
  assert.match(app, /if \(destino === "respaldo"\) ir\("guiado-informe"\)/);
  assert.match(
    app,
    /<InformeGuiado[\s\S]*?v-if="pantalla === 'guiado-informe'"/,
  );
});

test("los tres asistentes muestran números, nombres y el paso actual", async () => {
  const componente = await readFile(
    new URL("../src/interfaz/guiada/PasosGuiados.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(componente, {
    filename: "PasosGuiados.vue",
  });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "pasos-guiados" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: "PasosGuiados.vue",
      id: "pasos-guiados",
    }).errors,
    [],
  );
  assert.match(componente, /indice \+ 1/);
  assert.match(componente, /paso\.nombre/);
  assert.match(componente, /aria-current/);
  for (const nombre of ["AsistenteGasto", "RecibirGuiado", "InformeGuiado"]) {
    const fuente = await readFile(
      new URL(`../src/interfaz/guiada/${nombre}.vue`, import.meta.url),
      "utf8",
    );
    assert.match(fuente, /<PasosGuiados :pasos=/);
    assert.doesNotMatch(
      fuente,
      /class="progreso(?: cuatro)?" aria-hidden="true"/,
    );
  }
  const gasto = await readFile(
    new URL("../src/interfaz/guiada/AsistenteGasto.vue", import.meta.url),
    "utf8",
  );
  assert.match(gasto, /<PasosGuiados :pasos="PASOS" :actual="0" oscuro/);
});

test("E-16: detener espera la escritura en curso antes de descartar el borrador", async () => {
  const { crearGuardadoDiferido } =
    await import("../src/interfaz/guiada/guia.js");
  let liberar, iniciado;
  const escribiendo = new Promise((r) => {
    iniciado = r;
  });
  const bloqueo = new Promise((r) => {
    liberar = r;
  });
  const eventos = [];
  const diferido = crearGuardadoDiferido(async (d) => {
    iniciado();
    await bloqueo;
    eventos.push(d);
  }, 0);
  diferido.programar(() => "borrador anterior");
  await escribiendo;
  const detenido = diferido.detener().then(() => eventos.push("descartar"));
  await Promise.resolve();
  assert.deepEqual(eventos, []);
  liberar();
  await detenido;
  assert.deepEqual(eventos, ["borrador anterior", "descartar"]);
});

test("E-16: al salir se conserva el último borrador pendiente", async () => {
  const { crearGuardadoDiferido } =
    await import("../src/interfaz/guiada/guia.js");
  const escritos = [];
  const diferido = crearGuardadoDiferido(async (d) => escritos.push(d), 1000);
  diferido.programar(() => ({
    monto: "1200.75",
    moneda: "USD",
    fotos: ["foto"],
  }));
  await diferido.vaciar();
  assert.deepEqual(escritos, [
    { monto: "1200.75", moneda: "USD", fotos: ["foto"] },
  ]);
});

test("reparto guiado conserva beneficiarios y fuentes explícitas", async () => {
  const { api } = await entorno();
  await basico(api);
  const d = respuestas({
    monto: "1000",
    quien: "varios",
    pagado: "si",
    reparto: [
      { parte_id: "agricola", monto: "600", origen: "propio", pagador_id: "" },
      { parte_id: "otra", monto: "250", origen: "propio", pagador_id: "" },
      { parte_id: "personal", monto: "150", origen: "propio", pagador_id: "" },
    ],
  });
  assert.equal(faltaEnPaso("quien", { ...d, fotos: [] }), "");
  assert.equal(faltaEnPaso("pago", { ...d, fotos: [] }), "");
  const { compra } = await api.compras.registrar(
    prepararCompraGuiada(d, "2026-10-27"),
  );
  const detalle = await api.compras.detalle(compra.id);
  assert.deepEqual(
    detalle.asignaciones.map((a) => a.importe).sort((a, b) => a - b),
    [15000, 25000, 60000],
  );
  assert.equal(detalle.pagos.length, 3);
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "por_reembolsar", "agricola"), 60000);
  assert.equal(saldo(s, "por_reembolsar", "otra"), 25000);
  const mal = {
    ...d,
    reparto: d.reparto.map((r, i) => (i === 0 ? { ...r, monto: "599" } : r)),
  };
  assert.match(faltaEnPaso("quien", { ...mal, fotos: [] }), /sumar/i);
  const sinFuente = {
    ...d,
    reparto: d.reparto.map((r, i) =>
      i === 0 ? { ...r, origen: "fondo", pagador_id: "" } : r,
    ),
  };
  assert.match(faltaEnPaso("pago", { ...sinFuente, fotos: [] }), /dueño/i);
});

test("pago combinado guiado separa fondo y aporte propio y permite reembolso", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "anticipo-mixto",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 10000 }],
  });
  const d = respuestas({
    id: "mixta-guiada",
    monto: "110",
    origen: "combinado",
    propietario_id: "agricola",
    monto_fondo: "80",
  });
  await api.compras.registrar(prepararCompraGuiada(d, "2026-10-27"));
  const saldos = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(saldos, "custodia", "agricola"), 2000);
  assert.equal(saldo(saldos, "por_reembolsar", "agricola"), 3000);
  await api.fondos.recibir({
    id: "reembolso-mixto",
    fecha: "2026-10-27",
    parte_id: "agricola",
    importe: 3000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "reembolso", importe: 3000 }],
  });
  const final = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(final, "por_reembolsar", "agricola"), 0);
  assert.equal(saldo(final, "custodia", "agricola"), 2000);
  assert.equal((await api.compras.listar()).length, 1);
});

test("compras consecutivas conservan centavos, moneda e idempotencia sin heredar el borrador", async () => {
  const { crearGuardadoDiferido } =
    await import("../src/interfaz/guiada/guia.js");
  const { crearBorradores } = await import("../src/datos/borradores.js");
  const { indexedDB } = await import("fake-indexeddb");
  const { api } = await entorno();
  await basico(api);
  const borradores = crearBorradores(
    indexedDB,
    `secuencia-${crypto.randomUUID()}`,
  );
  const diferido = crearGuardadoDiferido(
    (d) => borradores.guardar("compra", d),
    1,
  );
  const primero = respuestas({
    id: "secuencia-1",
    monto: "1200",
    moneda: "NIO",
  });
  diferido.programar(() => ({
    d: primero,
    fotos: [new Uint8Array([1, 2, 3])],
  }));
  await new Promise((r) => setTimeout(r, 10));
  await diferido.detener();
  assert.equal((await borradores.obtener("compra")).d.monto, "1200");
  const entrada = prepararCompraGuiada(primero, "2026-10-27");
  assert.equal((await api.compras.registrar(entrada)).compra.importe, 120000);
  assert.equal((await api.compras.registrar(entrada)).creada, false);
  await borradores.descartar("compra");
  assert.equal(await borradores.obtener("compra"), null);
  diferido.reanudar();
  const segundo = respuestas({
    id: "secuencia-2",
    monto: "12.34",
    moneda: "USD",
  });
  diferido.programar(() => ({ d: segundo, fotos: [] }));
  await diferido.vaciar();
  const recuperado = await borradores.obtener("compra");
  assert.equal(recuperado.d.monto, "12.34");
  assert.equal(recuperado.d.moneda, "USD");
  assert.deepEqual(recuperado.fotos, []);
  assert.equal(
    (
      await api.compras.registrar(
        prepararCompraGuiada(recuperado.d, "2026-10-27"),
      )
    ).compra.importe,
    1234,
  );
  assert.equal((await api.compras.listar()).length, 2);
});

test("efectivo entregado: C$10000 menos C$5600 deja C$4400, sin descontar pagos propios o crédito", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "efectivo-10000",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 1000000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 1000000 }],
  });
  const compraFondo = respuestas({
    id: "efectivo-5600",
    monto: "5600",
    origen: "fondo",
    propietario_id: "agricola",
  });
  await api.compras.registrar(prepararCompraGuiada(compraFondo, "2026-10-27"));
  assert.equal(
    saldo((await api.saldos.consultar()).saldos, "custodia", "agricola"),
    440000,
  );
  await api.compras.registrar(
    prepararCompraGuiada(
      respuestas({ id: "propio-no-descuenta", monto: "100", origen: "propio" }),
      "2026-10-27",
    ),
  );
  await api.compras.registrar(
    prepararCompraGuiada(
      respuestas({
        id: "credito-no-descuenta",
        monto: "100",
        pagado: "credito",
        origen: "",
      }),
      "2026-10-27",
    ),
  );
  const final = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(final, "custodia", "agricola"), 440000);
  assert.equal(saldo(final, "por_reembolsar", "agricola"), 10000);
  assert.equal(saldo(final, "deuda_proveedor", "agricola"), 10000);
});

test("Ver cómo voy consulta agregados de la API e incluye asistencia configurable", async () => {
  const ruta = new URL(
    "../src/interfaz/guiada/VerComoVoy.vue",
    import.meta.url,
  );
  const fuente = await readFile(ruta, "utf8");
  const { descriptor, errors } = parse(fuente, { filename: "VerComoVoy.vue" });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "ver-como-voy" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: "VerComoVoy.vue",
      id: "ver-como-voy",
    }).errors,
    [],
  );
  assert.match(fuente, /api\.saldos\.cuentas\(\)/);
  assert.match(fuente, /api\.fondos\.recepciones\(\)/);
  assert.match(fuente, /sin-gestion/);
  assert.match(fuente, /Dinero recibido sin aplicar/);
  assert.match(fuente, /emit\('aprendizaje'/);
  const app = await readFile(
    new URL("../src/interfaz/App.vue", import.meta.url),
    "utf8",
  );
  assert.match(app, /destino === "gestiones"\) ir\("guiado-estado"\)/);
  assert.match(app, /<VerComoVoy[\s\S]*?@gestion="verGestion"/);
});

test("E-16: un asistente nuevo espera la compra anterior incluso al cambiar de pantalla", async () => {
  const { ejecutarGuardadoGuiado, esperarGuardadoGuiado } =
    await import("../src/interfaz/guiada/guia.js");
  let liberar;
  const bloqueo = new Promise((r) => {
    liberar = r;
  });
  const eventos = [];
  const operacion = ejecutarGuardadoGuiado(async () => {
    eventos.push("comienzo");
    await bloqueo;
    eventos.push("descartado");
  });
  await Promise.resolve();
  const apertura = esperarGuardadoGuiado().then(() =>
    eventos.push("abrir nuevo"),
  );
  await Promise.resolve();
  assert.deepEqual(eventos, ["comienzo"]);
  liberar();
  await Promise.all([operacion, apertura]);
  assert.deepEqual(eventos, ["comienzo", "descartado", "abrir nuevo"]);
});

test("una parte recién creada no aparece duplicada al actualizar la lista", async () => {
  const { partesUnicas } = await import("../src/interfaz/guiada/guia.js");
  const registrado = { id: "empresa-1", nombre: "Empresa de prueba" };
  const items = partesUnicas(
    [registrado],
    [{ ...registrado }, { id: "empresa-2", nombre: "Otra" }],
  );
  assert.deepEqual(
    items.map((p) => p.id),
    ["empresa-1", "empresa-2"],
  );
});

test("el mensaje de un anticipo no lo presenta como saldo total", async () => {
  const { textoAnticipoRecibido } =
    await import("../src/interfaz/guiada/guia.js");
  const texto = textoAnticipoRecibido("C$ 100,000.00", "Empresa", "Gestión");
  assert.match(texto, /se (asigna|agrega)/i);
  assert.doesNotMatch(texto, /quedan C\$/i);
});
