import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, compra } from "./apoyo-api.js";

test("el estado de cuentas separa recepción, gasto con fondo, aporte, reembolso y crédito", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "r",
    fecha: "2026-10-20",
    parte_id: "agricola",
    importe: 100000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 100000 }],
  });
  await api.compras.registrar(
    compra({
      id: "mixta",
      importe: 70000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 70000 }],
      pagos: [
        {
          origen: "fondo",
          parte_id: "agricola",
          importe: 60000,
          asignacion: 0,
        },
        { origen: "propio", importe: 10000, asignacion: 0 },
      ],
    }),
  );
  await api.compras.registrar(
    compra({
      id: "credito",
      importe: 30000,
      forma_pago: "credito",
      deudor_id: "agricola",
    }),
  );
  const { cuentas } = await api.saldos.cuentas({ gestion_id: "g1" });
  const c = cuentas.find(
    (x) => x.parte_id === "agricola" && x.moneda === "NIO",
  );
  assert.deepEqual(
    [
      c.recibido,
      c.usado_fondo,
      c.custodia,
      c.aportado_propio,
      c.por_reembolsar,
      c.deuda_proveedor,
    ],
    [100000, 60000, 40000, 10000, 10000, 30000],
  );
  assert.equal(c.gastos_registrados, 70000);
  assert.equal(
    cuentas.find((x) => x.parte_id === null && x.moneda === "NIO")
      .gastos_registrados,
    30000,
  );
});
