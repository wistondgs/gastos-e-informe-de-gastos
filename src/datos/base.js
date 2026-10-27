import { validarCompra } from "../dominio/compra.js";
const schema = `CREATE TABLE IF NOT EXISTS compras (id TEXT PRIMARY KEY, fecha_compra TEXT NOT NULL, fecha_registro TEXT NOT NULL, concepto TEXT NOT NULL, proveedor TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), factura TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('factura','sin_factura','pendiente')));
CREATE TABLE IF NOT EXISTS fotos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE, ruta TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, clase TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
PRAGMA user_version = 1;`;
const compraSql =
  "INSERT INTO compras (id,fecha_compra,fecha_registro,concepto,proveedor,importe,moneda,factura,estado) VALUES (?,?,?,?,?,?,?,?,?)";
const fotoSql =
  "INSERT INTO fotos (id,compra_id,ruta,tipo,clase,sha256) VALUES (?,?,?,?,?,?)";
const compraVals = (c) => [
  c.id,
  c.fecha_compra,
  c.fecha_registro,
  c.concepto,
  c.proveedor,
  c.importe,
  c.moneda,
  c.factura,
  c.estado,
];
const fotoVals = (f) => [f.id, f.compra_id, f.ruta, f.tipo, f.clase, f.sha256];
export async function inicializar(db) {
  await db.execute("PRAGMA foreign_keys = ON;", false);
  const versions = await db.query("PRAGMA user_version");
  const v = Number(versions.values?.[0]?.user_version || 0);
  if (v > 1)
    throw new Error("La base fue creada con una versión más reciente.");
  if (v === 0) await db.execute(schema, true);
}
export function repositorio(db) {
  return {
    async compras() {
      return (
        (
          await db.query(
            "SELECT * FROM compras ORDER BY fecha_registro DESC, id",
          )
        ).values || []
      );
    },
    async fotos(id) {
      return (
        (
          await db.query(
            "SELECT * FROM fotos WHERE compra_id = ? ORDER BY id",
            [id],
          )
        ).values || []
      );
    },
    async ajuste() {
      return (
        (await db.query("SELECT valor FROM ajustes WHERE clave = 'encabezado'"))
          .values?.[0]?.valor || "Informe de gastos"
      );
    },
    async guardarAjuste(texto) {
      if (typeof texto !== "string" || texto.length > 120)
        throw new Error("Encabezado inválido.");
      await db.run(
        "INSERT OR REPLACE INTO ajustes (clave,valor) VALUES ('encabezado',?)",
        [texto],
      );
    },
    async guardar(c, fotos) {
      validarCompra(c);
      const previa = (
        await db.query("SELECT * FROM compras WHERE id = ?", [c.id])
      ).values?.[0];
      if (previa) {
        if (
          JSON.stringify(compraVals(previa)) !== JSON.stringify(compraVals(c))
        )
          throw new Error("El identificador ya pertenece a otra compra.");
        return false;
      }
      const set = [
        { statement: compraSql, values: compraVals(c) },
        ...fotos.map((f) => ({ statement: fotoSql, values: fotoVals(f) })),
      ];
      await db.executeSet(set, true);
      return true;
    },
    async reemplazar(compras, fotos, encabezado) {
      const set = [
        { statement: "DELETE FROM fotos", values: [] },
        { statement: "DELETE FROM compras", values: [] },
        { statement: "DELETE FROM ajustes", values: [] },
        ...compras.map((c) => ({
          statement: compraSql,
          values: compraVals(c),
        })),
        ...fotos.map((f) => ({ statement: fotoSql, values: fotoVals(f) })),
        {
          statement: "INSERT INTO ajustes (clave,valor) VALUES (?,?)",
          values: ["encabezado", encabezado],
        },
      ];
      await db.executeSet(set, true);
    },
  };
}
