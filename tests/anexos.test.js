import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validarAjusteAnexo,
  dimensiones,
  orientacionExif,
  ajusteEfectivo,
  planificarAnexos,
  geometria,
  proponerRecorte,
} from "../src/documentos/anexos.js";
import { prepararInforme } from "../src/dominio/informe.js";
import { informePdf } from "../src/exportaciones/informe-pdf.js";
import {
  png,
  pngMarca,
  fotoDe,
  archivosEnMemoria,
  compraDe,
} from "./apoyo-informes.js";
function jpegConOrientacion(o) {
  const tiff = [
    0x49,
    0x49,
    0x2a,
    0x00,
    8,
    0,
    0,
    0,
    1,
    0,
    0x12,
    0x01,
    3,
    0,
    1,
    0,
    0,
    0,
    o,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  const app1 = [...Buffer.from("Exif\0\0"), ...tiff];
  const largo = app1.length + 2;
  const sof = [
    0xff, 0xc0, 0, 17, 8, 0x01, 0x2c, 0x00, 0xc8, 3, 1, 0x22, 0, 2, 0x11, 1, 3,
    0x11, 1,
  ];
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    largo >> 8,
    largo & 255,
    ...app1,
    ...sof,
    0xff,
    0xd9,
  ]);
}
test("la orientación EXIF se lee y se suma al giro; las espejadas se informan", () => {
  assert.deepEqual(orientacionExif(jpegConOrientacion(6), "image/jpeg"), {
    rotacion: 90,
    espejada: false,
  });
  assert.deepEqual(orientacionExif(jpegConOrientacion(3), "image/jpeg"), {
    rotacion: 180,
    espejada: false,
  });
  assert.deepEqual(orientacionExif(jpegConOrientacion(8), "image/jpeg"), {
    rotacion: 270,
    espejada: false,
  });
  assert.deepEqual(orientacionExif(jpegConOrientacion(1), "image/jpeg"), {
    rotacion: 0,
    espejada: false,
  });
  assert.equal(
    orientacionExif(jpegConOrientacion(5), "image/jpeg").espejada,
    true,
  );
  assert.deepEqual(orientacionExif(png(4, 4), "image/png"), {
    rotacion: 0,
    espejada: false,
  });
  assert.equal(
    ajusteEfectivo({ rotacion: 270 }, { rotacion: 180 }).rotacion,
    90,
  );
});
test("las dimensiones salen de la cabecera del PNG y del JPEG", () => {
  assert.deepEqual(dimensiones(png(123, 45), "image/png"), { w: 123, h: 45 });
  assert.deepEqual(dimensiones(jpegConOrientacion(1), "image/jpeg"), {
    w: 200,
    h: 300,
  });
});
test("un ajuste inválido se rechaza; un recorte inseguro nunca se aplica", () => {
  assert.throws(() => validarAjusteAnexo({ rotacion: 45 }), /giro/);
  assert.throws(() => validarAjusteAnexo({ enderezar: 20 }), /enderezado/);
  assert.throws(
    () => validarAjusteAnexo({ recorte: { x: 0.9, y: 0, w: 0.5, h: 1 } }),
    /recorte/,
  );
  assert.throws(
    () => validarAjusteAnexo({ recorte: { x: 0, y: 0, w: 0.1, h: 1 } }),
    /recorte/,
  );
  assert.equal(
    validarAjusteAnexo({
      rotacion: 90,
      enderezar: -2.345,
      recorte: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    }).enderezar,
    -2.3,
  );
  assert.deepEqual(
    ajusteEfectivo({ recorte: '{"x":0.9,"y":0,"w":0.5,"h":1}' }).recorte,
    { x: 0, y: 0, w: 1, h: 1 },
    "inseguro: imagen completa",
  );
});
const pagina = { ancho: 528, alto: 704 };
const anexo = (n, w, h, ajuste = {}) => ({
  numero: n,
  dims: { w, h },
  ajuste: ajusteEfectivo(ajuste),
});
test("el plan junta dos chicos, da página entera al grande y parte el largo en tramos que cubren todo", () => {
  const plan = planificarAnexos(
    [
      anexo(1, 300, 200),
      anexo(2, 300, 180),
      anexo(3, 3000, 4000),
      anexo(4, 600, 6000),
      anexo(5, 300, 200),
    ],
    pagina,
  );
  const orden = plan.map((p) => p.map((c) => c.anexo.numero));
  assert.deepEqual(orden[0], [1, 2], "dos chicos comparten página");
  assert.deepEqual(orden[1], [3], "una foto grande ocupa una página");
  assert.deepEqual(orden.at(-1), [5], "un chico solo, sin pareja, va solo");
  const largas = orden.slice(2, -1);
  assert.ok(
    largas.length >= 2 && largas.every((p) => p.length === 1 && p[0] === 4),
  );
  // 600×6000 px a ancho completo (528 pt) mide 5280 pt: con 656 pt por página y solape, 9 tramos.
  assert.equal(largas.length, 9);
  const tramos = plan
    .filter((p) => p[0].anexo.numero === 4)
    .map((p) => p[0].tramo);
  assert.equal(tramos[0].desde, 0);
  assert.ok(Math.abs(tramos.at(-1).hasta - 1) < 1e-9, "llega al final");
  for (let i = 1; i < tramos.length; i++)
    assert.ok(
      tramos[i].desde < tramos[i - 1].hasta,
      "se solapan: ningún renglón queda en el corte",
    );
  assert.deepEqual(
    tramos.map((t) => t.parte),
    tramos.map((_, i) => i + 1),
  );
  for (const p of plan)
    for (const c of p) {
      assert.ok(
        c.caja.y >= 0 && c.caja.y + c.caja.h <= pagina.alto - 48 + 1e-9,
        "dentro del área",
      );
      assert.ok(
        c.cabeceraY <= pagina.alto && c.cabeceraY >= c.caja.y + c.caja.h,
        "la cabecera va arriba de su imagen",
      );
    }
  const [arriba, abajo] = plan[0];
  assert.ok(
    abajo.caja.y + abajo.caja.h <= arriba.caja.y,
    "las dos mitades no se pisan",
  );
});
test("una foto girada de lado se planifica con su tamaño ya girado", () => {
  const [p] = planificarAnexos([anexo(1, 4000, 600, { rotacion: 90 })], pagina);
  assert.ok(p[0].tramo, "de lado y girada es una tira larga: va en tramos");
});
const esquinas = (m) => {
  const [a, b, c, d, e, f] = m;
  const pt = (x, y) =>
    [a * x + c * y + e, b * x + d * y + f].map(
      (v) => Math.round(v * 1000) / 1000,
    );
  return { abajoIzq: pt(0, 0), arribaIzq: pt(0, 1), arribaDer: pt(1, 1) };
};
test("la geometría gira sin deformar y deja la imagen dentro de su caja", () => {
  const caja = { x: 0, y: 0, w: 400, h: 400 };
  const dims = { w: 200, h: 100 };
  const g0 = geometria(dims, ajusteEfectivo({}), caja);
  assert.deepEqual(
    g0.visible,
    { x: 50, y: 250, w: 300, h: 150 },
    "arriba, centrada, ampliada como mucho 1,5 veces",
  );
  assert.deepEqual(esquinas(g0.matriz).arribaIzq, [50, 400]);
  const g90 = geometria(dims, ajusteEfectivo({ rotacion: 90 }), caja);
  assert.ok(
    Math.abs(g90.visible.w / g90.visible.h - 100 / 200) < 1e-9,
    "proporción girada",
  );
  const v = g90.visible;
  assert.deepEqual(
    esquinas(g90.matriz).arribaIzq,
    [v.x + v.w, v.y + v.h].map((n) => Math.round(n * 1000) / 1000),
    "la esquina superior izquierda original queda arriba a la derecha",
  );
  const g180 = geometria(dims, ajusteEfectivo({ rotacion: 180 }), caja);
  assert.deepEqual(
    esquinas(g180.matriz).arribaIzq,
    [g180.visible.x + g180.visible.w, g180.visible.y].map(
      (n) => Math.round(n * 1000) / 1000,
    ),
  );
  const g270 = geometria(dims, ajusteEfectivo({ rotacion: 270 }), caja);
  assert.deepEqual(
    esquinas(g270.matriz).arribaIzq,
    [g270.visible.x, g270.visible.y].map((n) => Math.round(n * 1000) / 1000),
  );
  const recortada = geometria(
    dims,
    ajusteEfectivo({ recorte: { x: 0.5, y: 0, w: 0.5, h: 1 } }),
    caja,
  );
  assert.ok(
    Math.abs(recortada.visible.w / recortada.visible.h - 1) < 1e-9,
    "el recorte de la mitad derecha es cuadrado",
  );
  for (const g of [g0, g90, g180, g270, recortada]) {
    assert.ok(
      g.visible.x >= -1e-9 &&
        g.visible.y >= -1e-9 &&
        g.visible.x + g.visible.w <= 400 + 1e-9 &&
        g.visible.y + g.visible.h <= 400 + 1e-9,
    );
  }
});
function rgba(w, h, pintar) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pintar(x, y);
      d.set([r, g, b, 255], (y * w + x) * 4);
    }
  return d;
}
test("la propuesta de recorte quita márgenes uniformes y nunca corta contenido", () => {
  const blanco = () => [250, 250, 250];
  const conTexto = (x, y) =>
    x >= 30 && x < 70 && y >= 20 && y < 90 ? [10, 10, 10] : blanco();
  const r = proponerRecorte(rgba(100, 100, conTexto), 100, 100);
  assert.ok(
    r.x <= 0.3 && r.x + r.w >= 0.7 && r.y <= 0.2 && r.y + r.h >= 0.9,
    "el contenido queda adentro",
  );
  assert.ok(r.x > 0.2 && r.w < 0.6, "se quitó margen");
  assert.equal(
    proponerRecorte(rgba(50, 50, blanco), 50, 50),
    null,
    "nada que recortar",
  );
  assert.equal(
    proponerRecorte(
      rgba(50, 50, (x) => (x < 25 ? [0, 0, 0] : [255, 255, 255])),
      50,
      50,
    ),
    null,
    "fondo irregular: no es seguro",
  );
  assert.equal(
    proponerRecorte(
      rgba(100, 100, (x, y) => (x === 50 && y === 50 ? [0, 0, 0] : blanco())),
      100,
      100,
    ),
    null,
    "resultado diminuto: no es seguro",
  );
  assert.equal(
    proponerRecorte(new Uint8Array(3), 10, 10),
    null,
    "datos inválidos",
  );
  const esquinaConSello = (x, y) =>
    x < 3 && y < 3 ? [200, 200, 200] : conTexto(x, y);
  assert.equal(
    proponerRecorte(rgba(100, 100, esquinaConSello), 100, 100),
    null,
    "una esquina con contenido: no se recorta",
  );
  const casiLleno = (x, y) =>
    x >= 1 && x < 99 && y >= 1 && y < 99 ? [10, 10, 10] : blanco();
  assert.equal(
    proponerRecorte(rgba(100, 100, casiLleno), 100, 100),
    null,
    "sin márgenes que valga la pena quitar",
  );
});
let hayPdftoppm = true;
try {
  execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
} catch {
  hayPdftoppm = false;
}
function leerPpm(ruta) {
  const b = readFileSync(ruta);
  const cab = b.subarray(0, 40).toString("latin1").split(/\s+/);
  const [w, h] = [Number(cab[1]), Number(cab[2])];
  const inicio = b.length - w * h * 3;
  return { w, h, px: (x, y) => b[inicio + (y * w + x) * 3] };
}
test(
  "en el PDF rasterizado, el giro de 90° lleva la marca de la esquina superior izquierda a la superior derecha",
  { skip: !hayPdftoppm && "falta pdftoppm" },
  async () => {
    const bytes = pngMarca(400, 600);
    const files = archivosEnMemoria();
    const foto = await fotoDe("f", "c1", bytes);
    await files.escribir(foto.ruta, bytes);
    const dir = mkdtempSync(join(tmpdir(), "anexo-"));
    try {
      const centro = {};
      for (const rotacion of [0, 90]) {
        const modelo = prepararInforme(
          {
            alcance: { tipo: "gestion", gestion_id: "gestion-1" },
            descripcion: { lineas: [] },
            items: [
              {
                compra: compraDe("c1", "NIO", 100),
                fotos: [foto],
                ajustes: { f: ajusteEfectivo({ rotacion }) },
                dims: { f: { w: 400, h: 600 } },
              },
            ],
          },
          {
            titulo: "Prueba",
            responsable: "",
            destinatario: "",
            corte: "2026-10-27",
            papel: "carta",
            estilo: "formal",
            incluirFotos: true,
            revision: 1,
            generado: "2026-10-27T00:00:00Z",
          },
        );
        writeFileSync(
          join(dir, `r${rotacion}.pdf`),
          await informePdf(modelo, files),
        );
        execFileSync("pdftoppm", [
          "-r",
          "30",
          "-f",
          "2",
          "-l",
          "2",
          "-singlefile",
          join(dir, `r${rotacion}.pdf`),
          join(dir, `r${rotacion}`),
        ]);
        const img = leerPpm(join(dir, `r${rotacion}.ppm`));
        let sx = 0,
          sy = 0,
          n = 0;
        let x0 = img.w,
          x1 = 0,
          y0 = img.h,
          y1 = 0;
        for (let y = 0; y < img.h; y++)
          for (let x = 0; x < img.w; x++) {
            const v = img.px(x, y);
            if (v > 200 && v < 240) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
            if (v < 40 && y > img.h * 0.12) {
              sx += x;
              sy += y;
              n++;
            }
          }
        centro[rotacion] = {
          x: (sx / n - x0) / (x1 - x0),
          y: (sy / n - y0) / (y1 - y0),
        };
      }
      assert.ok(
        centro[0].x < 0.25 && centro[0].y < 0.25,
        `sin giro, arriba a la izquierda: ${JSON.stringify(centro[0])}`,
      );
      assert.ok(
        centro[90].x > 0.75 && centro[90].y < 0.25,
        `girada 90°, arriba a la derecha: ${JSON.stringify(centro[90])}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
