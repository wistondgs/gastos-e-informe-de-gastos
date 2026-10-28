import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, compra, imagen } from "./apoyo-api.js";

test("corregir campos descriptivos conserva el antes y no altera dinero ni pagos", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "corregir",
      importe: 1500000,
      forma_pago: "credito",
      deudor_id: "agricola",
    }),
  );
  await api.pagos.registrar({
    id: "abono",
    compra_id: "corregir",
    fecha: "2026-10-22",
    importe: 500000,
    origen: "tercero",
    parte_id: "agricola",
  });
  await api.compras.corregir(
    "corregir",
    { concepto: "Concepto corregido", factura: "000987" },
    "Error de captura",
  );
  const d = await api.compras.detalle("corregir");
  assert.equal(d.compra.importe, 1500000);
  assert.equal(d.pagos.length, 1);
  const evento = d.eventos.find((e) => e.tipo === "corregir");
  assert.equal(JSON.parse(evento.datos).antes.concepto, "Compra de prueba");
  assert.equal(JSON.parse(evento.datos).despues.factura, "000987");
  await assert.rejects(() =>
    api.compras.corregir("corregir", { importe: 1 }, "Error de captura"),
  );
});

test("corrección económica conserva el original, sus fotos y traza la sustitución", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "original",
      importe: 1000000,
      forma_pago: "credito",
      deudor_id: "agricola",
      imagenes: [imagen()],
    }),
  );
  const r = await api.compras.corregirEconomia(
    "original",
    { id: "corregida", importe: 1200000 },
    "Importe equivocado",
  );
  assert.equal(r.compra.id, "corregida");
  const anterior = await api.compras.detalle("original"),
    nueva = await api.compras.detalle("corregida");
  assert.ok(anterior.compra.anulada);
  assert.equal(anterior.compra.importe, 1000000);
  assert.equal(nueva.compra.importe, 1200000);
  assert.equal(nueva.fotos[0].sha256, anterior.fotos[0].sha256);
  assert.ok(
    anterior.eventos.some(
      (e) =>
        e.tipo === "reemplazada" &&
        JSON.parse(e.datos).reemplazada_por === "corregida",
    ),
  );
  assert.ok(
    nueva.eventos.some(
      (e) =>
        e.tipo === "reemplaza" &&
        JSON.parse(e.datos).reemplaza_id === "original",
    ),
  );
});

test("no corrige económicamente una compra con pagos sin revertirlos", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({ id: "con-pago", forma_pago: "credito", deudor_id: "agricola" }),
  );
  await api.pagos.registrar({
    id: "p",
    compra_id: "con-pago",
    fecha: "2026-10-22",
    importe: 50000,
    origen: "tercero",
    parte_id: "agricola",
  });
  await assert.rejects(() =>
    api.compras.corregirEconomia(
      "con-pago",
      { id: "nueva", importe: 90000 },
      "Corrección",
    ),
  );
  assert.equal((await api.compras.detalle("con-pago")).compra.anulada, null);
  assert.equal((await api.compras.listar()).length, 1);
});

test("fallo al copiar comprobantes no anula la compra original", async () => {
  const e = await entorno();
  await basico(e.api);
  await e.api.compras.registrar(
    compra({ id: "foto-previa", imagenes: [imagen()] }),
  );
  const cantidad = e.files.m.size;
  const escribir = e.files.escribir;
  e.files.escribir = async () => {
    throw new Error("fallo sintético de almacenamiento");
  };
  try {
    await assert.rejects(() =>
      e.api.compras.corregirEconomia(
        "foto-previa",
        { id: "no-creada", importe: 120000 },
        "Corrección",
      ),
    );
  } finally {
    e.files.escribir = escribir;
  }
  assert.equal(
    (await e.api.compras.detalle("foto-previa")).compra.anulada,
    null,
  );
  assert.equal((await e.api.compras.listar()).length, 1);
  assert.equal(e.files.m.size, cantidad);
});
