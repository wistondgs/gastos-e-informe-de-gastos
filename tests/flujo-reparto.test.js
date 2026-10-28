import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, saldo, compra } from "./apoyo-api.js";
import { prepararAplicaciones } from "../src/interfaz/flujo-financiero.js";

test("una entrada se reparte entre gestiones y permite aplicar después el remanente", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.gestiones.crear({
    id: "g2",
    nombre: "Otra",
    fecha_inicio: "2026-10-20",
  });
  const aplicaciones = prepararAplicaciones([
    { gestion_id: "g1", monto: "60000", destino: "anticipo" },
    { gestion_id: "g2", monto: "25000", destino: "anticipo" },
  ]);
  await api.fondos.recibir({
    id: "entrada",
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe: 10000000,
    moneda: "NIO",
    referencia: "depósito",
    aplicaciones,
  });
  const [entrada] = await api.fondos.recepciones();
  assert.equal(entrada.sin_aplicar, 1500000);
  let s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "custodia", "agricola", "g1"), 6000000);
  assert.equal(saldo(s, "custodia", "agricola", "g2"), 2500000);
  await api.fondos.aplicar(
    "entrada",
    prepararAplicaciones([
      { gestion_id: "g2", monto: "15000", destino: "anticipo" },
    ]),
  );
  assert.equal((await api.fondos.recepciones())[0].sin_aplicar, 0);
  s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "custodia", "agricola", "g2"), 4000000);
  assert.equal((await api.fondos.recepciones()).length, 1);
});

test("crédito de 15000 con dos abonos conserva una compra y deuda de 7000", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "credito15000",
      importe: 1500000,
      forma_pago: "credito",
      deudor_id: "agricola",
    }),
  );
  for (const [id, importe] of [
    ["abono1", 500000],
    ["abono2", 300000],
  ])
    await api.pagos.registrar({
      id,
      compra_id: "credito15000",
      fecha: "2026-10-22",
      importe,
      origen: "tercero",
      parte_id: "agricola",
    });
  assert.equal(
    saldo((await api.saldos.consultar()).saldos, "deuda_proveedor", "agricola"),
    700000,
  );
  assert.equal((await api.compras.listar()).length, 1);
  assert.equal((await api.compras.detalle("credito15000")).pagos.length, 2);
});
