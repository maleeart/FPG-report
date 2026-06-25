import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { loadInspectionByDate } from '../../../src/lib/githubStorage';
import { generateFpgReportHtml } from '../../../src/lib/fpgReportHtml';
import fieldMap from '../../../src/data/field-map.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readBase64(filePath) {
  try {
    return fs.readFileSync(filePath).toString('base64');
  } catch { return null; }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, records: clientRecords, type = 'fpg', filename } = body;

    const loUrl = process.env.LIBREOFFICE_SERVICE_URL;
    if (!loUrl) {
      return NextResponse.json(
        { error: 'LIBREOFFICE_SERVICE_URL ยังไม่ได้ตั้งค่าใน Environment Variables' },
        { status: 500 }
      );
    }

    // โหลด records
    let records = clientRecords;
    if (!records) {
      try {
        const dayData = await loadInspectionByDate(date, type);
        records = dayData?.records;
      } catch (e) {
        return NextResponse.json({ error: 'ดึงข้อมูลจาก GitHub ไม่สำเร็จ: ' + e.message }, { status: 500 });
      }
    }

    if (!records || Object.keys(records).length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
    }

    // Embed logo + approver signature เป็น base64
    const logoBase64 = readBase64(path.join(process.cwd(), 'public/assets/shared/egat-logo.jpg'));
    const approverSigBase64 = readBase64(path.join(process.cwd(), 'public/assets/shared/signature-approver.png'));

    // โหลดรูปประกอบแต่ละเครื่อง
    const machineImages = {};
    for (const m of fieldMap.machines || []) {
      const imgs = (m.image_files || []).map(fname =>
        readBase64(path.join(process.cwd(), `public/${m.image_dir}/${fname}`))
      ).filter(Boolean);
      if (imgs.length > 0) machineImages[m.id] = imgs;
    }

    // Generate HTML ทุกเครื่องในวันนั้น (records = { machineId: data, ... })
    const html = generateFpgReportHtml(records, logoBase64, approverSigBase64, machineImages);

    // ส่ง HTML ไปแปลงเป็น PDF ที่ Railway (puppeteer)
    const convertRes = await fetch(`${loUrl.replace(/\/$/, '')}/convert-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    });

    if (!convertRes.ok) {
      const errText = await convertRes.text().catch(() => 'unknown error');
      return NextResponse.json({ error: 'แปลง PDF ไม่สำเร็จ: ' + errText }, { status: 500 });
    }

    const pdfBuf = await convertRes.arrayBuffer();
    const pdfFilename = `FPG_report_${date || 'report'}.pdf`;

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });
  } catch (err) {
    console.error('export-pdf:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
