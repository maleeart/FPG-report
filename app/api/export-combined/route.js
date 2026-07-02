import { NextResponse } from 'next/server';
import path from 'path';
import { generateCombinedReport } from '../../../src/lib/excelExporter';
import { loadInspectionByDate } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'Template_FPG.xlsx');

/**
 * POST /api/export-combined
 * Body: { date, records? }
 *  - ถ้ามี records → ใช้จาก client (localStorage)
 *  - ถ้าไม่มี records → ดึงจาก GitHub ด้วย date
 *
 * คืนไฟล์ .xlsx เท่านั้น (PDF ต้องการ LibreOffice ซึ่งไม่มีบน Vercel)
 */
// GET /api/export-combined?date=2026-07-01 — mobile-compatible (no blob URL needed)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'ต้องระบุ date' }, { status: 400 });

    const dayData = await loadInspectionByDate(date, 'fpg').catch(e => {
      throw new Error('ดึงข้อมูลจาก GitHub ไม่สำเร็จ: ' + e.message);
    });
    const records = dayData?.records;
    if (!records || Object.keys(records).length === 0)
      return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });

    const xlsxBuf = await generateCombinedReport(records, TEMPLATE_PATH);
    const filename = `FPG_report_${date}.xlsx`;
    return new NextResponse(xlsxBuf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    console.error('export-combined GET:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, records: clientRecords, type = 'fpg' } = body;

    let records = clientRecords;

    // ถ้าไม่ได้ส่ง records มา → ดึงจาก GitHub
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

    const xlsxBuf = await generateCombinedReport(records, TEMPLATE_PATH);
    const filename = `FPG_report_${date || 'report'}.xlsx`;

    return new NextResponse(xlsxBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });
  } catch (err) {
    console.error('export-combined:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
