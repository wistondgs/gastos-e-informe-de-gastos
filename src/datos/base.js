import { validarCompra } from "../dominio/compra.js";
import { validarGestion } from "../dominio/gestion.js";
import { TABLA, TABLAS, insertarSql, valoresDe } from "./tablas.js";
const schema = `CREATE TABLE IF NOT EXISTS compras (id TEXT PRIMARY KEY, fecha_compra TEXT NOT NULL, fecha_registro TEXT NOT NULL, concepto TEXT NOT NULL, proveedor TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), factura TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('factura','sin_factura','pendiente')));
CREATE TABLE IF NOT EXISTS fotos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE, ruta TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, clase TEXT NOT NULL, sha256 TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
PRAGMA user_version = 1;`;
const migration2 = `CREATE TABLE gestiones (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, fecha_inicio TEXT NOT NULL, fecha_fin TEXT);
ALTER TABLE compras ADD COLUMN gestion_id TEXT REFERENCES gestiones(id);
PRAGMA user_version = 2;`;
const migration3 = `CREATE TABLE informes (id TEXT PRIMARY KEY, gestion_id TEXT NOT NULL REFERENCES gestiones(id), revision INTEGER NOT NULL CHECK(revision > 0), codigo TEXT NOT NULL, fecha_corte TEXT NOT NULL, generado TEXT NOT NULL, papel TEXT NOT NULL CHECK(papel IN ('carta','a4')), estilo TEXT NOT NULL CHECK(estilo IN ('ejecutivo','formal')), con_fotos INTEGER NOT NULL CHECK(con_fotos IN (0,1)), datos TEXT NOT NULL, sha256 TEXT NOT NULL, archivo TEXT, UNIQUE(gestion_id, revision));
PRAGMA user_version = 3;`;
// Esquema 4: el control financiero, la auditoría y los anexos. Solo agrega;
// la tabla de informes se reconstruye para admitir alcances sin gestión.
const migration4 = `CREATE TABLE partes (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN ('persona','empresa')), activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0,1)), creada TEXT NOT NULL);
ALTER TABLE gestiones ADD COLUMN descripcion TEXT NOT NULL DEFAULT '';
ALTER TABLE gestiones ADD COLUMN responsable_id TEXT REFERENCES partes(id);
ALTER TABLE compras ADD COLUMN forma_pago TEXT NOT NULL DEFAULT 'sin_detalle' CHECK(forma_pago IN ('sin_detalle','contado','credito'));
ALTER TABLE compras ADD COLUMN deudor_id TEXT REFERENCES partes(id);
ALTER TABLE compras ADD COLUMN anulada TEXT;
CREATE TABLE anexos (foto_id TEXT PRIMARY KEY REFERENCES fotos(id), rotacion INTEGER NOT NULL DEFAULT 0 CHECK(rotacion IN (0,90,180,270)), enderezar REAL NOT NULL DEFAULT 0 CHECK(enderezar BETWEEN -15 AND 15), recorte TEXT, actualizado TEXT NOT NULL);
CREATE TABLE asignaciones (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id), parte_id TEXT REFERENCES partes(id), importe INTEGER NOT NULL CHECK(importe > 0), anulada TEXT);
CREATE TABLE recepciones (id TEXT PRIMARY KEY, fecha TEXT NOT NULL, fecha_registro TEXT NOT NULL, parte_id TEXT NOT NULL REFERENCES partes(id), importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), referencia TEXT NOT NULL DEFAULT '', anulada TEXT);
CREATE TABLE aplicaciones (id TEXT PRIMARY KEY, recepcion_id TEXT NOT NULL REFERENCES recepciones(id), gestion_id TEXT NOT NULL REFERENCES gestiones(id), destino TEXT NOT NULL CHECK(destino IN ('anticipo','reembolso')), importe INTEGER NOT NULL CHECK(importe > 0), anulada TEXT);
CREATE TABLE pagos (id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id), asignacion_id TEXT REFERENCES asignaciones(id), fecha TEXT NOT NULL, fecha_registro TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), origen TEXT NOT NULL CHECK(origen IN ('propio','fondo','tercero')), parte_id TEXT REFERENCES partes(id), anulada TEXT);
CREATE TABLE movimientos (id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK(tipo IN ('devolucion','traslado')), gestion_id TEXT NOT NULL REFERENCES gestiones(id), gestion_destino_id TEXT REFERENCES gestiones(id), parte_id TEXT NOT NULL REFERENCES partes(id), fecha TEXT NOT NULL, fecha_registro TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), moneda TEXT NOT NULL CHECK(moneda IN ('NIO','USD')), anulada TEXT);
CREATE TABLE eventos (id TEXT PRIMARY KEY, fecha TEXT NOT NULL, entidad TEXT NOT NULL, entidad_id TEXT NOT NULL, tipo TEXT NOT NULL, motivo TEXT NOT NULL, datos TEXT NOT NULL);
CREATE INDEX compras_gestion ON compras(gestion_id);
CREATE INDEX pagos_compra ON pagos(compra_id);
CREATE INDEX asignaciones_compra ON asignaciones(compra_id);
CREATE INDEX aplicaciones_recepcion ON aplicaciones(recepcion_id);
CREATE INDEX eventos_entidad ON eventos(entidad, entidad_id);
CREATE TABLE informes_v4 (id TEXT PRIMARY KEY, clave TEXT NOT NULL, alcance TEXT NOT NULL, gestion_id TEXT REFERENCES gestiones(id), revision INTEGER NOT NULL CHECK(revision > 0), codigo TEXT NOT NULL, fecha_corte TEXT NOT NULL, generado TEXT NOT NULL, papel TEXT NOT NULL CHECK(papel IN ('carta','a4')), estilo TEXT NOT NULL CHECK(estilo IN ('ejecutivo','formal')), con_fotos INTEGER NOT NULL CHECK(con_fotos IN (0,1)), motor INTEGER NOT NULL DEFAULT 1, datos TEXT NOT NULL, sha256 TEXT NOT NULL, archivo TEXT, privado TEXT, UNIQUE(clave, revision));
INSERT INTO informes_v4 (id,clave,alcance,gestion_id,revision,codigo,fecha_corte,generado,papel,estilo,con_fotos,motor,datos,sha256,archivo,privado) SELECT id,'gestion:'||gestion_id,'{"tipo":"gestion","gestion_id":"'||gestion_id||'"}',gestion_id,revision,codigo,fecha_corte,generado,papel,estilo,con_fotos,1,datos,sha256,archivo,NULL FROM informes;
DROP TABLE informes;
ALTER TABLE informes_v4 RENAME TO informes;
PRAGMA user_version = 4;`;
const migration5 = `CREATE TABLE catalogos (id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK(tipo IN ('cuenta','medio','categoria','destino')), nombre TEXT NOT NULL, activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0,1)), creada TEXT NOT NULL);
CREATE TABLE catalogo_usos (id TEXT PRIMARY KEY, catalogo_id TEXT NOT NULL REFERENCES catalogos(id), compra_id TEXT NOT NULL REFERENCES compras(id), tipo TEXT NOT NULL CHECK(tipo IN ('cuenta','medio','categoria','destino')), nombre TEXT NOT NULL);
PRAGMA user_version = 5;`;
const migration6 = `ALTER TABLE recepciones ADD COLUMN finalidad TEXT NOT NULL DEFAULT '';
ALTER TABLE recepciones ADD COLUMN beneficiario_id TEXT REFERENCES partes(id);
PRAGMA user_version = 6;`;
// Una aplicación sin gestión solo puede cancelar un reembolso sin gestión.
const migration7 = `CREATE TABLE aplicaciones_v7 (id TEXT PRIMARY KEY, recepcion_id TEXT NOT NULL REFERENCES recepciones(id), gestion_id TEXT REFERENCES gestiones(id), destino TEXT NOT NULL CHECK(destino IN ('anticipo','reembolso')), importe INTEGER NOT NULL CHECK(importe > 0), anulada TEXT, CHECK(gestion_id IS NOT NULL OR destino = 'reembolso'));
INSERT INTO aplicaciones_v7 SELECT id, recepcion_id, gestion_id, destino, importe, anulada FROM aplicaciones;
DROP TABLE aplicaciones;
ALTER TABLE aplicaciones_v7 RENAME TO aplicaciones;
CREATE INDEX aplicaciones_recepcion ON aplicaciones(recepcion_id);
PRAGMA user_version = 7;`;
const migration8 = `CREATE TABLE atribuciones_regularizacion (id TEXT PRIMARY KEY, pago_id TEXT NOT NULL UNIQUE REFERENCES pagos(id), responsable_id TEXT NOT NULL REFERENCES partes(id), beneficiario_id TEXT NOT NULL REFERENCES partes(id), fecha TEXT NOT NULL, motivo TEXT NOT NULL);
CREATE TABLE regularizaciones (id TEXT PRIMARY KEY, pago_id TEXT NOT NULL REFERENCES pagos(id), atribucion_id TEXT NOT NULL REFERENCES atribuciones_regularizacion(id), pagador_id TEXT NOT NULL REFERENCES partes(id), modalidad TEXT NOT NULL CHECK(modalidad IN ('reposicion','directa')), fecha TEXT NOT NULL, fecha_registro TEXT NOT NULL, importe INTEGER NOT NULL CHECK(importe > 0), motivo TEXT NOT NULL, anulada TEXT);
PRAGMA user_version = 8;`;
export const VERSION_ESQUEMA = 8;
export const AJUSTES = {
  encabezado: "Informe de gastos",
  responsable: "",
  destinatario: "",
};
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
export async function inicializar(db) {
  await db.execute("PRAGMA foreign_keys = ON;", false);
  const versions = await db.query("PRAGMA user_version");
  const v = Number(versions.values?.[0]?.user_version || 0);
  if (v > VERSION_ESQUEMA)
    throw new Error("La base fue creada con una versión más reciente.");
  if (v === 0) await db.execute(schema, true);
  if (v < 2) await db.execute(migration2, true);
  if (v < 3) await db.execute(migration3, true);
  if (v < 4) await db.execute(migration4, true);
  if (v < 5) await db.execute(migration5, true);
  if (v < 6) await db.execute(migration6, true);
  if (v < 7) await db.execute(migration7, true);
  if (v < 8) await db.execute(migration8, true);
}
const insertar = (tabla, fila) => ({
  statement: insertarSql(tabla),
  values: valoresDe(tabla, fila),
});
const igualFila = (tabla, a, b) =>
  JSON.stringify(valoresDe(tabla, a)) === JSON.stringify(valoresDe(tabla, b));
