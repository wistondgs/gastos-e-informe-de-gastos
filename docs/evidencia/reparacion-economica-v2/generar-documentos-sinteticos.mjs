import {writeFile,mkdir} from 'node:fs/promises';
import {entorno,basico,compra} from '/home/wis/dev/gastos-e-informe-de-gastos/tests/apoyo-api.js';
import {prepararCompraFinanciera} from '/home/wis/dev/gastos-e-informe-de-gastos/src/interfaz/flujo-financiero.js';
const {api,repo}=await entorno();await basico(api);
await api.fondos.recibir({id:'fondo',fecha:'2026-10-21',parte_id:'agricola',importe:10000,moneda:'NIO',aplicaciones:[{gestion_id:'g1',destino:'anticipo',importe:10000}]});
await api.compras.registrar(prepararCompraFinanciera(compra({id:'mixta',importe:11000}),{tipo:'combinado',parte_id:'agricola',fondo:'80'}));
await api.compras.registrar(compra({id:'credito',importe:1000000,forma_pago:'credito',deudor_id:'agricola',asignaciones:[{parte_id:'agricola',importe:1000000}]}));
await api.pagos.registrar({id:'abono',compra_id:'credito',fecha:'2026-10-25',importe:400000,origen:'tercero',parte_id:'agricola'});
await api.compras.registrar(prepararCompraFinanciera(compra({id:'sin-gestion',gestion_id:null,importe:1500,moneda:'USD'}),{tipo:'propio',parte_id:'otra'}));
await api.partes.crear({id:'empresa-sin-compras',nombre:'Empresa sin compras',tipo:'empresa'});
await api.fondos.recibir({id:'deposito-sin-compras',fecha:'2026-10-21',parte_id:'empresa-sin-compras',importe:25000,moneda:'NIO',aplicaciones:[{gestion_id:'g1',destino:'anticipo',importe:20000}]});
const opciones={titulo:'Informe sintético',responsable:'',destinatario:'',corte:'2026-10-27',papel:'carta',estilo:'ejecutivo',incluirFotos:false};
await mkdir('/tmp/gastos-cierre-documentos',{recursive:true});
for (const [nombre,alcance] of [['gestion',{tipo:'gestion',gestion_id:'g1'}],['empresa-sin-compras',{tipo:'parte',parte_id:'empresa-sin-compras'}],['sin-gestion',{tipo:'parte',parte_id:'otra'}]]) {
const {informe,bytes}=await api.informes.emitir({alcance,opciones,exportar:false});
await writeFile(`/tmp/gastos-cierre-documentos/${nombre}.pdf`,bytes);
await writeFile(`/tmp/gastos-cierre-documentos/${nombre}.xlsx`,(await api.informes.excel(informe.id)).bytes);
await writeFile(`/tmp/gastos-cierre-documentos/${nombre}.json`,(await repo.una('informes',informe.id)).datos);
}
await writeFile('/tmp/gastos-cierre-documentos/saldos.json',JSON.stringify(await api.saldos.consultar(),null,2));
