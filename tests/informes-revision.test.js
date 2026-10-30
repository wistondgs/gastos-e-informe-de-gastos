import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { adaptarSqlJs } from "../src/datos/adaptador-sqljs.js";
import { inicializar, repositorio } from "../src/datos/base.js";
import { huella } from "../src/datos/archivos.js";
import { SQL, entorno, basico, compra, imagen } from "./apoyo-api.js";
const v1 = `CREATE TABLE compras (id TEXT PRIMARY KEY, fecha_compra TEXT NOT NULL, fecha_registro TEXT NOT NULL, concepto TEXT NOT NULL, proveedor TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), factura TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('factura','sin_factura','pendiente')));
CREATE TABLE fotos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE, ruta TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, clase TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
PRAGMA user_version = 1;`;
const v3 = `CREATE TABLE gestiones (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, fecha_inicio TEXT NOT NULL, fecha_fin TEXT);
ALTER TABLE compras ADD COLUMN gestion_id TEXT REFERENCES gestiones(id);
CREATE TABLE informes (id TEXT PRIMARY KEY, gestion_id TEXT NOT NULL REFERENCES gestiones(id), revision INTEGER NOT NULL CHECK(revision > 0), codigo TEXT NOT NULL, fecha_corte TEXT NOT NULL, generado TEXT NOT NULL, papel TEXT NOT NULL CHECK(papel IN ('carta','a4')), estilo TEXT NOT NULL CHECK(estilo IN ('ejecutivo','formal')), con_fotos INTEGER NOT NULL CHECK(con_fotos IN (0,1)), datos TEXT NOT NULL, sha256 TEXT NOT NULL, archivo TEXT, UNIQUE(gestion_id, revision));
PRAGMA user_version = 3;`;
const version = async (db) =>
  (await db.query("PRAGMA user_version")).values[0].user_version;
