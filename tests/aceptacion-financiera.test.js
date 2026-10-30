// La matriz A1–A9 del roadmap 03 (§5), ejecutada por la API real sobre SQLite.
import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { entorno, basico, compra, imagen, saldo } from "./apoyo-api.js";
import { PDFDocument } from "pdf-lib";
import { huella } from "../src/datos/archivos.js";
import { textoDePaginas } from "./apoyo-informes.js";

test("A1 adelanto propio: C$8,000 pagados, C$3,000 reembolsados, quedan C$5,000 por recibir", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "a1",
      importe: 800000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 800000 }],
      pagos: [{ origen: "propio", importe: 800000 }],
    }),
  );
  await api.fondos.recibir({
    id: "r1",
    fecha: "2026-10-23",
    parte_id: "agricola",
    importe: 300000,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "reembolso", importe: 300000 }],
  });
  const { saldos } = await api.saldos.consultar({ gestion_id: "g1" });
  assert.equal(saldo(saldos, "por_reembolsar", "agricola"), 500000);
  assert.equal(
    (await api.compras.listar({ gestion_id: "g1" })).length,
    1,
    "el reembolso no crea un segundo gasto",
  );
  const antesDelReembolso = await api.saldos.consultar({
    gestion_id: "g1",
    corte: "2026-10-22",
  });
  assert.equal(
    saldo(antesDelReembolso.saldos, "por_reembolsar", "agricola"),
    800000,
    "al corte anterior, todavía no se había reembolsado nada",
  );
  await assert.rejects(
    () =>
      api.fondos.recibir({
        fecha: "2026-10-24",
        parte_id: "agricola",
        importe: 500001,
        moneda: "NIO",
        aplicaciones: [
          { gestion_id: "g1", destino: "reembolso", importe: 500001 },
        ],
      }),
    (e) => e.codigo === "VALIDACION" && /excede/.test(e.message),
    "no se reembolsa más de lo adelantado",
  );
  await api.gestiones.cerrar("g1", "2026-10-27");
  const despues = await api.saldos.consultar({ gestion_id: "g1" });
  assert.equal(
    saldo(despues.saldos, "por_reembolsar", "agricola"),
    500000,
    "cerrar no borra lo pendiente",
  );
  assert.equal((await api.saldos.liquidacion("g1")).estado, "parcial");
});

test("A2 anticipo: recibir C$100,000, pagar C$96,000 y devolver C$4,000 deja la custodia en cero", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "r2",
    fecha: "2026-10-20",
    parte_id: "agricola",
    importe: 10000000,
    moneda: "NIO",
    aplicaciones: [
      { gestion_id: "g1", destino: "anticipo", importe: 10000000 },
    ],
  });
  await api.compras.registrar(
    compra({
      id: "a2",
      importe: 9600000,
      forma_pago: "contado",
      pagos: [{ origen: "fondo", parte_id: "agricola", importe: 9600000 }],
    }),
  );
  let r = await api.saldos.consultar({ gestion_id: "g1" });
  assert.equal(saldo(r.saldos, "custodia", "agricola"), 400000);
  assert.equal(saldo(r.saldos, "por_reembolsar", "juan"), 0);
  await api.fondos.devolver({
    gestion_id: "g1",
    parte_id: "agricola",
    fecha: "2026-10-26",
    importe: 400000,
    moneda: "NIO",
  });
  r = await api.saldos.consultar({ gestion_id: "g1" });
  assert.equal(saldo(r.saldos, "custodia", "agricola"), 0);
  assert.equal(r.saldos.length, 0, "sin reembolso personal ni otro saldo");
  assert.equal((await api.saldos.liquidacion("g1")).estado, "liquidada");
  await assert.rejects(
    () =>
      api.fondos.devolver({
        gestion_id: "g1",
        parte_id: "agricola",
        fecha: "2026-10-26",
        importe: 1,
        moneda: "NIO",
      }),
    (e) => e.codigo === "VALIDACION" && /custodia/.test(e.message),
    "no se devuelve lo que ya no hay",
  );
});

