/**
 * Descripción única de las tablas: la usan el repositorio, el respaldo y la
 * restauración. El orden es el de las claves foráneas (padres primero).
 */
export const TABLAS = [
  { nombre: "ajustes", clave: "clave", columnas: ["clave", "valor"] },
  {
    nombre: "partes",
    columnas: ["id", "nombre", "tipo", "activa", "creada"],
  },
  {
    nombre: "catalogos",
    columnas: ["id", "tipo", "nombre", "activa", "creada"],
  },
  {
    nombre: "gestiones",
    columnas: [
      "id",
      "nombre",
      "fecha_inicio",
      "fecha_fin",
      "descripcion",
      "responsable_id",
    ],
  },
  {
    nombre: "compras",
    columnas: [
      "id",
      "fecha_compra",
      "fecha_registro",
      "concepto",
      "proveedor",
      "importe",
      "moneda",
      "factura",
      "estado",
      "gestion_id",
      "forma_pago",
      "deudor_id",
      "anulada",
    ],
  },
  {
    nombre: "fotos",
    columnas: ["id", "compra_id", "ruta", "tipo", "clase", "sha256"],
  },
  {
    nombre: "catalogo_usos",
    columnas: ["id", "catalogo_id", "compra_id", "tipo", "nombre"],
  },
  {
    nombre: "anexos",
    clave: "foto_id",
    columnas: ["foto_id", "rotacion", "enderezar", "recorte", "actualizado"],
  },
  {
    nombre: "asignaciones",
    columnas: ["id", "compra_id", "parte_id", "importe", "anulada"],
  },
  {
    nombre: "recepciones",
    columnas: [
      "id",
      "fecha",
      "fecha_registro",
      "parte_id",
      "importe",
      "moneda",
      "referencia",
      "anulada",
    ],
  },
  {
    nombre: "aplicaciones",
    columnas: [
      "id",
      "recepcion_id",
      "gestion_id",
      "destino",
      "importe",
      "anulada",
    ],
  },
  {
    nombre: "pagos",
    columnas: [
      "id",
      "compra_id",
      "asignacion_id",
      "fecha",
      "fecha_registro",
      "importe",
      "origen",
      "parte_id",
      "anulada",
    ],
  },
  {
    nombre: "movimientos",
    columnas: [
      "id",
      "tipo",
      "gestion_id",
      "gestion_destino_id",
      "parte_id",
      "fecha",
      "fecha_registro",
      "importe",
      "moneda",
      "anulada",
    ],
  },
  {
    nombre: "informes",
    columnas: [
      "id",
      "clave",
      "alcance",
      "gestion_id",
      "revision",
      "codigo",
      "fecha_corte",
      "generado",
      "papel",
      "estilo",
      "con_fotos",
      "motor",
      "datos",
      "sha256",
      "archivo",
      "privado",
    ],
  },
  {
    nombre: "eventos",
    columnas: [
      "id",
      "fecha",
      "entidad",
      "entidad_id",
      "tipo",
      "motivo",
      "datos",
    ],
  },
];
export const TABLA = Object.fromEntries(TABLAS.map((t) => [t.nombre, t]));
export function insertarSql(nombre) {
  const t = TABLA[nombre];
  return `INSERT INTO ${t.nombre} (${t.columnas.join(",")}) VALUES (${t.columnas.map(() => "?").join(",")})`;
}
/** Lo que vale una columna nueva en las filas que existían antes de crearla. */
export const DEFECTOS = {
  gestiones: { descripcion: "", responsable_id: null },
  compras: { forma_pago: "sin_detalle", deudor_id: null, anulada: null },
  asignaciones: { anulada: null },
  recepciones: { referencia: "", anulada: null },
  aplicaciones: { anulada: null },
  pagos: { asignacion_id: null, parte_id: null, anulada: null },
  movimientos: { gestion_destino_id: null, anulada: null },
  anexos: { rotacion: 0, enderezar: 0, recorte: null },
  informes: { gestion_id: null, archivo: null, privado: null, motor: 1 },
};
export const conDefectos = (nombre, fila) => ({
  ...(DEFECTOS[nombre] || {}),
  ...Object.fromEntries(
    Object.entries(fila).filter(([, v]) => v !== undefined),
  ),
});
export const valoresDe = (nombre, fila) => {
  const f = conDefectos(nombre, fila);
  return TABLA[nombre].columnas.map((c) => (f[c] === undefined ? null : f[c]));
};
