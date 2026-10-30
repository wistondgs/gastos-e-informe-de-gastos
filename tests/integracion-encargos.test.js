import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { textoDePaginas } from "./apoyo-informes.js";
import { entorno, basico, compra, saldo } from "./apoyo-api.js";
import { prepararCompraFinanciera } from "../src/interfaz/flujo-financiero.js";

async function crear() {
  const e = await entorno();
  await basico(e.api);
  return e;
}
async function recibir(api, id, importe, destino = "anticipo") {
  return api.fondos.recibir({
    id,
    fecha: "2026-10-21",
    parte_id: "agricola",
    importe,
    moneda: "NIO",
    aplicaciones: [{ gestion_id: "g1", destino, importe }],
  });
}
async function comprar(api, id, importe, fondo) {
  const tipo =
    fondo === importe ? "fondo" : fondo === 0 ? "propio" : "combinado";
  const seleccion = {
    tipo,
    parte_id: "agricola",
    fondo: (fondo / 100).toFixed(2),
  };
  const entrada = prepararCompraFinanciera(compra({ id, importe }), seleccion);
  assert.equal((await api.compras.registrar(entrada)).creada, true);
  assert.equal((await api.compras.registrar(entrada)).creada, false);
}
async function comprobar(api, custodia, reembolso, numero) {
  const s = (await api.saldos.consultar()).saldos;
  assert.equal(saldo(s, "custodia", "agricola"), custodia);
  assert.equal(saldo(s, "por_reembolsar", "agricola"), reembolso);
  assert.equal((await api.compras.listar()).length, numero);
}

test("C$800 y compra de C$1,000 dejan C$200 de aporte propio", async () => {
  const { api } = await crear();
  await recibir(api, "r1", 80000);
  await comprar(api, "c1", 100000, 80000);
  await comprobar(api, 0, 20000, 1);
});
test("dos entregas de C$800 antes de comprar dejan C$600", async () => {
  const { api } = await crear();
  await recibir(api, "r1", 80000);
  await recibir(api, "r2", 80000);
  await comprar(api, "c1", 100000, 100000);
  await comprobar(api, 60000, 0, 1);
});
test("un anticipo posterior no cancela el aporte propio; el reembolso explícito sí", async () => {
  const { api } = await crear();
  await recibir(api, "r1", 80000);
  await comprar(api, "c1", 100000, 80000);
  await recibir(api, "r2", 80000);
  await comprobar(api, 80000, 20000, 1);
  await recibir(api, "r3", 20000, "reembolso");
  await comprobar(api, 80000, 0, 1);
});
test("compras consecutivas concilian API, PDF y Excel sin duplicar", async () => {
  const { api, repo } = await crear();
  await recibir(api, "r1", 160000);
  await comprar(api, "c1", 100000, 100000);
  await comprar(api, "c2", 30000, 30000);
  await comprar(api, "c3", 50000, 30000);
  await comprobar(api, 0, 20000, 3);
  const opciones = {
    titulo: "Prueba de integración",
    responsable: "",
    destinatario: "",
    corte: "2026-10-27",
    papel: "carta",
    estilo: "ejecutivo",
    incluirFotos: false,
  };
  const { informe, bytes } = await api.informes.emitir({
    alcance: { tipo: "gestion", gestion_id: "g1" },
    opciones,
    exportar: false,
  });
  const modelo = JSON.parse((await repo.una("informes", informe.id)).datos);
  const cuenta = modelo.financiero.cuentas.find(
    (c) => c.parte === "Agrícola de prueba" && c.moneda === "NIO",
  );
  assert.deepEqual(
    [
      modelo.totales.NIO.importe,
      cuenta.recibido,
      cuenta.usado_fondo,
      cuenta.aportado_propio,
      cuenta.custodia,
      cuenta.por_reembolsar,
    ],
    [180000, 160000, 160000, 20000, 0, 20000],
  );
  assert.equal(modelo.filas.length, 3);
  const pdf = textoDePaginas(await PDFDocument.load(bytes))
    .flat()
    .join(" ");
  for (const expresion of [
    /1,800\.00/,
    /1,600\.00/,
    /200\.00/,
    /Fondos aplicados/,
    /Pagado con fondos/,
    /Aporte propio/,
    /Por reembolsar/,
    /En custodia/,
  ])
    assert.match(pdf, expresion);
  assert.match(pdf, /En custodia\s+C\$\s*0\.00/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await api.informes.excel(informe.id)).bytes);
  const valores = new Map();
  wb.getWorksheet("Conciliación").eachRow((fila, i) => {
    if (i > 1) valores.set(fila.getCell(4).value, fila.getCell(5).value);
  });
  assert.equal(valores.get("Fondos aplicados"), 1600);
  assert.equal(valores.get("Pagado con fondos"), 1600);
  assert.equal(valores.get("Aporte propio"), 200);
  assert.equal(valores.get("Por reembolsar"), 200);
  assert.equal(valores.get("En custodia"), 0);
  const detalle = wb.getWorksheet("Compras");
  assert.equal(detalle.rowCount - 1, 3);
  assert.equal(
    [2, 3, 4].reduce((n, i) => n + detalle.getRow(i).getCell(9).value, 0),
    1800,
  );
});
