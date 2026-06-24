import { NextResponse } from 'next/server';
import { generateListReport } from '../../../src/lib/listExporter';
import { loadInspectionByDate } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';

const TYPE_LABELS = { emergency: 'Emergency', smoke: 'Smoke' };

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, date } = body;
    if (!type || !date) return NextResponse.json({ error: 'ต้องระบุ type และ date' }, { status: 400 });

    // ถ้าส่ง devices มาโดยตรง (จาก form) ใช้เลย ไม่งั้น load จาก GitHub
    let general = body.general;
    let devices = body.devices;
    if (!devices) {
      const saved = await loadInspectionByDate(date, type);
      if (!saved) return NextResponse.json({ error: 'ไม่พบข้อมูลวันที่นี้' }, { status: 404 });
      general = saved.records?.general || {};
      devices = saved.records?.devices || [];
    }

    const buffer = await generateListReport(type, { date, general, devices });
    const label  = TYPE_LABELS[type] || type.toUpperCase();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${label}_report_${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('export-list error:', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
