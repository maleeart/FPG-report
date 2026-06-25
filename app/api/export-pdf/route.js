import { NextResponse } from 'next/server';
import { loadInspectionByDate } from '../../../src/lib/githubStorage';
import { generateFpgReportHtml } from '../../../src/lib/fpgReportHtml';
import fieldMap from '../../../src/data/field-map.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/export-pdf
 * Body: { date, records?, type?, filename? }
 *
 * 1. โหลด records
 * 2. generate HTML ของ FPG report (server-side)
 * 3. POST html ไป Railway (puppeteer) → ได้ PDF
 * 4. คืน PDF ให้ client
 */
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

    // หา machine info จาก filename หรือ records key แรก
    const machineId = filename?.replace(/_\d{4}-\d{2}-\d{2}$/, '') || Object.keys(records)[0];
    const machineInfo = (fieldMap.machines || []).find(m => m.id === machineId) || { id: machineId, type };

    // รวม records ถ้ามีหลาย machine (เลือก key แรก)
    const firstKey = Object.keys(records)[0];
    const data = records[firstKey] || records;

    // Generate HTML
    const html = generateFpgReportHtml(data, machineInfo);

    // ส่ง HTML ไปแปลงเป็น PDF ที่ Railway
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
