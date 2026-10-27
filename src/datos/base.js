import { validarCompra } from "../dominio/compra.js";
import { validarGestion } from "../dominio/gestion.js";
const schema = `CREATE TABLE IF NOT EXISTS compras (id TEXT PRIMARY KEY, fecha_compra TEXT NOT NULL, fecha_registro TEXT NOT NULL, concepto TEXT NOT NULL, proveedor TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), factura TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('factura','sin_factura','pendiente')));
CREATE TABLE IF NOT EXISTS fotos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE, ruta TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, clase TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
PRAGMA user_version = 1;`;
const migration2 = `CREATE TABLE gestiones (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, fecha_inicio TEXT NOT NULL, fecha_fin TEXT);
ALTER TABLE compras ADD COLUMN gestion_id TEXT REFERENCES gestiones(id);
PRAGMA user_version = 2;`;
const migration3 = `CREATE TABLE informes (id TEXT PRIMARY KEY, gestion_id TEXT NOT NULL REFERENCES gestiones(id), revision INTEGER NOT NULL CHECK(revision > 0), codigo TEXT NOT NULL, fecha_corte TEXT NOT NULL, generado TEXT NOT NULL, papel TEXT NOT NULL CHECK(papel IN ('carta','a4')), estilo TEXT NOT NULL CHECK(estilo IN ('ejecutivo','formal')), con_fotos INTEGER NOT NULL CHECK(con_fotos IN (0,1)), datos TEXT NOT NULL, sha256 TEXT NOT NULL, archivo TEXT, UNIQUE(gestion_id, revision));
PRAGMA user_version = 3;`;
export const VERSION_ESQUEMA = 3;
export const AJUSTES = {
  encabezado: "Informe de gastos",
  responsable: "",
  destinatario: "",
};
const informeSql =
  "INSERT INTO informes (id,gestion_id,revision,codigo,fecha_corte,generado,papel,estilo,con_fotos,datos,sha256,archivo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
const informeVals = (i) => [
  i.id,
  i.gestion_id,
  i.revision,
  i.codigo,
  i.fecha_corte,
  i.generado,
  i.papel,
  i.estilo,
  i.con_fotos,
  i.datos,
  i.sha256,
  i.archivo ?? null,
];
export function validarAjustes(a) {
  if (!a || typeof a !== "object") throw new Error("Ajustes inválidos.");
  for (const [clave, valor] of Object.entries(a))
    if (
      !Object.hasOwn(AJUSTES, clave) ||
      typeof valor !== "string" ||
      valor.length > 120
    )
      throw new Error("Ajustes inválidos.");
  return a;
}
const gestionSql =
  "INSERT INTO gestiones (id,nombre,fecha_inicio,fecha_fin) VALUES (?,?,?,?)";
const gestionVals = (g) => [g.id, g.nombre, g.fecha_inicio, g.fecha_fin];
const compraSql =
  "INSERT INTO compras (id,fecha_compra,fecha_registro,concepto,proveedor,importe,moneda,factura,estado,gestion_id) VALUES (?,?,?,?,?,?,?,?,?,?)";
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
  c.gestion_id ?? null,
];
const fotoVals = (f) => [f.id, f.compra_id, f.ruta, f.tipo, f.clase, f.sha256];
export async function inicializar(db) {
  await db.execute("PRAGMA foreign_keys = ON;", false);
  const versions = await db.query("PRAGMA user_version");
  const v = Number(versions.values?.[0]?.user_version || 0);
  if (v > VERSION_ESQUEMA)
    throw new Error("La base fue creada con una versión más reciente.");
  if (v === 0) await db.execute(schema, true);
  if (v < 2) await db.execute(migration2, true);
  if (v < 3) await db.execute(migration3, true);
}
export function repositorio(db) {
  return {
    async gestiones() {
      return (
        (
          await db.query(
            "SELECT * FROM gestiones ORDER BY fecha_inicio DESC, id",
          )
        ).values || []
      );
    },
    async crearGestion(g) {
      validarGestion(g);
      await db.run(gestionSql, gestionVals(g));
    },
    async cerrarGestion(id, fecha) {
      const g = (await db.query("SELECT * FROM gestiones WHERE id=?", [id]))
        .values?.[0];
      if (!g || g.fecha_fin)
        throw new Error("La gestión no existe o ya está terminada.");
      validarGestion({ ...g, fecha_fin: fecha });
      await db.run(
        "UPDATE gestiones SET fecha_fin=? WHERE id=? AND fecha_fin IS NULL",
        [fecha, id],
      );
    },
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
    async ajustes() {
      const filas =
        (await db.query("SELECT clave, valor FROM ajustes")).values || [];
      const r = { ...AJUSTES };
      for (const f of filas)
        if (Object.hasOwn(AJUSTES, f.clave)) r[f.clave] = f.valor;
      return r;
    },
    async guardarAjustes(a) {
      validarAjustes(a);
      await db.executeSet(
        Object.entries(a).map(([clave, valor]) => ({
          statement:
            "INSERT OR REPLACE INTO ajustes (clave,valor) VALUES (?,?)",
          values: [clave, valor],
        })),
        true,
      );
    },
    async informes(gestionId = null) {
      return (
        (gestionId
          ? await db.query(
              "SELECT * FROM informes WHERE gestion_id=? ORDER BY revision DESC",
              [gestionId],
            )
          : await db.query(
              "SELECT * FROM informes ORDER BY generado DESC, revision DESC",
            )
        ).values || []
      );
    },
    async siguienteRevision(gestionId) {
      const r = await db.query(
        "SELECT COALESCE(MAX(revision),0) AS n FROM informes WHERE gestion_id=?",
        [gestionId],
      );
      return Number(r.values?.[0]?.n || 0) + 1;
    },
    /** Una revisión emitida se registra una vez y no se modifica después. */
    async registrarInforme(i) {
      if (!/^[a-f0-9]{64}$/.test(i?.sha256 || ""))
        throw new Error("Huella de informe inválida.");
      await db.run(informeSql, informeVals(i));
    },
    async guardar(c, fotos) {
      validarCompra(c);
      if (c.gestion_id != null) {
        const g = (
          await db.query("SELECT * FROM gestiones WHERE id=?", [c.gestion_id])
        ).values?.[0];
        if (!g || g.fecha_fin) throw new Error("Elegí una gestión abierta.");
      }
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
    async reemplazar(compras, fotos, ajustes, gestiones = [], informes = []) {
      const valores =
        typeof ajustes === "string" ? { encabezado: ajustes } : ajustes;
      validarAjustes(valores);
      const set = [
        { statement: "DELETE FROM informes", values: [] },
        { statement: "DELETE FROM fotos", values: [] },
        { statement: "DELETE FROM compras", values: [] },
        { statement: "DELETE FROM gestiones", values: [] },
        { statement: "DELETE FROM ajustes", values: [] },
        ...gestiones.map((g) => ({
          statement: gestionSql,
          values: gestionVals(g),
        })),
        ...compras.map((c) => ({
          statement: compraSql,
          values: compraVals(c),
        })),
        ...fotos.map((f) => ({ statement: fotoSql, values: fotoVals(f) })),
        ...informes.map((i) => ({
          statement: informeSql,
          values: informeVals(i),
        })),
        ...Object.entries(valores).map(([clave, valor]) => ({
          statement: "INSERT INTO ajustes (clave,valor) VALUES (?,?)",
          values: [clave, valor],
        })),
      ];
      await db.executeSet(set, true);
    },
  };
}
