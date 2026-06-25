#!/usr/bin/env python3
"""
แปลง xlsx → pdf ด้วย LibreOffice UNO API
ตั้ง ScaleToPagesX=1, ScaleToPagesY=0 ให้ทุก sheet (fit 1 page wide, unlimited tall)
"""
import sys
import os
import subprocess
import time
import socket


def wait_for_port(port, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            s = socket.socket()
            s.settimeout(1)
            s.connect(('localhost', port))
            s.close()
            return True
        except Exception:
            time.sleep(0.5)
    return False


def convert(input_path, output_path):
    port = 2002

    lo_proc = subprocess.Popen([
        'libreoffice', '--headless', '--norestore', '--nofirststartwizard',
        f'--accept=socket,host=localhost,port={port};urp;StarOffice.ServiceManager',
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if not wait_for_port(port, timeout=40):
        lo_proc.kill()
        raise RuntimeError('LibreOffice UNO socket timeout')

    try:
        import uno
        from com.sun.star.beans import PropertyValue

        local_ctx = uno.getComponentContext()
        resolver = local_ctx.ServiceManager.createInstanceWithContext(
            'com.sun.star.bridge.UnoUrlResolver', local_ctx)
        ctx = resolver.resolve(
            f'uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext')
        smgr = ctx.ServiceManager
        desktop = smgr.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)

        file_url = 'file://' + input_path
        open_props = (PropertyValue('Hidden', 0, True, 0),)
        doc = desktop.loadComponentFromURL(file_url, '_blank', 0, open_props)

        sheets = doc.getSheets()
        page_styles = doc.getStyleFamilies().getByName('PageStyles')

        seen_styles = set()
        for i in range(sheets.getCount()):
            sheet = sheets.getByIndex(i)
            style_name = sheet.PageStyle
            if style_name in seen_styles:
                continue
            seen_styles.add(style_name)
            style = page_styles.getByName(style_name)
            # fit ทุก column ใน 1 หน้า, rows ไม่จำกัด (เหมือน Excel fitToWidth=1 fitToHeight=0)
            style.ScaleToPages = 0
            style.ScaleToPagesX = 1
            style.ScaleToPagesY = 0

        pdf_url = 'file://' + output_path
        pdf_props = (PropertyValue('FilterName', 0, 'calc_pdf_Export', 0),)
        doc.storeToURL(pdf_url, pdf_props)
        doc.close(False)

    finally:
        lo_proc.terminate()
        try:
            lo_proc.wait(timeout=5)
        except Exception:
            lo_proc.kill()


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: convert.py <input.xlsx> <output.pdf>', file=sys.stderr)
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
