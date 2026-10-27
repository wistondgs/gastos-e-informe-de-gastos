export function adaptarSqlJs(SQL, snapshot, persistir) {
  let base = snapshot ? new SQL.Database(snapshot) : new SQL.Database();
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
      ejecutarAtomico(() => {
        if (transaction) base.run("BEGIN");
        for (const s of set) base.run(s.statement, s.values);
        if (transaction) base.run("COMMIT");
      });
    },
  };
}
