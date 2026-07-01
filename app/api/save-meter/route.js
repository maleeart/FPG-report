import { NextResponse } from 'next/server';
import { loadMeterMonth, saveMeterMonth } from '../../../src/lib/meterStorage';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    if (!month) return NextResponse.json({ error: 'ต้องระบุ month' }, { status: 400 });
    const data = await loadMeterMonth(month);
    return NextResponse.json(data || { yearMonth: month, days: {} });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { yearMonth, day, entry } = await request.json();
    if (!yearMonth || !day || !entry) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const existing = await loadMeterMonth(yearMonth);
    const data = existing || { yearMonth, days: {} };
    data.days[day] = entry;
    await saveMeterMonth(yearMonth, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { yearMonth, day } = await request.json();
    if (!yearMonth || !day) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const data = await loadMeterMonth(yearMonth);
    if (!data) return NextResponse.json({ ok: true });
    delete data.days[day];
    await saveMeterMonth(yearMonth, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