test("A3 origen combinado: C$103,000 con C$100,000 del anticipo y C$3,000 propios", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.fondos.recibir({
    id: "r3",
    fecha: "2026-10-20",
    parte_id: "agricola",
    importe: 10000000,
    moneda: "NIO",
    aplicaciones: [
      { gestion_id: "g1", destino: "anticipo", importe: 10000000 },
    ],
  });
  await api.compras.registrar(
    compra({
      id: "a3",
      importe: 10300000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 10300000 }],
      pagos: [
        { origen: "fondo", parte_id: "agricola", importe: 10000000 },
        { origen: "propio", importe: 300000 },
      ],
    }),
  );
  const { saldos } = await api.saldos.consultar({ gestion_id: "g1" });
  assert.equal(
    saldo(saldos, "custodia", "agricola"),
    0,
    "sin fondos del anticipo remanentes",
  );
  assert.equal(saldo(saldos, "por_reembolsar", "agricola"), 300000);
  assert.equal(saldos.length, 1);
});

test("A4 crédito: C$10,000 a crédito y C$4,000 pagados por la empresa dejan C$6,000 de deuda y una sola compra", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "a4",
      importe: 1000000,
      forma_pago: "credito",
      deudor_id: "agricola",
      asignaciones: [{ parte_id: "agricola", importe: 1000000 }],
    }),
  );
  await api.pagos.registrar({
    id: "p4",
    compra_id: "a4",
    fecha: "2026-10-25",
    importe: 400000,
    origen: "tercero",
    parte_id: "agricola",
  });
  const { saldos } = await api.saldos.consultar({ gestion_id: "g1" });
  assert.deepEqual(
    saldos.map((s) => [s.tipo, s.parte_id, s.importe, s.compra_id]),
    [["deuda_proveedor", "agricola", 600000, "a4"]],
  );
  assert.equal(
    (await api.compras.listar()).length,
    1,
    "el pago no vuelve a crear la compra",
  );
  assert.equal((await api.compras.listar())[0].importe, 1000000);
  // El pago repetido con el mismo id no duplica ni reduce dos veces.
  assert.equal(
    (
      await api.pagos.registrar({
        id: "p4",
        compra_id: "a4",
        fecha: "2026-10-25",
        importe: 400000,
        origen: "tercero",
        parte_id: "agricola",
      })
    ).creado,
    false,
  );
  await assert.rejects(
    () =>
      api.pagos.registrar({
        compra_id: "a4",
        fecha: "2026-10-25",
        importe: 600001,
        origen: "tercero",
        parte_id: "agricola",
      }),
    /exceden/,
  );
});

test("A5 períodos: una sola entrada de C$7,000 liquida C$5,000 de una gestión cerrada y C$2,000 de otra", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "a5a",
      importe: 500000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 500000 }],
      pagos: [{ origen: "propio", importe: 500000 }],
    }),
  );
  await api.gestiones.cerrar("g1", "2026-10-22");
  await api.gestiones.crear({
    id: "g2",
    nombre: "Segunda gestión",
    responsable_id: "juan",
    fecha_inicio: "2026-10-23",
  });
  await api.compras.registrar(
    compra({
      id: "a5b",
      gestion_id: "g2",
      fecha_compra: "2026-10-24",
      importe: 200000,
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 200000 }],
      pagos: [{ origen: "propio", importe: 200000 }],
    }),
  );
  await api.fondos.recibir({
    id: "dep",
    fecha: "2026-10-26",
    parte_id: "agricola",
    importe: 700000,
    moneda: "NIO",
    referencia: "Depósito 0042",
    aplicaciones: [
      { gestion_id: "g1", destino: "reembolso", importe: 500000 },
      { gestion_id: "g2", destino: "reembolso", importe: 200000 },
    ],
  });
  assert.equal((await api.saldos.consultar()).saldos.length, 0);
  assert.equal((await api.saldos.liquidacion("g1")).estado, "liquidada");
  assert.equal((await api.saldos.liquidacion("g2")).estado, "liquidada");
  const recepciones = await api.fondos.recepciones();
  assert.equal(recepciones.length, 1, "una sola entrada bancaria");
  assert.equal(recepciones[0].aplicaciones.length, 2);
  assert.equal(recepciones[0].sin_aplicar, 0);
  await assert.rejects(
    () =>
      api.fondos.aplicar("dep", [
        { gestion_id: "g2", destino: "reembolso", importe: 1 },
      ]),
    /exceden/,
  );
});

