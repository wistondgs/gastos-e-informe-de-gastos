/**
 * Motor de anexos: decide cómo se presenta cada comprobante en el PDF sin
 * tocar la foto original. Un «derivado» es un juego de parámetros (giro,
 * enderezado y recorte) que se aplica al dibujar; nunca se reescriben píxeles.
 */
const ROTACIONES = [0, 90, 180, 270];
const MINIMO_RECORTE = 0.2;
function falla(mensaje, campo) {
  const e = new Error(mensaje);
  e.campo = campo;
  throw e;
}
/** Valida un ajuste; el recorte va en fracciones de la imagen ya girada. */
export function validarAjusteAnexo(a) {
  const rotacion = a.rotacion ?? 0,
    enderezar = a.enderezar ?? 0;
  if (!ROTACIONES.includes(rotacion))
    falla("El giro debe ser 0, 90, 180 o 270 grados.", "rotacion");
  if (
    typeof enderezar !== "number" ||
    !Number.isFinite(enderezar) ||
    Math.abs(enderezar) > 15
  )
    falla("El enderezado admite hasta 15 grados.", "enderezar");
  let recorte = a.recorte ?? null;
  if (typeof recorte === "string") recorte = JSON.parse(recorte);
  if (recorte !== null && !recorteSeguro(recorte))
    falla(
      "El recorte debe quedar dentro de la imagen y conservar al menos un 20 % de cada lado.",
      "recorte",
    );
  return {
    foto_id: a.foto_id,
    rotacion,
    enderezar: Math.round(enderezar * 10) / 10,
    recorte:
      recorte === null ? null : JSON.stringify(redondearRecorte(recorte)),
    actualizado: a.actualizado,
  };
}
const redondear = (n) => Math.round(n * 10000) / 10000;
const redondearRecorte = (r) => ({
  x: redondear(r.x),
  y: redondear(r.y),
  w: redondear(r.w),
  h: redondear(r.h),
});
export function recorteSeguro(r) {
  const n = (v) => typeof v === "number" && Number.isFinite(v);
  return (
    r &&
    n(r.x) &&
    n(r.y) &&
    n(r.w) &&
    n(r.h) &&
    r.x >= 0 &&
    r.y >= 0 &&
    r.w >= MINIMO_RECORTE &&
    r.h >= MINIMO_RECORTE &&
    r.x + r.w <= 1.0001 &&
    r.y + r.h <= 1.0001
  );
}
/** Dimensiones en píxeles de un PNG o un JPEG, leídas de su cabecera. */
export function dimensiones(bytes, tipo) {
  if (tipo === "image/png") {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: v.getUint32(16), h: v.getUint32(20) };
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const m = bytes[i + 1];
    const largo = (bytes[i + 2] << 8) | bytes[i + 3];
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(m)
    )
      return {
        h: (bytes[i + 5] << 8) | bytes[i + 6],
        w: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    i += 2 + largo;
  }
  throw new Error("No se pudieron leer las dimensiones del comprobante.");
}
/**
 * Giro que indica la etiqueta EXIF de un JPEG (0 si no tiene). Los PDF no
 * respetan esa etiqueta, así que se suma al giro manual. Las variantes
 * espejadas (2, 4, 5, 7) se informan y no se corrigen.
 */
