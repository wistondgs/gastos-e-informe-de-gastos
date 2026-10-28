// Copiar a tests/ del commit probado y ejecutar: node --test tests/escenario-sintetico.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entorno, basico, compra, saldo } from './apoyo-api.js';
import { prepararCompraFinanciera } from '../src/interfaz/flujo-financiero.js';
test('tres depósitos C$100000 + C$100000 + C$20000, compra C$150000 y remanente C$70000', async () => {
  const {api} = await entorno(); await basico(api);
  for (const [id,importe] of [['r1',10000000],['r2',10000000],['r3',2000000]]) await api.fondos.recibir({id,fecha:'2026-10-21',parte_id:'agricola',importe,moneda:'NIO',aplicaciones:[{gestion_id:'g1',destino:'anticipo',importe}]});
  await api.compras.registrar(prepararCompraFinanciera(compra({id:'c-validacion',importe:15000000}),{tipo:'fondo',parte_id:'agricola'}));
  assert.equal((await api.fondos.recepciones()).length,3);
  const saldos=(await api.saldos.consultar()).saldos;
  assert.equal(saldo(saldos,'custodia','agricola'),7000000);
  assert.equal(saldo(saldos,'por_reembolsar','agricola'),0);
});
