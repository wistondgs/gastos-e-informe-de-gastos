import { Capacitor } from "@capacitor/core";
import { inicializar, repositorio } from "./base.js";
export async function abrirRepositorio() {
  let db;
  if (Capacitor.isNativePlatform()) {
    const { CapacitorSQLite, SQLiteConnection } =
      await import("@capacitor-community/sqlite");
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    await sqlite.checkConnectionsConsistency();
    const existente = await sqlite.isConnection("gastos_fase1", false);
    db = existente.result
      ? await sqlite.retrieveConnection("gastos_fase1", false)
      : await sqlite.createConnection(
          "gastos_fase1",
          false,
          "no-encryption",
          1,
          false,
        );
    await db.open();
  } else {
    const { abrirWeb } = await import("./web-sqlite.js");
    db = await abrirWeb();
  }
  if (db.exclusiva) await db.exclusiva(() => inicializar(db));
  else await inicializar(db);
  return repositorio(db);
}