export function orientacionExif(bytes, tipo) {
  if (tipo !== "image/jpeg") return { rotacion: 0, espejada: false };
  let i = 2;
  while (i + 4 < bytes.length && bytes[i] === 0xff) {
    const m = bytes[i + 1],
      largo = (bytes[i + 2] << 8) | bytes[i + 3];
    if (m === 0xda) break;
    if (
      m === 0xe1 &&
      String.fromCharCode(...bytes.slice(i + 4, i + 8)) === "Exif"
    ) {
      const t = i + 10;
      const le = bytes[t] === 0x49;
      const u16 = (p) =>
        le ? bytes[p] | (bytes[p + 1] << 8) : (bytes[p] << 8) | bytes[p + 1];
      const u32 = (p) =>
        le ? u16(p) | (u16(p + 2) << 16) : (u16(p) << 16) | u16(p + 2);
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (u16(e) === 0x0112) {
          const o = u16(e + 8);
          return {
            rotacion: { 3: 180, 6: 90, 8: 270 }[o] || 0,
            espejada: [2, 4, 5, 7].includes(o),
          };
        }
      }
      break;
    }
    i += 2 + largo;
  }
  return { rotacion: 0, espejada: false };
}
/** El ajuste efectivo de una foto: EXIF más el ajuste guardado. */
export function ajusteEfectivo(ajuste, exif = { rotacion: 0 }) {
  const a = ajuste || {};
  const recorte =
    typeof a.recorte === "string" ? JSON.parse(a.recorte) : a.recorte || null;
  return {
    rotacion: ((a.rotacion || 0) + exif.rotacion) % 360,
    enderezar: a.enderezar || 0,
    recorte:
      recorte && recorteSeguro(recorte) ? recorte : { x: 0, y: 0, w: 1, h: 1 },
  };
}
/** Tamaño en píxeles de lo que se ve: la imagen girada y recortada. */
export function tamanoVisible({ w, h }, ajuste) {
  const [W, H] = ajuste.rotacion % 180 ? [h, w] : [w, h];
  return { W, H, vw: W * ajuste.recorte.w, vh: H * ajuste.recorte.h };
}
/**
 * Reparte los anexos en páginas. Un comprobante chico comparte la página con
 * el siguiente chico (factura y voucher quedan juntos); uno largo se divide
 * en tramos de ancho completo que se solapan para no cortar renglones; el
 * resto ocupa una página entera.
 */
export function planificarAnexos(
  anexos,
  {
    ancho,
    alto,
    cabecera = 48,
    separacion = 16,
    solape = 0.05,
    maximaEscala = 1.5,
  },
) {
  const completa = alto - cabecera;
  const mitad = (alto - 2 * cabecera - separacion) / 2;
  const clasificados = anexos.map((x) => {
    const { vw, vh } = tamanoVisible(x.dims, x.ajuste);
    const sCompleta = Math.min(ancho / vw, completa / vh, maximaEscala);
    const sMitad = Math.min(ancho / vw, mitad / vh, maximaEscala);
    const sAncho = Math.min(ancho / vw, maximaEscala);
    if (vh * sAncho > completa * 1.15 && vw * sCompleta < ancho * 0.55) {
      const tramo = completa / sAncho / vh; // fracción visible por página
      const paso = tramo * (1 - solape);
      const partes = Math.ceil((1 - tramo) / paso - 1e-9) + 1;
      return { ...x, clase: "larga", partes, tramo, paso };
    }
    // Chica: en media página se ve casi igual que en una entera, o a tamaño natural.
    const chica = sMitad >= sCompleta * 0.8 || sMitad >= maximaEscala * 0.7;
    return { ...x, clase: chica ? "chica" : "completa" };
  });
  const paginas = [];
  for (let i = 0; i < clasificados.length; i++) {
    const x = clasificados[i];
    if (x.clase === "larga") {
      for (let p = 0; p < x.partes; p++) {
        const desde = Math.min(p * x.paso, 1 - x.tramo);
        paginas.push([
          {
            anexo: x,
            caja: { x: 0, y: 0, w: ancho, h: completa },
            cabeceraY: alto,
            tramo: {
              desde,
              hasta: desde + x.tramo,
              parte: p + 1,
              de: x.partes,
            },
          },
        ]);
      }
    } else if (x.clase === "chica" && clasificados[i + 1]?.clase === "chica") {
      const y = clasificados[++i];
      paginas.push([
        {
          anexo: x,
          caja: { x: 0, y: mitad + cabecera + separacion, w: ancho, h: mitad },
          cabeceraY: alto,
          tramo: null,
        },
        {
          anexo: y,
          caja: { x: 0, y: 0, w: ancho, h: mitad },
          cabeceraY: mitad + cabecera,
          tramo: null,
        },
      ]);
    } else
      paginas.push([
        {
          anexo: x,
          caja: { x: 0, y: 0, w: ancho, h: completa },
          cabeceraY: alto,
          tramo: null,
        },
      ]);
  }
  return paginas;
}
const exacto = (v) => (Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : v);
/**
 * Dónde y cómo dibujar la imagen original para que, dentro de la caja, se vea
 * la región elegida (recorte y tramo) girada y sin deformar. Devuelve el
 * rectángulo visible (para recortar el dibujo) y la matriz PDF [a b c d e f]
 * que lleva el cuadrado unidad de la imagen a su lugar.
 */
