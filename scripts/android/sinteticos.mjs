// Datos sintéticos para la prueba de actualización PASO-A → PASO-B.
//   node scripts/android/sinteticos.mjs preparar <base.db> <salida.db> <carpeta-fotos> <manifiesto.json>
//   node scripts/android/sinteticos.mjs verificar <base.db> <carpeta-fotos> <manifiesto.json>
//   node scripts/android/sinteticos.mjs vacia <salida.db>          (ensayo en la PC: la base del esquema 1)
//   node scripts/android/sinteticos.mjs migrar <entrada.db> <salida.db>  (ensayo en la PC: la migración real)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import initSqlJs from "sql.js";
const [orden, ...args] = process.argv.slice(2);
const SQL = await initSqlJs();
const sha = (b) => createHash("sha256").update(b).digest("hex");
function png(w, h, tono) {
  const crcT = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const trozo = (t, d) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const cuerpo = Buffer.concat([Buffer.from(t), d]);
    const s = Buffer.alloc(4);
    s.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([l, cuerpo, s]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  const filas = [];
  for (let y = 0; y < h; y++) {
    const f = Buffer.alloc(w + 1, y % 24 < 4 ? 40 : tono);
    f[0] = 0;
    filas.push(f);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(Buffer.concat(filas))),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}
const COMPRAS = [
  [
    "sint-0001",
    "2026-10-21",
    "2026-10-21T15:00:00.000Z",
    "Compra sintética con ceros",
    "Proveedor sintético A",
    125075,
    "NIO",
    "0001230",
    "factura",
  ],
  [
    "sint-0002",
    "2026-10-22",
    "2026-10-22T15:00:00.000Z",
    "Compra sintética en dólares",
    "Proveedor sintético B",
    8500,
    "USD",
    "000045",
    "factura",
  ],
  [
    "sint-0003",
    "2026-10-23",
    "2026-10-23T15:00:00.000Z",
    "Compra sintética sin factura",
    "Proveedor sintético C",
    1,
    "NIO",
    "",
    "sin_factura",
  ],
  [
    "sint-0004",
    "2026-10-24",
    "2026-10-24T15:00:00.000Z",
    "Compra sintética pendiente",
    "Proveedor sintético D",
    99999999,
    "NIO",
    "",
    "pendiente",
  ],
];
const FOTOS = [
  ["foto-sint-1", "sint-0001", "factura", 220],
  ["foto-sint-2", "sint-0001", "voucher", 180],
  ["foto-sint-3", "sint-0002", "factura", 200],
];
if (orden === "preparar") {
  const [entrada, salida, carpeta, manifiesto] = args;
  const db = new SQL.Database(readFileSync(entrada));
  const v = db.exec("PRAGMA user_version")[0].values[0][0];
  if (v !== 1)
    throw new Error(`Se esperaba la base de PASO-A (versión 1) y es ${v}.`);
  if (db.exec("SELECT COUNT(*) FROM compras")[0].values[0][0] !== 0)
    throw new Error("La base no está vacía: no se toca.");
  mkdirSync(`${carpeta}/comprobantes`, { recursive: true });
  for (const c of COMPRAS)
    db.run("INSERT INTO compras VALUES (?,?,?,?,?,?,?,?,?)", c);
  const fotos = [];
  for (const [id, compra, clase, tono] of FOTOS) {
    const bytes = png(120, 160, tono);
    const ruta = `comprobantes/${id}.png`;
    writeFileSync(`${carpeta}/${ruta}`, bytes);
    db.run("INSERT INTO fotos VALUES (?,?,?,?,?,?)", [
      id,
      compra,
      ruta,
      "image/png",
      clase,
      sha(bytes),
    ]);
    fotos.push({ id, compra_id: compra, ruta, sha256: sha(bytes) });
  }
  writeFileSync(salida, Buffer.from(db.export()));
  writeFileSync(
    manifiesto,
    JSON.stringify({ compras: COMPRAS, fotos }, null, 1),
  );
  console.log(
    `Preparada: ${COMPRAS.length} compras y ${fotos.length} fotos sintéticas.`,
  );
} else if (orden === "verificar") {
  const [base, carpeta, manifiesto] = args;
  const m = JSON.parse(readFileSync(manifiesto, "utf8"));
  const db = new SQL.Database(readFileSync(base));
  const v = db.exec("PRAGMA user_version")[0].values[0][0];
  const filas =
    db.exec(
      "SELECT id,fecha_compra,fecha_registro,concepto,proveedor,importe,moneda,factura,estado FROM compras ORDER BY id",
    )[0]?.values || [];
  const fallas = [];
  if (JSON.stringify(filas) !== JSON.stringify(m.compras))
    fallas.push("las compras no coinciden con las sintéticas");
  for (const f of m.fotos) {
    const fila = db.exec(
      "SELECT compra_id, ruta, sha256 FROM fotos WHERE id=?",
      [f.id],
    )[0]?.values[0];
    if (
      !fila ||
      fila[0] !== f.compra_id ||
      fila[1] !== f.ruta ||
      fila[2] !== f.sha256
    )
      fallas.push(`la foto ${f.id} cambió en la base`);
    try {
      if (sha(readFileSync(`${carpeta}/${f.ruta}`)) !== f.sha256)
        fallas.push(`el archivo de ${f.id} cambió`);
    } catch {
      fallas.push(`falta el archivo de ${f.id}`);
    }
  }
  const extra = {};
  if (v >= 4) {
    extra.forma_pago = db
      .exec("SELECT DISTINCT forma_pago FROM compras")[0]
      .values.flat();
    extra.tablas = db
      .exec(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )[0]
      .values.flat();
  }
  console.log(
    JSON.stringify({
      version: v,
      compras: filas.length,
      fotos: m.fotos.length,
      fallas,
      ...extra,
    }),
  );
  process.exit(fallas.length ? 1 : 0);
} else if (orden === "vacia") {
  const fuente = readFileSync(
    new URL("../../src/datos/base.js", import.meta.url),
    "utf8",
  );
  const db = new SQL.Database();
  db.run(fuente.match(/const schema = `([^`]*)`/)[1]);
  writeFileSync(args[0], Buffer.from(db.export()));
} else if (orden === "migrar") {
  const { adaptarSqlJs } = await import("../../src/datos/adaptador-sqljs.js");
  const { inicializar } = await import("../../src/datos/base.js");
  let salida;
  const db = adaptarSqlJs(SQL, readFileSync(args[0]), (b) => (salida = b));
  await inicializar(db);
  writeFileSync(args[1], Buffer.from(salida));
} else throw new Error("Orden desconocida.");
