import { NextResponse } from 'next/server';
import { generateListReport } from '../../../src/lib/listExporter';
import { loadInspectionByDate, loadInspectionByFilename } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';

const TYPE_LABELS = { emergency: 'Emergency', smoke: 'Smoke' };

// ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออก
const sanitize = s => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();

async function buildResponse(type, date, general, devices) {
  const buffer = await generateListReport(type, { date, general, devices });
  const label  = TYPE_LABELS[type] || type.toUpperCase();
  const building = sanitize(general?.building);
  const floor    = sanitize(general?.floor);
  const parts = [`${label}_report_${date}`, building, floor].filter(Boolean);
  const fname = parts.join('_') + '.xlsx';
  const asciiName = fname.replace(/[^\x20-\x7E]/g, '_');
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  });
}

// GET /api/export-list?type=smoke&filename=smoke_2026-06-30_...json
// used by mobile (window.location.href) — loads data from GitHub
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const date = searchParams.get('date');
    const filename = searchParams.get('filename');
    const building = searchParams.get('building') || '';
    const floor    = searchParams.get('floor')    || '';
    if (!type || !date) return NextResponse.json({ error: 'ต้องระบุ type และ date' }, { status: 400 });

    const saved = filename
      ? await loadInspectionByFilename(filename)
      : await loadInspectionByDate(date, type, building, floor);
    if (!saved) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });

    return buildResponse(type, date, saved.records?.general || {}, saved.records?.devices || []);
  } catch (err) {
    console.error('export-list GET error:', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, date } = body;
    if (!type || !date) return NextResponse.json({ error: 'ต้องระบุ type และ date' }, { status: 400 });

    let general = body.general;
    let devices = body.devices;
    if (!devices) {
      const { filename, building = '', floor = '' } = body;
      const saved = filename
        ? await loadInspectionByFilename(filename)
        : await loadInspectionByDate(date, type, building, floor);
      if (!saved) return NextResponse.json({ error: 'ไม่พบข้อมูลวันที่นี้' }, { status: 404 });
      general = saved.records?.general || {};
      devices = saved.records?.devices || [];
    }

    return buildResponse(type, date, general, devices);
  } catch (err) {
    console.error('export-list error:', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
