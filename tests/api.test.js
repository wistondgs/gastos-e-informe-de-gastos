import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { ErrorApi } from "../src/api/index.js";
import { entorno, basico, compra, imagen, saldo } from "./apoyo-api.js";
import { textoDePaginas } from "./apoyo-informes.js";
const opciones = {
  titulo: "Rendición",
  corte: "2026-10-31",
  papel: "carta",
  estilo: "ejecutivo",
  incluirFotos: false,
};
const texto = async (bytes) =>
  textoDePaginas(await PDFDocument.load(bytes)).flat();
const falla = (codigo, campo) => (e) =>
  e instanceof ErrorApi &&
  e.codigo === codigo &&
  (campo === undefined || e.campo === campo);

test("partes: crear es idempotente, un id ajeno es conflicto y desactivar no borra", async () => {
  const { api } = await entorno();
  await basico(api);
  assert.equal(
    (
      await api.partes.crear({
        id: "agricola",
        nombre: "Agrícola de prueba",
        tipo: "empresa",
      })
    ).creada,
    false,
  );
  await assert.rejects(
    () => api.partes.crear({ id: "agricola", nombre: "Otra", tipo: "empresa" }),
    falla("CONFLICTO"),
  );
  await assert.rejects(
    () => api.partes.crear({ nombre: " ", tipo: "empresa" }),
    falla("VALIDACION", "nombre"),
  );
  await assert.rejects(
    () => api.partes.desactivar("otra", ""),
    falla("VALIDACION", "motivo"),
  );
  await api.partes.desactivar("otra", "Ya no se usa");
  assert.ok(!(await api.partes.listar()).some((p) => p.id === "otra"));
  assert.ok(
    (await api.partes.listar({ incluirInactivas: true })).some(
      (p) => p.id === "otra",
    ),
  );
});

test("gestiones: varias abiertas a la vez, compras sin gestión visibles, terminar no borra y reabrir pide motivo", async () => {
  const { api } = await entorno();
  await basico(api);
  await assert.rejects(
    () =>
      api.gestiones.crear({
        nombre: "X",
        fecha_inicio: "2026-10-20",
        responsable_id: "nadie",
      }),
    falla("VALIDACION", "responsable_id"),
  );
  await api.gestiones.crear({
    id: "g2",
    nombre: "Otra abierta",
    fecha_inicio: "2026-10-22",
    descripcion: "Encargo",
  });
  await api.compras.registrar(
    compra({ id: "s1", gestion_id: null, concepto: "Histórica sin gestión" }),
  );
  await api.compras.registrar(compra({ id: "m1" }));
  await api.compras.registrar(
    compra({
      id: "m2",
      gestion_id: "g2",
      moneda: "USD",
      proveedor: "Ferretería Demostración",
      fecha_compra: "2026-10-25",
    }),
  );
  assert.deepEqual(
    (await api.gestiones.listar({ estado: "abiertas" }))
      .map((g) => g.id)
      .sort(),
    ["g1", "g2"],
  );
  assert.deepEqual(
    (await api.compras.listar({ gestion_id: "ninguna" })).map((c) => c.id),
    ["s1"],
  );
  assert.deepEqual(
    (await api.compras.listar({ moneda: "USD" })).map((c) => c.id),
    ["m2"],
  );
  assert.deepEqual(
    (await api.compras.listar({ proveedor: "ferretería" })).map((c) => c.id),
    ["m2"],
  );
  assert.deepEqual(
    (
      await api.compras.listar({ desde: "2026-10-24", hasta: "2026-10-26" })
    ).map((c) => c.id),
    ["m2"],
  );
  await api.gestiones.cerrar("g1", "2026-10-26");
  await assert.rejects(
    () => api.gestiones.cerrar("g1", "2026-10-27"),
    falla("ESTADO"),
  );
  await assert.rejects(
    () => api.compras.registrar(compra({ gestion_id: "g1" })),
    falla("ESTADO"),
  );
  assert.equal(
    (await api.compras.listar({ gestion_id: "g1" })).length,
    1,
    "terminar no borra compras",
  );
  const [terminada] = await api.gestiones.listar({ estado: "terminadas" });
  assert.equal(terminada.estado, "terminada");
  assert.equal(
    terminada.liquidacion,
    "sin_movimientos",
    "el cierre no es la liquidación",
  );
  await assert.rejects(
    () => api.gestiones.reabrir("g1", ""),
    falla("VALIDACION", "motivo"),
  );
  await api.gestiones.reabrir("g1", "Falta una compra");
  const d = await api.gestiones.detalle("g1");
  assert.equal(d.gestion.estado, "abierta");
  assert.equal(d.eventos.at(-1).motivo, "Falta una compra");
  assert.equal(
    JSON.parse(d.eventos.at(-1).datos).fecha_fin_anterior,
    "2026-10-26",
  );
  await assert.rejects(
    () => api.gestiones.detalle("nada"),
    falla("NO_ENCONTRADO"),
  );
});

