import { test } from "node:test";
import assert from "node:assert/strict";
import { entorno, basico, compra } from "./apoyo-api.js";

test("el historial de una gestión conserva aplicaciones, compras, pagos y anulaciones", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "r",
    fecha: "2026-10-20",
    parte_id: "agricola",
    importe: 100000,
    moneda: "NIO",
    referencia: "depósito",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 100000 }],
  });
  await api.compras.registrar(
    compra({
      id: "c",
      importe: 100000,
      forma_pago: "credito",
      deudor_id: "agricola",
    }),
  );
  await api.pagos.registrar({
    id: "p",
    compra_id: "c",
    fecha: "2026-10-22",
    importe: 40000,
    origen: "fondo",
    parte_id: "agricola",
  });
  await api.pagos.anular("p", "corrección");
  const { historial } = await api.gestiones.detalle("g1");
  assert.ok(
    historial.some((x) => x.tipo === "anticipo" && x.referencia === "depósito"),
  );
  assert.ok(historial.some((x) => x.tipo === "compra" && x.id === "c"));
  assert.ok(
    historial.some((x) => x.tipo === "pago" && x.id === "p" && x.anulada),
  );
  assert.ok(historial.some((x) => x.tipo === "anular" && x.entidad === "pago"));
});

test("historial no mezcla eventos de entidades distintas con igual identificador", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.gestiones.crear({
    id: "g2",
    nombre: "Otra",
    fecha_inicio: "2026-10-20",
  });
  await api.compras.registrar(compra({ id: "g1", gestion_id: "g2" }));
  await api.compras.corregir("g1", { concepto: "Ajeno" }, "Corrección externa");
  const { historial } = await api.gestiones.detalle("g1");
  assert.equal(
    historial.some((e) => e.motivo === "Corrección externa"),
    false,
  );
});
