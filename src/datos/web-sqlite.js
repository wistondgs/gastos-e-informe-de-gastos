import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { bytesABase64, base64ABytes } from "./archivos.js";
import { adaptarSqlJs } from "./adaptador-sqljs.js";
const key = "gastos-sqlite-fase1";
export async function abrirWeb() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const guardado = localStorage.getItem(key);
  return adaptarSqlJs(
    SQL,
    guardado ? base64ABytes(guardado) : null,
    (bytes) => localStorage.setItem(key, bytesABase64(bytes)),
    {
      leer: () => {
        const valor = localStorage.getItem(key);
        return valor ? base64ABytes(valor) : null;
      },
      bloquear: (operacion) => {
        if (!navigator.locks)
          throw new Error(
            "Este navegador no permite coordinar el acceso seguro a los datos.",
          );
        return navigator.locks.request(key, operacion);
      },
    },
  );
}
