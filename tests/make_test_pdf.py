from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import os

os.makedirs("/app/tests/assets", exist_ok=True)
path = "/app/tests/assets/kontrak_sample.pdf"
c = canvas.Canvas(path, pagesize=A4)
w, h = A4
lines = [
    "PERJANJIAN KERJA WAKTU TERTENTU",
    "",
    "Pihak Pertama: PT Maju Mundur, diwakili oleh Andi Wibowo.",
    "Pihak Kedua: Budi Santoso, NIK 3201234567890001,",
    "email budi.santoso@gmail.com, No. HP 081234567890,",
    "beralamat di Jl. Merdeka No. 45, Jakarta Selatan.",
    "",
    "Pasal 1 - Masa Kerja",
    "Karyawan wajib bekerja minimal 2 (dua) tahun. Apabila",
    "mengundurkan diri sebelum masa tersebut, dikenakan denda",
    "sebesar 3x gaji bulanan (penalti sepihak).",
    "",
    "Pasal 2 - Kerahasiaan",
    "Karyawan dilarang membocorkan informasi perusahaan.",
    "",
    "Pasal 3 - Pemutusan Hubungan Kerja",
    "Perusahaan dapat memutus kontrak sewaktu-waktu tanpa",
    "pesangon apabila terjadi pelanggaran.",
]
y = h - 60
for ln in lines:
    c.drawString(50, y, ln)
    y -= 22
c.showPage()
c.save()
print("Wrote", path, os.path.getsize(path), "bytes")
