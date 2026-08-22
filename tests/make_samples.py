from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import os

OUT = "/app/frontend/public/samples"
os.makedirs(OUT, exist_ok=True)


def write_pdf(filename, title, lines):
    path = os.path.join(OUT, filename)
    c = canvas.Canvas(path, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 15)
    c.drawString(50, h - 60, title)
    c.setFont("Helvetica", 11)
    y = h - 95
    for ln in lines:
        if y < 60:
            c.showPage()
            c.setFont("Helvetica", 11)
            y = h - 60
        c.drawString(50, y, ln)
        y -= 20
    c.showPage()
    c.save()
    print("Wrote", path, os.path.getsize(path), "bytes")


write_pdf(
    "kontrak_kerja.pdf",
    "PERJANJIAN KERJA WAKTU TERTENTU (PKWT)",
    [
        "Pihak Pertama: PT Maju Mundur, diwakili oleh Andi Wibowo (Direktur).",
        "Pihak Kedua: Budi Santoso, NIK 3201234567890001,",
        "email budi.santoso@gmail.com, No. HP 081234567890,",
        "beralamat di Jl. Merdeka No. 45, Jakarta Selatan.",
        "",
        "Pasal 1 - Masa Kerja",
        "Karyawan wajib bekerja minimal 2 (dua) tahun. Apabila mengundurkan",
        "diri sebelum masa tersebut, dikenakan denda sebesar 3x gaji bulanan",
        "(penalti sepihak) yang dipotong dari gaji terakhir.",
        "",
        "Pasal 2 - Jam Kerja & Lembur",
        "Karyawan bersedia bekerja lembur tanpa upah tambahan bila diperlukan.",
        "",
        "Pasal 3 - Kerahasiaan",
        "Karyawan dilarang membocorkan informasi perusahaan selama & setelah",
        "masa kerja berakhir.",
        "",
        "Pasal 4 - Pemutusan Hubungan Kerja",
        "Perusahaan dapat memutus kontrak sewaktu-waktu tanpa pesangon",
        "apabila terjadi pelanggaran menurut penilaian perusahaan.",
    ],
)

write_pdf(
    "perjanjian_sewa.pdf",
    "SURAT PERJANJIAN SEWA RUMAH",
    [
        "Yang menyewakan: Rina Melati, NIK 3175098765432100,",
        "No. HP 085711223344, email rina.melati@yahoo.com.",
        "Penyewa: Doni Pratama, beralamat di Jl. Kenanga No. 12, Bandung.",
        "",
        "Pasal 1 - Objek & Biaya Sewa",
        "Objek sewa adalah rumah di Jl. Anggrek No. 7. Biaya sewa",
        "Rp 25.000.000 per tahun, dibayar penuh di muka.",
        "",
        "Pasal 2 - Deposit",
        "Penyewa menyerahkan deposit Rp 5.000.000. Deposit hangus",
        "apabila terlambat membayar sewa lebih dari 7 hari.",
        "",
        "Pasal 3 - Kenaikan Sewa",
        "Pemilik berhak menaikkan sewa sepihak setiap perpanjangan.",
        "",
        "Pasal 4 - Pengakhiran",
        "Apabila penyewa mengakhiri sebelum masa berakhir, seluruh",
        "pembayaran tidak dapat dikembalikan (hangus).",
    ],
)

write_pdf(
    "nda.pdf",
    "PERJANJIAN KERAHASIAAN (NON-DISCLOSURE AGREEMENT)",
    [
        "Para Pihak: Sarah Kusuma (email sarah.k@startup.id, HP 081299887766)",
        "dan PT Data Aman Sentosa, diwakili oleh Hendra Gunawan.",
        "",
        "Pasal 1 - Informasi Rahasia",
        "Mencakup seluruh data teknis, bisnis, dan finansial yang",
        "dipertukarkan para pihak.",
        "",
        "Pasal 2 - Jangka Waktu",
        "Kewajiban kerahasiaan berlaku selamanya tanpa batas waktu",
        "(perpetual) meski kerja sama telah berakhir.",
        "",
        "Pasal 3 - Sanksi Pelanggaran",
        "Pelanggaran dikenakan denda Rp 500.000.000 secara sepihak",
        "tanpa perlu pembuktian kerugian nyata di pengadilan.",
        "",
        "Pasal 4 - Hukum yang Berlaku",
        "Tunduk pada hukum Republik Indonesia (Pasal 1320 KUHPerdata).",
    ],
)

print("All samples written.")
