#!/usr/bin/env python3
"""
แปลง xlsx → pdf สำหรับ LibreOffice
1. ใช้ openpyxl ลบ scale ออก + บังคับ fitToWidth=1 ทุก sheet
2. แปลงด้วย libreoffice --headless --convert-to pdf
"""
import sys
import os
import subprocess
import shutil
from openpyxl import load_workbook


def fix_and_convert(input_path, output_path):
    tmp_dir = os.path.dirname(input_path)
    fixed_path = input_path.replace('.xlsx', '_fixed.xlsx')

    # 1. Fix page setup: ลบ scale, ตั้ง fitToPage + fitToWidth=1
    wb = load_workbook(input_path)
    for ws in wb.worksheets:
        # fitToPage อยู่ใน sheet_properties ไม่ใช่ page_setup
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_setup.scale = None   # ลบ scale ออกเพื่อให้ LibreOffice ใช้ fitToWidth แทน
    wb.save(fixed_path)
    print(f'[convert] saved fixed xlsx: {fixed_path}', flush=True)

    # 2. แปลงด้วย LibreOffice
    result = subprocess.run(
        ['libreoffice', '--headless', '--norestore',
         '--convert-to', 'pdf', fixed_path, '--outdir', tmp_dir],
        capture_output=True, text=True, timeout=90
    )
    print(f'[convert] libreoffice stdout: {result.stdout}', flush=True)
    print(f'[convert] libreoffice stderr: {result.stderr}', flush=True)

    # ลบไฟล์ temp
    try:
        os.unlink(fixed_path)
    except Exception:
        pass

    if result.returncode != 0:
        raise RuntimeError(f'LibreOffice error: {result.stderr}')

    # LibreOffice ตั้งชื่อ output ตาม input เช่น input_fixed.pdf
    expected_pdf = fixed_path.replace('.xlsx', '.pdf')
    if not os.path.exists(expected_pdf):
        # ลอง path อื่น
        expected_pdf = os.path.join(tmp_dir, os.path.basename(fixed_path).replace('.xlsx', '.pdf'))

    if not os.path.exists(expected_pdf):
        raise RuntimeError(f'PDF ไม่ถูกสร้าง expected: {expected_pdf}')

    shutil.move(expected_pdf, output_path)
    print(f'[convert] done: {output_path}', flush=True)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: convert.py <input.xlsx> <output.pdf>', file=sys.stderr)
        sys.exit(1)
    fix_and_convert(sys.argv[1], sys.argv[2])
