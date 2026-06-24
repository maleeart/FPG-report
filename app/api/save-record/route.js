import { NextResponse } from 'next/server';
import { saveInspectionRecord } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';

/**
 * POST /api/save-record
 * Body option A: { date, records: { machineId: data, ... } }  ← session save (ทุกเครื่องพร้อมกัน)
 * Body option B: { machineId, inspectionDate, ...data }        ← single machine save
 *
 * บันทึกลง GitHub: data/inspections/<date>.json
 * รูปแบบใน GitHub: { date, records: { machineId: data } }
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Option A: session (records object)
    if (body.records) {
      const { date, records, type = 'fpg' } = body;
      if (!date || !records) return NextResponse.json({ error: 'ต้องระบุ date และ records' }, { status: 400 });
      const result = await saveInspectionRecord('__session__', date, { date, type, records }, type);
      return NextResponse.json({ ok: true, path: result.path });
    }

    // Option B: single machine
    if (body.machineId) {
      const { machineId, inspectionDate, type = 'fpg' } = body;
      const result = await saveInspectionRecord(machineId, inspectionDate, body, type);
      return NextResponse.json({ ok: true, path: result.path });
    }

    return NextResponse.json({ error: 'body ไม่ถูกต้อง' }, { status: 400 });
  } catch (err) {
    console.error('save-record error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