function baseV1() {
  const old = new SQL.Database();
  old.run(v1);
  old.run(
    "INSERT INTO compras VALUES ('previa','2026-10-26','2026-10-27T00:00:00Z','Existente','Proveedor',125075,'NIO','0001230','factura')",
  );
  old.run(
    `INSERT INTO fotos VALUES ('foto-1','previa','comprobantes/foto-1.png','image/png','factura','${"a".repeat(64)}')`,
  );
  old.run("INSERT INTO ajustes VALUES ('encabezado','Mi encabezado')");
  return old;
}
async function empaquetar(datos, manifiesto = { version: 1, archivos: {} }) {
  const z = new JSZip();
  const json = new TextEncoder().encode(JSON.stringify(datos));
  z.file("datos.json", json);
  z.file(
    "manifiesto.json",
    JSON.stringify({ ...manifiesto, datos: await huella(json) }),
  );
  return z.generateAsync({ type: "uint8array" });
}
test("la migración 1→5 conserva compras, identificadores, ceros, importes y fotos (la base del APK PASO-A)", async () => {
  const db = adaptarSqlJs(SQL, baseV1().export(), () => {});
  await inicializar(db);
  assert.equal(await version(db), 8);
  const repo = repositorio(db);
  const [c] = await repo.compras();
  assert.equal(c.id, "previa");
  assert.equal(c.factura, "0001230");
  assert.equal(c.importe, 125075);
  assert.equal(
    c.gestion_id,
    null,
    "una compra histórica no se asigna a una gestión",
  );
  assert.equal(
    c.forma_pago,
    "sin_detalle",
    "ni se le inventa una forma de pago",
  );
  assert.equal((await repo.fotos("previa"))[0].ruta, "comprobantes/foto-1.png");
  assert.equal(await repo.ajuste(), "Mi encabezado");
  await inicializar(db);
  assert.equal(
    (await repo.compras()).length,
    1,
    "inicializar dos veces no duplica",
  );
});
test("la migración 3→4 conserva los informes emitidos con su serie de revisiones", async () => {
  const old = baseV1();
  old.run(v3);
  old.run(
    "INSERT INTO gestiones VALUES ('g1','Gestión vieja','2026-10-20',NULL)",
  );
  old.run(
    `INSERT INTO informes VALUES ('i1','g1',1,'GR-G1-R01','2026-10-27','2026-10-27T20:00:00Z','carta','ejecutivo',0,'{"compras":[]}','${"b".repeat(64)}','viejo.pdf')`,
  );
  const db = adaptarSqlJs(SQL, old.export(), () => {});
  await inicializar(db);
  const repo = repositorio(db);
  const [i] = await repo.informes();
  assert.equal(i.clave, "gestion:g1");
  assert.equal(i.motor, 1);
  assert.deepEqual(JSON.parse(i.alcance), {
    tipo: "gestion",
    gestion_id: "g1",
  });
  assert.equal(await repo.siguienteRevision("gestion:g1"), 2);
});
test("si la migración 4 falla, la base queda en la versión 3 sin perder nada", async () => {
  const old = baseV1();
  old.run(v3);
  const db = adaptarSqlJs(SQL, old.export(), () => {});
  const defectuoso = {
    ...db,
    async execute(sql, t) {
      if (sql.includes("CREATE TABLE partes"))
        return db.execute(
          sql.replace(
            "PRAGMA user_version = 4;",
            "INSERT INTO tabla_inexistente VALUES (1); PRAGMA user_version = 4;",
          ),
          t,
        );
      return db.execute(sql, t);
    },
  };
  await assert.rejects(() => inicializar(defectuoso));
  assert.equal(await version(db), 3);
  assert.equal(
    (await db.query("SELECT name FROM sqlite_master WHERE name='partes'"))
      .values.length,
    0,
  );
  assert.equal((await db.query("SELECT * FROM compras")).values.length, 1);
});
test("una base de una versión más nueva se rechaza sin tocarla", async () => {
  const nueva = new SQL.Database();
  nueva.run("PRAGMA user_version = 9");
  const db = adaptarSqlJs(SQL, nueva.export(), () => {});
  await assert.rejects(() => inicializar(db), /más reciente/);
  assert.equal(await version(db), 9);
});
const opciones = {
  titulo: "Rendición",
  responsable: "Responsable",
  destinatario: "Destino",
  corte: "2026-10-27",
  papel: "carta",
  estilo: "ejecutivo",
  incluirFotos: true,
};
const deGestion = { tipo: "gestion", gestion_id: "g1" };
test("una revisión de motor anterior se abre desde su copia privada sin modificar sus bytes", async () => {
  const e = await entorno();
  await basico(e.api);
  await e.api.compras.registrar(compra({ id: "historica" }));
  const emitido = await e.api.informes.emitir({
    alcance: deGestion,
    opciones,
    exportar: false,
  });
  await e.repo.aplicar({
    cambios: [
      { tabla: "informes", id: emitido.informe.id, campos: { motor: 2 } },
    ],
  });
  const abierto = await e.api.informes.abrir(emitido.informe.id);
  assert.equal(abierto.origen, "privado");
  assert.equal(await huella(abierto.bytes), await huella(emitido.bytes));
});
test("cada emisión es una revisión nueva; la entregada se regenera idéntica aunque después cambien los datos", async () => {
  const { api, storage } = await entorno();
  await basico(api);
  await api.compras.registrar(compra({ id: "x1", imagenes: [imagen()] }));
  const r1 = await api.informes.emitir({ alcance: deGestion, opciones });
  const r2 = await api.informes.emitir({
    alcance: deGestion,
    opciones: { ...opciones, estilo: "formal" },
  });
  assert.deepEqual([r1.informe.revision, r2.informe.revision], [1, 2]);
  assert.equal(r2.informe.codigo, "GR-G1-R02");
  assert.equal(r1.informe.sha256, await huella(r1.bytes));
  // Después: compra nueva, gestión cerrada, otro ajuste del anexo y dinero recibido.
  await api.compras.registrar(compra({ id: "x2", importe: 500 }));
  await api.gestiones.cerrar("g1", "2026-10-28");
  const { fotos } = await api.compras.detalle("x1");
  await api.anexos.ajustar(fotos[0].id, { rotacion: 90 });
  await api.fondos.recibir({
    fecha: "2026-10-27",
    parte_id: "agricola",
    importe: 100,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino: "anticipo", importe: 100 }],
  });
  assert.equal(
    await huella((await api.informes.regenerar(r1.informe.id)).bytes),
    r1.informe.sha256,
  );
  const lista = await api.informes.listar();
  const uno = lista.find((r) => r.id === r1.informe.id);
  assert.equal(uno.privado_estado, "verificado");
  assert.equal(uno.compartido_estado, "verificado");
  assert.ok(!("datos" in uno), "el listado no arrastra el modelo completo");
  // Una copia privada alterada se detecta; abrir entrega la compartida verificada.
  storage.setItem(`p:${r1.informe.privado}`, "AAAA");
  assert.equal(
    (await api.informes.listar()).find((r) => r.id === r1.informe.id)
      .privado_estado,
    "alterado",
  );
  const abierto = await api.informes.abrir(r1.informe.id);
  assert.equal(abierto.origen, "compartido");
  assert.equal(await huella(abierto.bytes), r1.informe.sha256);
  // Sin ninguna copia, abrir regenera y verifica.
  storage.removeItem(`c:${r1.informe.archivo}`);
  assert.equal((await api.informes.abrir(r1.informe.id)).origen, "regenerado");
});
test("una revisión fallida no deja archivos ni registro; la misma revisión no se registra dos veces", async () => {
  const { api, repo, storage } = await entorno();
  await basico(api);
  const registrar = repo.registrarInforme;
  repo.registrarInforme = async () => {
    throw new Error("disco lleno");
  };
  await assert.rejects(
    () => api.informes.emitir({ alcance: deGestion, opciones }),
    /No se registró/,
  );
  repo.registrarInforme = registrar;
  assert.equal(storage.length, 0);
  assert.deepEqual(await api.informes.listar(), []);
  const { informe } = await api.informes.emitir({
    alcance: deGestion,
    opciones,
  });
  const fila = await repo.una("informes", informe.id);
  await assert.rejects(
    () => repo.registrarInforme({ ...fila, id: "otro" }),
    /UNIQUE/,
  );
});
test("el respaldo v4 conserva todo y la revisión se regenera idéntica en otro dispositivo", async () => {
  const origen = await entorno();
  await basico(origen.api);
  await origen.api.compras.registrar(
    compra({
      id: "y1",
      forma_pago: "contado",
      asignaciones: [{ parte_id: "agricola", importe: 100000 }],
      pagos: [{ origen: "propio", importe: 100000 }],
      imagenes: [imagen()],
    }),
  );
  const { informe } = await origen.api.informes.emitir({
    alcance: deGestion,
    opciones,
  });
  await origen.api.informes.emitir({
    alcance: deGestion,
    opciones: { ...opciones, incluirFotos: false },
  });
  const { bytes: zip, cifrado } = await origen.api.respaldo.crear();
  assert.equal(cifrado, false, "el respaldo declara que no está cifrado");
  const contenido = await JSZip.loadAsync(zip);
  assert.equal(
    Object.keys(contenido.files).filter(
      (n) => n.startsWith("informes/") && !contenido.files[n].dir,
    ).length,
    2,
  );
  const destino = await entorno();
  const r = await destino.api.respaldo.restaurar(zip);
  assert.deepEqual(
    [r.compras, r.fotos, r.informes, r.informes_con_archivo, r.movimientos],
    [1, 1, 2, 2, 1],
  );
  assert.ok(
    (await destino.api.informes.listar()).every(
      (i) => i.privado_estado === "verificado",
    ),
  );
  assert.equal(
    await huella((await destino.api.informes.regenerar(informe.id)).bytes),
    informe.sha256,
    "otras rutas, mismos bytes",
  );
  assert.equal(
    (await destino.api.saldos.consultar()).saldos[0].importe,
    100000,
  );
  // Restaurar dos veces el mismo respaldo no duplica ni deja huérfanos.
  await destino.api.respaldo.restaurar(zip);
  assert.equal((await destino.api.compras.listar()).length, 1);
  assert.equal(
    [...destino.storage.m.keys()].filter((k) => k.startsWith("p:")).length,
    2,
  );
  assert.equal(destino.files.m.size, 1);
});
test("los respaldos v2 y v3 siguen restaurando; uno incoherente o más nuevo se rechaza sin tocar nada", async () => {
  const origen = await entorno();
  await basico(origen.api);
  await origen.api.compras.registrar(compra({ id: "z1" }));
  const zip = await JSZip.loadAsync((await origen.api.respaldo.crear()).bytes);
  const { tablas } = JSON.parse(await zip.file("datos.json").async("string"));
  const legado = tablas.compras.map((c) => {
    const { forma_pago, deudor_id, anulada, ...resto } = c;
    (void forma_pago, deudor_id, anulada);
    return resto;
  });
  const destino = await entorno();
  await destino.api.respaldo.restaurar(
    await empaquetar({
      version: 2,
      compras: legado,
      fotos: [],
      gestiones: tablas.gestiones.map(
        ({ id, nombre, fecha_inicio, fecha_fin }) => ({
          id,
          nombre,
          fecha_inicio,
          fecha_fin,
        }),
      ),
      encabezado: "Viejo",
    }),
  );
  assert.equal(
    (await destino.api.compras.listar())[0].forma_pago,
    "sin_detalle",
  );
  assert.equal(await destino.repo.ajuste(), "Viejo");
  await destino.api.respaldo.restaurar(
    await empaquetar({
      version: 3,
      compras: legado.map((c) => ({ ...c, gestion_id: null })),
      fotos: [],
      gestiones: [],
      ajustes: { encabezado: "v3" },
      informes: [],
    }),
  );
  assert.equal(await destino.repo.ajuste(), "v3");
  const incoherente = {
    ...tablas,
    compras: tablas.compras.map((c) => ({ ...c, forma_pago: "contado" })),
    pagos: [
      {
        id: "p",
        compra_id: "z1",
        asignacion_id: null,
        fecha: "2026-10-21",
        fecha_registro: "2026-10-21T00:00:00Z",
        importe: 999999999,
        origen: "propio",
        parte_id: null,
        anulada: null,
      },
    ],
  };
  await assert.rejects(
    async () =>
      destino.api.respaldo.restaurar(
        await empaquetar(
          { version: 4, esquema: 4, tablas: incoherente },
          { version: 2, archivos: {} },
        ),
      ),
    /exceden/,
  );
  await assert.rejects(
    async () =>
      destino.api.respaldo.restaurar(
        await empaquetar(
          { version: 4, esquema: 9, tablas },
          { version: 2, archivos: {} },
        ),
      ),
    /más nueva/,
  );
  assert.equal(
    await destino.repo.ajuste(),
    "v3",
    "los rechazos no tocaron nada",
  );
});
