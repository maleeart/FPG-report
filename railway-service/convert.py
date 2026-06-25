#!/usr/bin/env python3
"""
แปลง xlsx → pdf
แก้ pageSetup XML โดยตรงใน zip (ไม่ใช้ openpyxl เพื่อป้องกันภาพหาย)
จากนั้นแปลงด้วย libreoffice --headless
"""
import sys
import os
import subprocess
import shutil
import zipfile
import re


def fix_xlsx_page_setup(src_path, dst_path):
    """
    เปิด xlsx (zip) และแก้เฉพาะ xl/worksheets/sheet*.xml
    - ลบ scale="..." ออก
    - ตั้ง fitToWidth="1" fitToHeight="0"
    - ตั้ง fitToPage="1" ใน sheetPr
    ไม่แตะไฟล์อื่น → ภาพ/ลายเซ็นยังครบ
    """
    with zipfile.ZipFile(src_path, 'r') as zin, \
         zipfile.ZipFile(dst_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            data = zin.read(item.filename)

            # แก้เฉพาะ sheet xml
            if re.match(r'xl/worksheets/sheet\d+\.xml$', item.filename):
                text = data.decode('utf-8')

                # 1. ลบ scale="..." ออกจาก pageSetup
                text = re.sub(r'\s*scale="[^"]*"', '', text)

                # 2. ตั้ง fitToWidth=1 fitToHeight=0 ใน pageSetup
                def fix_page_setup_tag(m):
                    tag = m.group(0)
                    tag = re.sub(r'fitToWidth="[^"]*"', '', tag)
                    tag = re.sub(r'fitToHeight="[^"]*"', '', tag)
                    # แทรก fitToWidth fitToHeight ก่อน />
                    tag = re.sub(r'\s*/>', ' fitToWidth="1" fitToHeight="0"/>', tag)
                    return tag

                text = re.sub(r'<pageSetup[^/]*/>', fix_page_setup_tag, text)

                # 3. ตั้ง fitToPage="1" ใน sheetPr / pageSetUpPr
                if 'pageSetUpPr' in text:
                    # อัปเดต fitToPage attribute
                    text = re.sub(
                        r'(<pageSetUpPr[^>]*?)fitToPage="[^"]*"',
                        r'\1fitToPage="1"',
                        text
                    )
                    if 'fitToPage' not in re.search(r'<pageSetUpPr[^>]*/>', text or '').group(0) if re.search(r'<pageSetUpPr[^>]*/>', text) else '':
                        text = re.sub(r'<pageSetUpPr', '<pageSetUpPr fitToPage="1"', text)
                elif '<sheetPr' in text:
                    # เพิ่ม pageSetUpPr เข้าไปใน sheetPr
                    text = re.sub(
                        r'(<sheetPr[^>]*/?>)',
                        lambda m: m.group(0).replace('/>', '><pageSetUpPr fitToPage="1"/></sheetPr>') if '/>' in m.group(0) else m.group(0),
                        text, count=1
                    )
                else:
                    # ไม่มี sheetPr เลย → เพิ่มหลัง <?xml ... ?> หรือ <worksheet ...>
                    text = re.sub(
                        r'(<worksheet[^>]*>)',
                        r'\1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
                        text, count=1
                    )

                data = text.encode('utf-8')

            zout.writestr(item, data)

    print(f'[convert] fixed xlsx saved: {dst_path}', flush=True)


def convert(input_path, output_path):
    tmp_dir = os.path.dirname(input_path)
    fixed_path = input_path.replace('.xlsx', '_fixed.xlsx')

    fix_xlsx_page_setup(input_path, fixed_path)

    result = subprocess.run(
        ['libreoffice', '--headless', '--norestore',
         '--convert-to', 'pdf', fixed_path, '--outdir', tmp_dir],
        capture_output=True, text=True, timeout=90
    )
    print(f'[convert] stdout: {result.stdout}', flush=True)
    if result.stderr:
        print(f'[convert] stderr: {result.stderr}', flush=True)

    try:
        os.unlink(fixed_path)
    except Exception:
        pass

    if result.returncode != 0:
        raise RuntimeError(f'LibreOffice error: {result.stderr}')

    expected_pdf = fixed_path.replace('.xlsx', '.pdf')
    if not os.path.exists(expected_pdf):
        raise RuntimeError(f'PDF ไม่ถูกสร้าง: {expected_pdf}')

    shutil.move(expected_pdf, output_path)
    print(f'[convert] done: {output_path}', flush=True)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: convert.py <input.xlsx> <output.pdf>', file=sys.stderr)
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
