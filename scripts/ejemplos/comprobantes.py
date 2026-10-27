"""Comprobantes ficticios para los informes de ejemplo. Ningún dato es real."""
import sys
from PIL import Image, ImageDraw, ImageFont

destino = sys.argv[1]
def fuente(t):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"):
        try:
            return ImageFont.truetype(f, t)
        except OSError:
            pass
    return ImageFont.load_default()

def ticket(nombre, ancho, lineas, fondo=(246, 244, 238)):
    alto = 70 + 34 * len(lineas)
    im = Image.new("RGB", (ancho, alto), fondo)
    d = ImageDraw.Draw(im)
    y = 30
    for texto, grande in lineas:
        f = fuente(30 if grande else 22)
        w = d.textlength(texto, font=f)
        x = (ancho - w) / 2 if grande and texto.strip() == texto and "  " not in texto else 30
        d.text((max(x, 20), y), texto, fill=(30, 30, 30), font=f)
        y += 34
    im.save(f"{destino}/{nombre}.jpg", quality=88)

ticket("factura-corta", 720, [
    ("SUPERMERCADO EJEMPLO S.A.", True), ("RUC J0000000000000 · Managua", False),
    ("FACTURA N.° 0000123", True), ("Fecha: 21/10/2026", False), ("-" * 40, False),
    ("Arroz 10 lb              C$ 2,400.00", False), ("Aceite 1 gal             C$ 1,350.00", False),
    ("Frijol 10 lb             C$ 2,950.00", False), ("Azúcar 5 lb              C$ 1,500.00", False),
    ("-" * 40, False), ("TOTAL                    C$ 8,200.00", True), ("DATOS FICTICIOS", False)])
items = [(f"Artículo de prueba {i:02d}       C$ {100 + i * 7:>8,.2f}", False) for i in range(1, 60)]
ticket("factura-larga", 720, [("FERRETERÍA DEMOSTRACIÓN", True), ("FACTURA N.° 0000124", True),
    ("Fecha: 22/10/2026", False), ("-" * 40, False), *items, ("-" * 40, False),
    ("TOTAL                    C$ 4,250.75", True), ("DATOS FICTICIOS", False)])
ticket("voucher", 520, [("COMPROBANTE DE PAGO", True), ("Terminal 0007 · Lote 15", False),
    ("Tarjeta **** 0000", False), ("Monto C$ 4,250.75", True), ("APROBADO", True),
    ("DATOS FICTICIOS", False)], fondo=(240, 246, 250))
ticket("recibo-dolares", 680, [("RESTAURANTE MUESTRA", True), ("RECIBO N.° 0000125", True),
    ("Fecha: 23/10/2026", False), ("Almuerzo de trabajo     US$ 85.00", False),
    ("TOTAL                   US$ 85.00", True), ("DATOS FICTICIOS", False)])
# Una foto tomada de lado: el recibo girado 90°.
Image.open(f"{destino}/recibo-dolares.jpg").rotate(90, expand=True).save(f"{destino}/recibo-girado.jpg", quality=88)
