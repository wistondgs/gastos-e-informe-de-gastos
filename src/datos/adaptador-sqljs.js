export function adaptarSqlJs(SQL, snapshot, persistir, coordinacion = null) {
  let base = snapshot ? new SQL.Database(snapshot) : new SQL.Database();
  let enTransaccion = false;
  let anteriorTransaccion = null;
  const activarClaves = () => base.run("PRAGMA foreign_keys = ON");
  activarClaves();
  function exportar() {
    const bytes = base.export();
    activarClaves();
    return bytes;
  }
  function ejecutarAtomico(fn) {
    const anterior = exportar();
    try {
      fn();
      persistir(exportar());
    } catch (e) {
      base.close();
      base = new SQL.Database(anterior);
      activarClaves();
      throw e;
    }
  }
  return {
    async exclusiva(operacion) {
      if (!coordinacion) return operacion();
      return coordinacion.bloquear(async () => {
        const actualizado = coordinacion.leer();
        if (actualizado) {
          base.close();
          base = new SQL.Database(actualizado);
          activarClaves();
        }
        return operacion();
      });
    },
    async beginTransaction() {
      anteriorTransaccion = exportar();
      base.run("BEGIN IMMEDIATE");
      enTransaccion = true;
    },
    async commitTransaction() {
      try {
        base.run("COMMIT");
        persistir(exportar());
        anteriorTransaccion = null;
      } catch (e) {
        base.close();
        base = new SQL.Database(anteriorTransaccion);
        activarClaves();
        anteriorTransaccion = null;
        throw e;
      } finally {
        enTransaccion = false;
      }
    },
    async rollbackTransaction() {
      base.run("ROLLBACK");
      enTransaccion = false;
      anteriorTransaccion = null;
    },
    async execute(sql, transaction = true) {
      if (sql.trim().toUpperCase().startsWith("PRAGMA FOREIGN_KEYS")) {
        base.run(sql);
        return;
      }
      ejecutarAtomico(() => {
        if (transaction) base.run("BEGIN");
        base.run(sql);
        if (transaction) base.run("COMMIT");
      });
    },
    async query(sql, values = []) {
      const stmt = base.prepare(sql, values),
        rows = [];
      try {
        while (stmt.step()) rows.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      return { values: rows };
    },
    async run(sql, values = []) {
      ejecutarAtomico(() => base.run(sql, values));
    },
    async executeSet(set, transaction = true) {
      if (enTransaccion && !transaction) {
        for (const s of set) base.run(s.statement, s.values);
        return;
      }
      ejecutarAtomico(() => {
        if (transaction) base.run("BEGIN");
        for (const s of set) base.run(s.statement, s.values);
        if (transaction) base.run("COMMIT");
      });
    },
  };
}