test("reglas de pago: sin detalle no admite pagos, crédito pide deudor, fondos ajenos no pagan gastos de otro", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(compra({ id: "v1" }));
  await assert.rejects(
    () =>
      api.pagos.registrar({
        compra_id: "v1",
        fecha: "2026-10-21",
        importe: 100,
        origen: "propio",
      }),
    falla("VALIDACION", "forma_pago"),
  );
  await api.compras.clasificarPago("v1", { forma_pago: "contado" });
  await assert.rejects(
    () => api.compras.clasificarPago("v1", { forma_pago: "credito" }),
    falla("ESTADO"),
  );
  await api.pagos.registrar({
    compra_id: "v1",
    fecha: "2026-10-21",
    importe: 100,
    origen: "propio",
  });
  const obs = (await api.saldos.consultar()).observaciones
    .map((o) => o.tipo)
    .sort();
  assert.deepEqual(obs, ["origen_sin_detallar", "pago_propio_sin_cargo"]);
  await assert.rejects(
    () => api.compras.registrar(compra({ forma_pago: "credito" })),
    falla("VALIDACION", "deudor_id"),
  );
  await api.fondos.recibir({
    fecha: "2026-10-20",
    parte_id: "agricola",
    importe: 50000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 50000 }],
  });
  await assert.rejects(
    () =>
      api.compras.registrar(
        compra({
          importe: 1000,
          forma_pago: "contado",
          asignaciones: [{ parte_id: "otra", importe: 1000 }],
          pagos: [{ origen: "fondo", parte_id: "agricola", importe: 1000 }],
        }),
      ),
    falla("VALIDACION", "parte_id"),
  );
  await api.compras.registrar(
    compra({
      id: "pers",
      importe: 2000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: null, importe: 2000 }],
      pagos: [{ origen: "fondo", parte_id: "agricola", importe: 2000 }],
    }),
  );
  const { saldos } = await api.saldos.consultar();
  assert.equal(saldo(saldos, "custodia", "agricola"), 48000);
  assert.equal(
    saldo(saldos, "por_regularizar", "agricola"),
    2000,
    "fondos ajenos en un gasto personal quedan por regularizar",
  );
  await assert.rejects(
    () =>
      api.compras.registrar(
        compra({
          importe: 1000,
          forma_pago: "contado",
          asignaciones: [
            { parte_id: "agricola", importe: 500 },
            { parte_id: "otra", importe: 500 },
          ],
          pagos: [{ origen: "propio", importe: 1000 }],
        }),
      ),
    falla("VALIDACION", "asignacion_id"),
    "con reparto, el pago propio dice a qué parte corresponde",
  );
});

