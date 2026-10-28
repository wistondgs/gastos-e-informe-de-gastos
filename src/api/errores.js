import { ErrorFinanciero } from "../dominio/finanzas.js";
/**
 * El único tipo de error que sale de la API. La interfaz decide qué mostrar
 * por `codigo` y, si viene, marca el `campo`.
 *
 *  VALIDACION    un dato no cumple una regla (campo indica cuál)
 *  NO_ENCONTRADO el registro pedido no existe
 *  ESTADO        la operación no corresponde al estado actual (p. ej. gestión terminada)
 *  CONFLICTO     el identificador ya pertenece a otro registro
 *  INTEGRIDAD    un archivo falta o no coincide con su huella
 *  VERSION       la base o el respaldo son de una versión más nueva
 */
export class ErrorApi extends Error {
  constructor(codigo, mensaje, campo = null) {
    super(mensaje);
    this.name = "ErrorApi";
    this.codigo = codigo;
    this.campo = campo;
  }
  toJSON() {
    return { codigo: this.codigo, mensaje: this.message, campo: this.campo };
  }
}
export const noEncontrado = (que) =>
  new ErrorApi("NO_ENCONTRADO", `No se encontró ${que}.`);
export const estado = (mensaje) => new ErrorApi("ESTADO", mensaje);
export const validacion = (mensaje, campo = null) =>
  new ErrorApi("VALIDACION", mensaje, campo);
export function traducir(e) {
  if (e instanceof ErrorApi) return e;
  if (e instanceof ErrorFinanciero)
    return new ErrorApi(e.codigo, e.message, e.campo);
  const m = e?.message || "No se pudo completar la operación.";
  if (/ya pertenece a otr/.test(m)) return new ErrorApi("CONFLICTO", m);
  if (/alterad|falta|no coincide/i.test(m))
    return new ErrorApi("INTEGRIDAD", m);
  if (/versión más reciente|versión más nueva/.test(m))
    return new ErrorApi("VERSION", m);
  if (/UNIQUE|FOREIGN KEY|CHECK constraint/.test(m))
    return new ErrorApi(
      "CONFLICTO",
      "El registro contradice los datos guardados.",
    );
  return new ErrorApi("VALIDACION", m, e?.campo ?? null);
}