test("A6 compra mixta: C$600 + C$250 + C$150 personal; C$1,001 se rechaza; el informe de A no trae lo de B ni lo personal", async () => {
  const { api } = await entorno();
  await basico(api);
  await assert.rejects(
    () =>
      api.compras.registrar(
        compra({
          id: "a6",
          importe: 100000,
          asignaciones: [
            { parte_id: "agricola", importe: 60000 },
            { parte_id: "otra", importe: 25000 },
            { parte_id: null, importe: 15100 },
          ],
        }),
      ),
    (e) => e.codigo === "VALIDACION" && /suman/.test(e.message),
  );
  assert.equal((await api.compras.listar()).length, 0, "nada quedó a medias");
  await api.compras.registrar(
    compra({
      id: "a6",
      importe: 100000,
      concepto: "Compra mixta",
      imagenes: [imagen()],
      asignaciones: [
        { parte_id: "agricola", importe: 60000 },
        { parte_id: "otra", importe: 25000 },
        { parte_id: null, importe: 15000 },
      ],
    }),
  );
  await api.compras.registrar(
    compra({
      id: "a6b",
      importe: 5000,
      concepto: "Solo de la otra",
      asignaciones: [{ parte_id: "otra", importe: 5000 }],
    }),
  );
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "parte", parte_id: "agricola" },
    opciones: {
      titulo: "Rendición",
      corte: "2026-10-27",
      papel: "carta",
      estilo: "ejecutivo",
      incluirFotos: true,
    },
  });
  const { bytes } = await api.informes.abrir(informe.id);
  const texto = textoDePaginas(await PDFDocument.load(bytes)).flat();
  assert.ok(texto.includes("C$ 600.00"), "solo lo asignado");
  assert.ok(!texto.includes("de C$ 1,000.00"));
  assert.ok(
    !texto.some((t) => t.includes("Solo de la otra")),
    "sin filas de B",
  );
  assert.ok(
    !texto.some((t) => /250\.00|150\.00/.test(t)),
    "sin los importes de B ni los personales",
  );
  assert.ok(
    texto.some((t) => t.includes("compartido")),
    "el comprobante compartido no se divulga por defecto",
  );
  assert.ok(
    !texto.some((t) => t.startsWith("ANEXO")),
    "sin anexos de una compra compartida",
  );
});

test("A7 respaldo duplicado: factura y voucher de una compra de C$5,500 son un solo gasto", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({
      id: "a7",
      importe: 550000,
      imagenes: [imagen("factura"), imagen("voucher", 200, 120)],
    }),
  );
  const lista = await api.compras.listar();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].importe, 550000);
  assert.equal((await api.compras.detalle("a7")).fotos.length, 2);
  const { informe } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones: {
      titulo: "Rendición",
      corte: "2026-10-27",
      papel: "a4",
      estilo: "formal",
      incluirFotos: true,
    },
  });
  const paginas = textoDePaginas(
    await PDFDocument.load((await api.informes.abrir(informe.id)).bytes),
  );
  const todo = paginas.flat();
  assert.ok(todo.includes("C$ 5,500.00"));
  assert.ok(
    !todo.includes("C$ 11,000.00"),
    "dos comprobantes no duplican el total",
  );
  assert.ok(todo.includes("A-01, A-02"));
  const anexos = paginas.filter((p) => p.some((t) => t.startsWith("ANEXO")));
  assert.equal(
    anexos.length,
    1,
    "factura y voucher, chicos, comparten la misma página",
  );
  assert.ok(
    anexos[0].includes("Factura 0001230") &&
      anexos[0].includes("Voucher 0001230"),
  );
});