const coordinadores = new WeakMap();
export function repositorio(db) {
  if (!coordinadores.has(db))
    coordinadores.set(db, { turno: Promise.resolve() });
  const coordinador = coordinadores.get(db);
  let enTransaccion = false;
  let alRevertir = [];
  const filas = async (sql, valores = []) =>
    (await db.query(sql, valores)).values || [];
  const repo = {
    async exclusiva(operacion) {
      const anterior = coordinador.turno;
      let liberar;
      coordinador.turno = new Promise((resolve) => {
        liberar = resolve;
      });
      await anterior;
      try {
        return db.exclusiva ? await db.exclusiva(operacion) : await operacion();
      } finally {
        liberar();
      }
    },
    alRevertir(accion) {
      if (!enTransaccion) throw new Error("No hay transacción activa.");
      alRevertir.push(accion);
    },
    async transaccion(operacion) {
      return repo.exclusiva(async () => {
        await db.beginTransaction();
        enTransaccion = true;
        alRevertir = [];
        try {
          const resultado = await operacion();
          await db.commitTransaction();
          return resultado;
        } catch (error) {
          await db.rollbackTransaction().catch(() => {});
          await Promise.all(
            alRevertir.map((accion) => accion().catch(() => {})),
          );
          throw error;
        } finally {
          enTransaccion = false;
          alRevertir = [];
        }
      });
    },
    /** Todas las filas de una tabla, en el orden de su clave. */
    async todas(tabla) {
      const t = TABLA[tabla];
      if (!t) throw new Error(`Tabla desconocida: ${tabla}`);
      return filas(`SELECT * FROM ${t.nombre} ORDER BY ${t.clave || "id"}`);
    },
    async una(tabla, id) {
      const t = TABLA[tabla];
      return (
        (
          await filas(`SELECT * FROM ${t.nombre} WHERE ${t.clave || "id"}=?`, [
            id,
          ])
        )[0] || null
      );
    },
    /** Una foto completa de los datos: para calcular saldos y respaldar. */
    async cargarTodo() {
      const r = {};
      for (const t of TABLAS) r[t.nombre] = await repo.todas(t.nombre);
      return r;
    },
    /**
     * Aplica en una sola transacción altas y cambios. Un alta repetida con el
     * mismo contenido no duplica nada (devuelve false); con otro contenido falla.
     */
    async aplicar({ altas = [], cambios = [] }) {
      const set = [];
      let nuevas = 0;
      for (const { tabla, fila } of altas) {
        const clave = TABLA[tabla].clave || "id";
        const previa = await repo.una(tabla, fila[clave]);
        if (previa) {
          if (!igualFila(tabla, previa, fila))
            throw new Error("El identificador ya pertenece a otro registro.");
          continue;
        }
        set.push(insertar(tabla, fila));
        nuevas++;
      }
      for (const { tabla, id, campos } of cambios) {
        const t = TABLA[tabla],
          nombres = Object.keys(campos);
        if (!nombres.every((c) => t.columnas.includes(c)))
          throw new Error("Cambio inválido.");
        set.push({
          statement: `UPDATE ${t.nombre} SET ${nombres.map((c) => `${c}=?`).join(",")} WHERE ${t.clave || "id"}=?`,
          values: [...nombres.map((c) => campos[c]), id],
        });
      }
      if (set.length) await db.executeSet(set, !enTransaccion);
      return nuevas > 0 || cambios.length > 0;
    },
    async gestiones() {
      return filas("SELECT * FROM gestiones ORDER BY fecha_inicio DESC, id");
    },
    async crearGestion(g) {
      validarGestion(g);
      return repo.aplicar({ altas: [{ tabla: "gestiones", fila: g }] });
    },
    async cerrarGestion(id, fecha) {
      const g = await repo.una("gestiones", id);
      if (!g || g.fecha_fin)
        throw new Error("La gestión no existe o ya está terminada.");
      validarGestion({ ...g, fecha_fin: fecha });
      await db.run(
        "UPDATE gestiones SET fecha_fin=? WHERE id=? AND fecha_fin IS NULL",
        [fecha, id],
      );
    },
    async compras() {
      return filas("SELECT * FROM compras ORDER BY fecha_registro DESC, id");
    },
    async fotos(id) {
      return filas("SELECT * FROM fotos WHERE compra_id = ? ORDER BY id", [id]);
    },
    async ajuste() {
      return (await repo.ajustes()).encabezado || AJUSTES.encabezado;
    },
    async guardarAjuste(texto) {
      if (typeof texto !== "string" || texto.length > 120)
        throw new Error("Encabezado inválido.");
      await repo.guardarAjustes({ encabezado: texto });
    },
    async ajustes() {
      const r = { ...AJUSTES };
      for (const f of await filas("SELECT clave, valor FROM ajustes"))
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
    async informes(clave = null) {
      return clave
        ? filas("SELECT * FROM informes WHERE clave=? ORDER BY revision DESC", [
            clave,
          ])
        : filas("SELECT * FROM informes ORDER BY generado DESC, revision DESC");
    },
    async siguienteRevision(clave) {
      const r = await filas(
        "SELECT COALESCE(MAX(revision),0) AS n FROM informes WHERE clave=?",
        [clave],
      );
      return Number(r[0]?.n || 0) + 1;
    },
    /** Una revisión emitida se registra una vez y no se modifica después. */
    async registrarInforme(i) {
      if (!/^[a-f0-9]{64}$/.test(i?.sha256 || ""))
        throw new Error("Huella de informe inválida.");
      await db.run(insertarSql("informes"), valoresDe("informes", i));
    },
    async guardar(c, fotos) {
      validarCompra(c);
      if (c.gestion_id != null) {
        const g = await repo.una("gestiones", c.gestion_id);
        if (!g || g.fecha_fin) throw new Error("Elegí una gestión abierta.");
      }
      const previa = await repo.una("compras", c.id);
      if (previa) {
        if (!igualFila("compras", { ...previa, anulada: null }, c))
          throw new Error("El identificador ya pertenece a otra compra.");
        return false;
      }
      await db.executeSet(
        [insertar("compras", c), ...fotos.map((f) => insertar("fotos", f))],
        true,
      );
      return true;
    },
    /** Reemplaza todos los datos en una sola transacción (restauración). */
    async reemplazarTodo(datos) {
      validarAjustes(
        Object.fromEntries(
          (datos.ajustes || []).map((a) => [a.clave, a.valor]),
        ),
      );
      const set = [];
      for (const t of [...TABLAS].reverse())
        set.push({ statement: `DELETE FROM ${t.nombre}`, values: [] });
      for (const t of TABLAS)
        for (const fila of datos[t.nombre] || [])
          set.push(insertar(t.nombre, fila));
      await db.executeSet(set, true);
    },
  };
  return repo;
}
