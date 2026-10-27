import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { bytesABase64, base64ABytes } from "./archivos.js";
import { adaptarSqlJs } from "./adaptador-sqljs.js";
const key = "gastos-sqlite-fase1";
export async function abrirWeb() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const guardado = localStorage.getItem(key);
  return adaptarSqlJs(SQL, guardado ? base64ABytes(guardado) : null, (bytes) =>
    localStorage.setItem(key, bytesABase64(bytes)),
  );
}