test("A8 monedas y correcciones: C$100 y US$10 por separado; anular con motivo y reabrir conserva el informe anterior", async () => {
  const { api } = await entorno();
  await basico(api);
  await api.compras.registrar(
    compra({ id: "a8n", importe: 10000, moneda: "NIO" }),
  );
  await api.compras.registrar(
    compra({ id: "a8u", importe: 1000, moneda: "USD" }),
  );
  await api.compras.registrar(
    compra({ id: "a8x", importe: 7700, concepto: "Registrada por error" }),
  );
  await api.gestiones.cerrar("g1", "2026-10-26");
  const opciones = {
    titulo: "Rendición",
    corte: "2026-10-27",
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: false,
  };
  const r1 = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
  });
  await api.gestiones.reabrir("g1", "Falta registrar el peaje");
  await assert.rejects(
    () => api.gestiones.reabrir("g1", "otra vez"),
    (e) => e.codigo === "ESTADO",
  );
  await assert.rejects(
    () => api.compras.anular("a8x", ""),
    (e) => e.codigo === "VALIDACION" && e.campo === "motivo",
  );
  await api.compras.anular("a8x", "Duplicada por error");
  const r2 = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
  });
  const t1 = textoDePaginas(
    await PDFDocument.load((await api.informes.abrir(r1.informe.id)).bytes),
  ).flat();
  const t2 = textoDePaginas(
    await PDFDocument.load((await api.informes.abrir(r2.informe.id)).bytes),
  ).flat();
  assert.ok(
    t2.includes("C$ 100.00") && t2.includes("US$ 10.00"),
    "dos totales",
  );
  assert.ok(!t2.some((t) => /C\$ 110\.00|US\$ 110/.test(t)), "nunca sumados");
  assert.ok(
    t1.includes("C$ 177.00"),
    "la revisión 1 conserva la compra que después se anuló",
  );
  assert.ok(
    t2.some((t) => t.includes("Duplicada por error")),
    "la anulación queda con su motivo",
  );
  assert.equal(r2.informe.revision, 2);
  assert.equal(
    (await api.compras.listar({ incluirAnuladas: true })).length,
    3,
    "anular no borra",
  );
  const ev = (await api.gestiones.detalle("g1")).eventos.map((e) => e.tipo);
  assert.deepEqual(ev, ["cerrar", "reabrir"]);
  assert.equal(
    await huella((await api.informes.regenerar(r1.informe.id)).bytes),
    r1.informe.sha256,
    "la revisión 1 se regenera idéntica",
  );
});

test("A9 protección: exportación interrumpida, imagen ausente, restauración fallida y reintentos", async () => {
  const { api, files, informesPrivados, repo } = await entorno();
  await basico(api);
  const entrada = compra({ id: "a9", importe: 25000, imagenes: [imagen()] });
  assert.equal((await api.compras.registrar(entrada)).creada, true);
  assert.equal(
    (await api.compras.registrar(entrada)).creada,
    false,
    "reintentar no duplica",
  );
  assert.equal(files.m.size, 1, "el reintento no deja fotos huérfanas");
  const opciones = {
    titulo: "Rendición",
    corte: "2026-10-27",
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: true,
  };
  // Exportación interrumpida: falla el guardado privado → no queda revisión.
  const guardar = informesPrivados.guardar;
  informesPrivados.guardar = async () => {
    throw new Error("disco lleno");
  };
  await assert.rejects(() =>
    api.informes.emitir({
      alcance: { tipo: "gestion", gestion_id: "g1" },
      opciones,
    }),
  );
  informesPrivados.guardar = guardar;
  assert.equal(
    (await api.informes.listar()).length,
    0,
    "una exportación fallida no se marca como hecha",
  );
  // Imagen ausente: el informe con anexos se detiene; sin anexos sale y la marca.
  const respaldo = (await api.respaldo.crear()).bytes;
  const [foto] = await repo.todas("fotos");
  files.m.delete(foto.ruta);
  await assert.rejects(
    () =>
      api.informes.emitir({
        alcance: { tipo: "gestion", gestion_id: "g1" },
        opciones,
      }),
    (e) => e.codigo === "INTEGRIDAD",
  );
  await assert.rejects(
    () => api.respaldo.crear(),
    "no se respalda con un comprobante faltante",
  );
  // Restauración interrumpida: un ZIP truncado no toca nada.
  await assert.rejects(() =>
    api.respaldo.restaurar(respaldo.slice(0, respaldo.length - 200)),
  );
  assert.equal((await api.compras.listar()).length, 1);
  // La restauración completa recupera la foto.
  const r = await api.respaldo.restaurar(respaldo);
  assert.equal(r.fotos, 1);
  const { bytes } = await api.comprobantes.original(
    (await repo.todas("fotos"))[0].id,
  );
  assert.ok(bytes.length > 0);
  const zip = await JSZip.loadAsync(respaldo);
  assert.ok(zip.file("manifiesto.json"));
});
