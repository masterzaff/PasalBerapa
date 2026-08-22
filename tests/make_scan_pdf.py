from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs("/app/tests/assets", exist_ok=True)

# Render text to an image (simulating a scanned page, no embedded text layer)
img = Image.new("RGB", (1000, 500), "white")
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
    fontb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
except Exception:
    font = ImageFont.load_default()
    fontb = font

d.text((40, 40), "SURAT PERJANJIAN SEWA", fill="black", font=fontb)
lines = [
    "Yang bertanda tangan Rina Melati",
    "menyewakan rumah kepada penyewa.",
    "Biaya sewa Rp 25.000.000 per tahun.",
    "Deposit hangus bila terlambat bayar.",
]
y = 130
for ln in lines:
    d.text((40, y), ln, fill="black", font=font)
    y += 55

img_path = "/app/tests/assets/_scan_page.png"
img.save(img_path)

path = "/app/tests/assets/scan_sample.pdf"
c = canvas.Canvas(path, pagesize=A4)
w, h = A4
c.drawImage(ImageReader(img_path), 40, h - 360, width=w - 80, height=300)
c.showPage()
c.save()
print("Wrote", path, os.path.getsize(path), "bytes")