test("asignaciones, traslados, anulaciones y comprobantes agregados dejan su rastro", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({ id: "w1", importe: 1000, estado: "pendiente" }),
  );
  await api.compras.asignar("w1", [{ parte_id: "agricola", importe: 1000 }]);
  await api.compras.asignar(
    "w1",
    [
      { parte_id: "agricola", importe: 600 },
      { parte_id: "otra", importe: 400 },
    ],
    "Se repartió con la otra empresa",
  );
  const d = await api.compras.detalle("w1");
  assert.equal(d.asignaciones.length, 3);
  assert.equal(
    d.asignaciones.filter((a) => !a.anulada).length,
    2,
    "el reparto anterior queda anulado, no borrado",
  );
  assert.deepEqual(JSON.parse(d.eventos.at(-1).datos).antes, [
    { parte_id: "agricola", importe: 1000 },
  ]);
  await assert.rejects(
    () => api.compras.asignar("w1", [{ parte_id: "agricola", importe: 999 }]),
    falla("VALIDACION", "asignaciones"),
  );
  await api.comprobantes.agregar("w1", [imagen()]);
  assert.equal(
    (await api.compras.detalle("w1")).compra.estado,
    "factura",
    "pendiente pasa a factura",
  );
  await api.gestiones.crear({
    id: "g2",
    nombre: "Destino",
    fecha_inicio: "2026-10-22",
  });
  await api.fondos.recibir({
    id: "rr",
    fecha: "2026-10-20",
    parte_id: "agricola",
    importe: 9000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 9000 }],
  });
  await api.fondos.trasladar({
    gestion_id: "g1",
    gestion_destino_id: "g2",
    parte_id: "agricola",
    fecha: "2026-10-23",
    importe: 4000,
    moneda: "NIO",
  });
  let { saldos } = await api.saldos.consultar();
  assert.equal(saldo(saldos, "custodia", "agricola", "g1"), 5000);
  assert.equal(saldo(saldos, "custodia", "agricola", "g2"), 4000);
  await api.compras.registrar(
    compra({
      id: "w2",
      gestion_id: "g2",
      importe: 4000,
      forma_pago: "contado",
      pagos: [{ origen: "fondo", parte_id: "agricola", importe: 4000 }],
    }),
  );
  await assert.rejects(
    () => api.fondos.anular("recepcion", "rr", "Error de carga"),
    falla("VALIDACION"),
    "no se anula dinero ya gastado",
  );
  await api.compras.anular("w2", "Cargada en la gestión equivocada");
  ({ saldos } = await api.saldos.consultar());
  assert.equal(
    saldo(saldos, "custodia", "agricola", "g2"),
    4000,
    "anular la compra anula sus pagos",
  );
  assert.ok((await api.compras.detalle("w2")).pagos.every((p) => p.anulada));
});

