import { NextResponse } from 'next/server';
import { generateBuildingMeterReport } from '../../../src/lib/buildingMeterExporter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = process.env.GITHUB_REPO_OWNER || 'maleeart';

// GET /api/export-building-meter?week=2026-W26 — อ่าน CSV จาก Energy-Dashboard → เติมลง template → xlsx
export async function GET(request) {
  try {
    const week = new URL(request.url).searchParams.get('week');
    if (!/^\d{4}-W\d{2}$/.test(week || ''))
      return NextResponse.json({ error: 'ต้องระบุ week เช่น 2026-W26' }, { status: 400 });

    const url = `https://raw.githubusercontent.com/${OWNER}/Energy-Dashboard/main/forms/${week}.csv`;
    const csvRes = await fetch(url, { cache: 'no-store' });
    if (!csvRes.ok) return NextResponse.json({ error: `ไม่พบข้อมูลสัปดาห์ ${week}` }, { status: 404 });

    const buffer = await generateBuildingMeterReport(await csvRes.text());
    const fname = `Meter_อาคาร_${week}.xlsx`;
    const ascii = fname.replace(/[^\x20-\x7E]/g, '_');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      },
    });
  } catch (err) {
    console.error('export-building-meter:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
