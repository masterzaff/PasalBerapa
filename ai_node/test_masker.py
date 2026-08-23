"""
Regression gate untuk lapis masking.

Menjalankan: `python test_masker.py` (di dalam container ai_node).

Kasus-kasus di bawah diambil dari kegagalan NYATA model lama (spaCy
`xx_ent_wiki_sm`): nama asli lolos sementara kosakata hukum justru disensor.
Keduanya diuji — bocor DAN over-masking sama-sama dianggap gagal.
"""
import sys

import masker

CONTRACT = """PERJANJIAN KERJA SAMA

Pihak Pertama: Budi Santoso, NIK 3174012509880003, beralamat di Jl. Merdeka No. 45, Jakarta Selatan, selaku Direktur PT Maju Bersama Sejahtera.

Pihak Kedua: Siti Nurhaliza binti Abdullah, pemegang NPWP 09.254.294.3-407.000, dapat dihubungi di 081234567890 atau siti.nur@gmail.com.

Nilai kontrak sebesar Rp 250.000.000 dibayarkan ke rekening 1234567890 a.n. Budi Santoso. Denda keterlambatan Rp5.000.000 per hari.

Saksi: Andi Wijaya dan Dewi Lestari."""

failures = []


def check(label, cond, detail=""):
    if cond:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}  {detail}")
        failures.append(label)


def main():
    print(f"engine: {masker.engine_name()}\n")

    masked, mapping, entities = masker.mask_text(CONTRACT)
    values = {v.lower() for v in mapping.values()}
    types = {v.lower(): k.strip("<>").rsplit("_", 1)[0] for k, v in mapping.items()}

    print("--- must be MASKED (leaks) ---")
    # Diperiksa PER TOKEN, bukan per string utuh. Memeriksa "andi wijaya" saja
    # akan LULUS untuk keluaran "<PERSON_3> Wijaya" — persis mode kegagalan yang
    # dua-duanya (model lama maupun baru) tunjukkan. Nama tersensor separuh
    # tetap bocor.
    for name in ["budi santoso", "siti nurhaliza binti abdullah", "andi wijaya", "dewi lestari"]:
        for token in name.split():
            if len(token) < 4:
                continue  # "bin"/"binti" adalah penghubung, bukan identitas
            check(f"{name} :: {token}", token not in masked.lower(),
                  f"partial leak — {token!r} survives in masked text")
    for label, raw in [
        ("NIK", "3174012509880003"),
        ("NPWP", "09.254.294.3-407.000"),
        ("phone", "081234567890"),
        ("email", "siti.nur@gmail.com"),
        ("money", "Rp 250.000.000"),
        ("rekening", "1234567890"),
    ]:
        check(f"{label} {raw}", raw not in masked, "still present in masked text")

    print("\n--- must NOT be masked (legal vocabulary) ---")
    # Ini yang dulu rusak: LLM menerima "<PERSON_6> kontrak sebesar <MONEY_1>".
    for word in ["Pihak Pertama", "Pihak Kedua", "Nilai kontrak", "Denda keterlambatan", "Saksi"]:
        check(word, word in masked, "was masked away")
    for junk in ["nilai", "denda", "pihak pertama", "pihak kedua", "npwp", "nik"]:
        check(f"{junk!r} not in mapping", junk not in values, f"-> {types.get(junk)}")

    print("\n--- classification ---")
    check("Jakarta Selatan is not PERSON", types.get("jakarta selatan") != "PERSON",
          f"-> {types.get('jakarta selatan')}")

    print("\n--- tag continuity (free-text masking) ---")
    known = dict(mapping)
    before = len(known)
    q_masked, merged, new_ents = masker.mask_text(
        "Apakah Budi Santoso boleh memutus kontrak sepihak?", known_mapping=known
    )
    budi_tag = next((k for k, v in mapping.items() if v.lower() == "budi santoso"), None)
    check("known value reuses its tag", budi_tag is not None and budi_tag in q_masked,
          f"expected {budi_tag} in {q_masked!r}")
    check("no tag renumbering from _1", all(t in merged for t in mapping),
          "existing tags dropped from merged mapping")
    check("merged mapping is a superset", len(merged) >= before)

    print("\n--- long document (windowing past the 512-token cap) ---")
    filler = "\n\n".join(
        f"Pasal {i}: Para Pihak sepakat menyelesaikan perselisihan secara musyawarah mufakat "
        f"sesuai ketentuan yang berlaku dalam perjanjian ini." for i in range(1, 60)
    )
    long_doc = filler + "\n\nDitandatangani oleh Rudi Hartono selaku kuasa hukum."
    long_masked, long_map, _ = masker.mask_text(long_doc)
    check("entity found in the final window",
          "rudi hartono" not in long_masked.lower(),
          "name past the first window was missed")
    check("filler paragraphs untouched", "Para Pihak sepakat" in long_masked)

    print()
    if failures:
        print(f"{len(failures)} FAILED: {failures}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