test("informes de varias gestiones, de un período, de pendientes y por destinatario; vista previa y Excel", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.gestiones.crear({
    id: "g2",
    nombre: "Segunda",
    fecha_inicio: "2026-10-22",
  });
  await api.compras.registrar(
    compra({
      id: "i1",
      concepto: "Uno",
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 100000 }],
      pagos: [{ origen: "propio", importe: 100000 }],
      imagenes: [imagen()],
    }),
  );
  await api.compras.registrar(
    compra({
      id: "i0",
      concepto: "De la otra",
      importe: 7000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "otra", importe: 7000 }],
      pagos: [{ origen: "propio", importe: 7000 }],
    }),
  );
  await api.compras.registrar(
    compra({
      id: "i2",
      gestion_id: "g2",
      concepto: "Dos",
      estado: "pendiente",
      fecha_compra: "2026-10-23",
    }),
  );
  await api.compras.registrar(
    compra({
      id: "i3",
      gestion_id: null,
      concepto: "Tres sin gestión",
      fecha_compra: "2026-10-24",
    }),
  );
  await api.compras.registrar(
    compra({ id: "i4", concepto: "Cuatro sin imagen" }),
  );
  const varias = await api.informes.emitir({
    alcance: { tipo: "gestiones", gestion_ids: ["g1", "g2"] },
    opciones,
  });
  const t1 = await texto(varias.bytes);
  assert.ok(
    t1.includes("Uno") &&
      t1.includes("Dos") &&
      !t1.some((t) => t.includes("Tres")),
  );
  assert.ok(t1.some((t) => t.includes("Gestión: Segunda")));
  assert.ok(t1.some((t) => t.includes("CONCILIACIÓN ECONÓMICA AL CORTE")));
  assert.ok(t1.some((t) => t.includes("Agrícola de prueba")));
  assert.ok(t1.includes("Por reembolsar"));
  assert.ok(varias.informe.codigo.startsWith("GM-"));
  const periodo = await api.informes.emitir({
    alcance: { tipo: "periodo", desde: "2026-10-23", hasta: "2026-10-24" },
    opciones,
  });
  const t2 = await texto(periodo.bytes);
  assert.ok(
    t2.includes("Dos") &&
      t2.includes("Tres sin gestión") &&
      !t2.includes("Uno"),
  );
  const pendientes = await api.informes.emitir({
    alcance: { tipo: "pendientes" },
    opciones,
  });
  const t3 = await texto(pendientes.bytes);
  assert.ok(
    t3.includes("Dos") &&
      t3.includes("Cuatro sin imagen") &&
      !t3.includes("Uno"),
    "solo lo que falta respaldar",
  );
  const parte = await api.informes.emitir({
    alcance: { tipo: "parte", parte_id: "agricola", gestion_ids: ["g1"] },
    opciones: { ...opciones, destinatario: "Agrícola" },
  });
  const t4 = await texto(parte.bytes);
  assert.ok(
    t4.includes("Uno") && !t4.includes("Cuatro sin imagen"),
    "solo lo asignado al destinatario",
  );
  assert.ok(
    t4.some((t) => t.includes("a cargo de Agrícola de prueba")),
    "su propio saldo",
  );
  assert.ok(
    !t4.some((t) => t.includes("Otra empresa de prueba")),
    "sin saldos ni nombres de otra parte",
  );
  assert.ok(
    !t4.some((t) => t.includes("sin movimientos")),
    "con saldos, el texto no dice que no hubo movimientos (E-09)",
  );
  await assert.rejects(
    () =>
      api.informes.emitir({
        alcance: { tipo: "gestion", gestion_id: "g1" },
        opciones: { ...opciones, corte: "2026-10-19" },
      }),
    falla("VALIDACION", "corte"),
  );
  await assert.rejects(
    () => api.informes.emitir({ alcance: { tipo: "otro" }, opciones }),
    falla("VALIDACION"),
  );
  const antes = (await api.informes.listar()).length;
  const vista = await api.informes.previsualizar({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
  });
  assert.equal(vista.revision, 1);
  assert.ok(vista.bytes.length > 0);
  assert.equal(
    (await api.informes.listar()).length,
    antes,
    "la vista previa no registra",
  );
  const { bytes, nombre } = await api.informes.excel(varias.informe.id);
  assert.equal(nombre, `${varias.informe.codigo}.xlsx`);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  assert.deepEqual(
    libro.worksheets.map((h) => h.name),
    [
      "Resumen",
      "Compras",
      "Asignaciones",
      "Conciliación",
      "Fondos y saldos",
      "Movimientos",
      "Comprobantes",
    ],
  );
  const exportado = await api.informes.exportar(varias.informe.id);
  assert.equal(exportado.nuevo, false, "ya estaba exportado al emitir");
});

test("la API solo entrega ErrorApi, objetos serializables y la identidad del producto fuera de los informes", async () => {
  const { api } = await entorno();
  await basico(api);
  await assert.rejects(
    () => api.compras.anular("no-existe", "motivo"),
    falla("NO_ENCONTRADO"),
  );
  await assert.rejects(
    () => api.compras.registrar({ concepto: "" }),
    (e) => e instanceof ErrorApi && typeof e.toJSON().mensaje === "string",
  );
  const detalle = await api.gestiones.detalle("g1");
  assert.deepEqual(JSON.parse(JSON.stringify(detalle)), detalle);
  const id = await api.identidad();
  assert.equal(id.firma, "Desarrollado por W. Gutiérrez");
  assert.equal(id.producto, "Gastos e Informe de Gastos");
  const { bytes } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
  });
  assert.ok(
    !(await texto(bytes)).some(
      (t) => t.includes("Gutiérrez") && t.includes("Desarrollada"),
    ),
  );
});
