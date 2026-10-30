import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, compra, saldo } from "./apoyo-api.js";
import { prepararCompraFinanciera } from "../src/interfaz/flujo-financiero.js";

test("fondos acumulados, compra mixta y crédito conservan sus saldos separados", async () => {
  const { api } = await entorno();
  await basico(api);
  for (const [id, importe] of [
    ["r1", 10000000],
    ["r2", 10000000],
    ["r3", 2000000],
  ]) {
    await api.fondos.recibir({
      id,
      fecha: "2026-10-21",
      parte_id: "agricola",
      importe,
      moneda: "NIO",
      aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe }],
    });
  }
  const entrada = prepararCompraFinanciera(
    compra({ id: "mixta", importe: 23000000 }),
    { tipo: "combinado", parte_id: "agricola", fondo: "220000" },
  );
  await api.compras.registrar(entrada);
  const saldos = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(saldos, "custodia", "agricola"), 0);
  assert.equal(saldo(saldos, "por_reembolsar", "agricola"), 1000000);
  const credito = prepararCompraFinanciera(
    compra({ id: "credito", importe: 1000000 }),
    { tipo: "credito", parte_id: "agricola" },
  );
  await api.compras.registrar(credito);
  assert.equal(
    saldo((await api.saldos.consultar()).saldos, "deuda_proveedor", "agricola"),
    1000000,
  );
  assert.equal((await api.fondos.recepciones()).length, 3);
});

test("el pago con fondo no puede exceder lo recibido", async () => {
  const { api } = await entorno();
  await basico(api);
  const entrada = prepararCompraFinanciera(compra({ id: "sin-fondo" }), {
    tipo: "fondo",
    parte_id: "agricola",
  });
  await assert.rejects(
    () => api.compras.registrar(entrada),
    /fondos suficientes/i,
  );
  assert.equal((await api.compras.listar()).length, 0);
});

test("reparto mixto con varias partes mantiene cada pago y su asignación", async () => {
  const { api } = await entorno();
  await basico(api);
  const entrada = prepararCompraFinanciera(
    compra({ id: "reparto-mixto", importe: 100000 }),
    {
      tipo: "avanzado",
      forma_pago: "contado",
      asignaciones: [
        { parte_id: "agricola", monto: "600" },
        { parte_id: "otra", monto: "250" },
        { parte_id: "", monto: "150" },
      ],
      pagos: [
        { origen: "propio", monto: "600", asignacion: 0 },
        { origen: "propio", monto: "250", asignacion: 1 },
        { origen: "propio", monto: "150", asignacion: 2 },
      ],
    },
  );
  await api.compras.registrar(entrada);
  const d = await api.compras.detalle("reparto-mixto");
  assert.equal(d.asignaciones.length, 3);
  assert.equal(d.pagos.length, 3);
  const saldos = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(saldos, "por_reembolsar", "agricola"), 60000);
  assert.equal(saldo(saldos, "por_reembolsar", "otra"), 25000);
});

test("pago directo identifica por separado pagador y beneficiario", async () => {
  const { api } = await entorno();
  await basico(api);
  const entrada = prepararCompraFinanciera(compra({ id: "tercero" }), {
    tipo: "tercero",
    parte_id: "agricola",
    pagador_id: "otra",
  });
  await api.compras.registrar(entrada);
  const d = await api.compras.detalle("tercero");
  assert.equal(d.asignaciones[0].parte_id, "agricola");
  assert.equal(d.pagos[0].parte_id, "otra");
  assert.equal(d.pagos[0].origen, "tercero");
});

test("una compra sin elección de pago pide seleccionar el origen", () => {
  assert.throws(
    () => prepararCompraFinanciera(compra(), { tipo: "", parte_id: "" }),
    /elegí cómo pagaste/i,
  );
});