export function geometria(
  dims,
  ajuste,
  caja,
  tramo = null,
  maximaEscala = 1.5,
) {
  const { W, H } = tamanoVisible(dims, ajuste);
  const r = ajuste.recorte;
  const X0 = r.x * W,
    CW = r.w * W;
  const Y0 = r.y * H + (tramo ? tramo.desde * r.h * H : 0);
  const RH = (tramo ? tramo.hasta - tramo.desde : 1) * r.h * H;
  const s = Math.min(caja.w / CW, caja.h / RH, maximaEscala);
  const bw = CW * s,
    bh = RH * s;
  const bx = caja.x + (caja.w - bw) / 2,
    by = caja.y + caja.h - bh;
  const cx = bx - X0 * s + (W * s) / 2,
    cy = by + bh + Y0 * s - (H * s) / 2;
  const ws = dims.w * s,
    hs = dims.h * s;
  const phi = (-(ajuste.rotacion + ajuste.enderezar) * Math.PI) / 180;
  const cos = exacto(Math.cos(phi)),
    sin = exacto(Math.sin(phi));
  const a = cos * ws,
    b = sin * ws,
    c = -sin * hs,
    d = cos * hs;
  return {
    escala: s,
    visible: { x: bx, y: by, w: bw, h: bh },
    matriz: [a, b, c, d, cx - (a + c) / 2, cy - (b + d) / 2],
  };
}
/**
 * Propone recortar márgenes de color uniforme a partir de los píxeles RGBA.
 * Devuelve null cuando no es seguro: fondo irregular, nada que recortar o un
 * resultado demasiado chico. Nunca quita contenido: deja un margen de cortesía.
 */
export function proponerRecorte(
  rgba,
  ancho,
  alto,
  { tolerancia = 40, proporcion = 0.99, margen = 0.015 } = {},
) {
  if (
    !(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray) ||
    rgba.length !== ancho * alto * 4
  )
    return null;
  const px = (x, y) => {
    const i = (y * ancho + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2]];
  };
  const esquinas = [
    px(0, 0),
    px(ancho - 1, 0),
    px(0, alto - 1),
    px(ancho - 1, alto - 1),
  ];
  const fondo = [0, 1, 2].map((k) =>
    Math.round(esquinas.reduce((t, e) => t + e[k], 0) / 4),
  );
  const parecido = (c) =>
    Math.abs(c[0] - fondo[0]) +
      Math.abs(c[1] - fondo[1]) +
      Math.abs(c[2] - fondo[2]) <=
    tolerancia;
  if (!esquinas.every(parecido)) return null;
  const filaVacia = (y) => {
    let n = 0;
    for (let x = 0; x < ancho; x++) n += parecido(px(x, y));
    return n >= ancho * proporcion;
  };
  const columnaVacia = (x, y0, y1) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) n += parecido(px(x, y));
    return n >= (y1 - y0 + 1) * proporcion;
  };
  let arriba = 0,
    abajo = alto - 1;
  while (arriba < abajo && filaVacia(arriba)) arriba++;
  while (abajo > arriba && filaVacia(abajo)) abajo--;
  let izq = 0,
    der = ancho - 1;
  while (izq < der && columnaVacia(izq, arriba, abajo)) izq++;
  while (der > izq && columnaVacia(der, arriba, abajo)) der--;
  const x = Math.max(0, izq / ancho - margen),
    y = Math.max(0, arriba / alto - margen);
  const r = {
    x: redondear(x),
    y: redondear(y),
    w: redondear(Math.min(1, (der + 1) / ancho + margen) - x),
    h: redondear(Math.min(1, (abajo + 1) / alto + margen) - y),
  };
  if (r.w > 0.98 && r.h > 0.98) return null;
  return recorteSeguro(r) ? r : null;
}
