#!/usr/bin/env python3
"""
แปลง xlsx → pdf โดย:
1. แก้ XML ใน xlsx zip โดยตรง (ลบ scale, set fitToWidth=1, set fitToPage=1)
2. แปลงด้วย soffice --headless --convert-to pdf
"""
import sys, os, re, zipfile, subprocess, time


# ─────────────────────────────────────────────────────────────
# ส่วนที่ 1 : แก้ xlsx XML
# ─────────────────────────────────────────────────────────────

def _fix_sheet_xml(xml: str, sheet_name: str) -> str:
    # ── debug: แสดง pageSetup และ sheetPr ก่อนแก้ ──
    for part in re.findall(r'<(?:pageSetup|sheetPr|pageSetUpPr)[^>]*/?>', xml):
        print(f'[before] {sheet_name}: {part}', flush=True)

    # 1. ลบ scale="..." ออก (ทุกรูปแบบ)
    xml = re.sub(r'\s+scale="[^"]*"', '', xml)

    # 2. แก้ pageSetup: fitToWidth=1, fitToHeight=0
    def _fix_ps(m):
        tag = m.group(0)
        if 'fitToWidth=' in tag:
            tag = re.sub(r'fitToWidth="[^"]*"', 'fitToWidth="1"', tag)
        else:
            tag = tag[:-2] + ' fitToWidth="1"/>'
        if 'fitToHeight=' in tag:
            tag = re.sub(r'fitToHeight="[^"]*"', 'fitToHeight="0"', tag)
        else:
            tag = tag[:-2] + ' fitToHeight="0"/>'
        return tag

    xml = re.sub(r'<pageSetup\b[^>]*/>', _fix_ps, xml)

    # 3. ตรวจสอบ pageSetUpPr fitToPage="1"
    if 'pageSetUpPr' in xml:
        # มีอยู่แล้ว → ตรวจว่า fitToPage ถูกต้อง
        if 'fitToPage=' in xml:
            xml = re.sub(r'fitToPage="[^"]*"', 'fitToPage="1"', xml)
        else:
            xml = re.sub(r'<pageSetUpPr\b', '<pageSetUpPr fitToPage="1"', xml)
    elif '<sheetPr' in xml:
        # มี sheetPr แต่ไม่มี pageSetUpPr → ใส่เข้าไป
        # กรณี self-closing <sheetPr ... />
        xml = re.sub(r'(<sheetPr\b[^>]*)/>',
                     r'\1><pageSetUpPr fitToPage="1"/></sheetPr>', xml, count=1)
        # กรณี <sheetPr ...>
        xml = re.sub(r'(<sheetPr\b[^>]*>)(?!<pageSetUpPr)',
                     r'\1<pageSetUpPr fitToPage="1"/>', xml, count=1)
    else:
        # ไม่มี sheetPr เลย → ใส่ใหม่หลัง <worksheet ...>
        xml = re.sub(
            r'(<worksheet\b[^>]*>)',
            r'\1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
            xml, count=1
        )

    # ── debug: แสดงผลหลังแก้ ──
    for part in re.findall(r'<(?:pageSetup|sheetPr|pageSetUpPr)[^>]*/?>', xml):
        print(f'[after]  {sheet_name}: {part}', flush=True)

    return xml


def fix_xlsx(src: str, dst: str):
    with zipfile.ZipFile(src, 'r') as zin, \
         zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if re.match(r'xl/worksheets/sheet\d+\.xml$', item.filename):
                original = data.decode('utf-8')
                fixed    = _fix_sheet_xml(original, item.filename)
                data     = fixed.encode('utf-8')
            zout.writestr(item, data)


# ─────────────────────────────────────────────────────────────
# ส่วนที่ 2 : แปลงด้วย soffice
# ─────────────────────────────────────────────────────────────

def convert_to_pdf(xlsx_path: str, pdf_path: str):
    out_dir = os.path.dirname(pdf_path)

    # kill soffice เดิม
    subprocess.run(
        ['sh', '-c', 'pkill -9 -f soffice 2>/dev/null; killall -9 soffice 2>/dev/null; true'],
        capture_output=True
    )
    time.sleep(1)

    result = subprocess.run(
        ['soffice', '--headless', '--norestore', '--nologo', '--nofirststartwizard',
         '--convert-to', 'pdf', '--outdir', out_dir, xlsx_path],
        capture_output=True, text=True, timeout=120
    )

    print(f'[soffice] rc={result.returncode}', flush=True)
    if result.stdout.strip():
        print(f'[soffice] stdout: {result.stdout.strip()}', flush=True)
    if result.stderr.strip():
        print(f'[soffice] stderr: {result.stderr.strip()}', flush=True)

    if result.returncode != 0:
        raise RuntimeError(f'soffice failed (rc={result.returncode}): {result.stderr}')

    # soffice ตั้งชื่อไฟล์ตาม input
    base = os.path.splitext(os.path.basename(xlsx_path))[0]
    generated = os.path.join(out_dir, base + '.pdf')
    if not os.path.exists(generated):
        raise RuntimeError(f'PDF not found at {generated}')

    os.rename(generated, pdf_path)
    print(f'[done] PDF: {pdf_path}', flush=True)


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

def main():
    src_xlsx = sys.argv[1]
    out_pdf  = sys.argv[2]
    fixed    = src_xlsx + '.fixed.xlsx'

    print('[step1] fixing xlsx XML...', flush=True)
    fix_xlsx(src_xlsx, fixed)

    print('[step2] converting to PDF...', flush=True)
    try:
        convert_to_pdf(fixed, out_pdf)
    finally:
        try:
            os.unlink(fixed)
        except Exception:
            pass


if __name__ == '__main__':
    main()
