import { NextResponse } from 'next/server';
import { listInspectionDates, loadInspectionByDate } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (date) {
      const type = request.nextUrl?.searchParams?.get('type') || new URL(request.url).searchParams.get('type') || 'fpg';
      const data = await loadInspectionByDate(date, type);
      if (!data) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
      return NextResponse.json(data);
    }

    const dates = await listInspectionDates();
    return NextResponse.json({ dates, githubConfigured: true });
  } catch (err) {
    console.error('inspections API error:', err);
    // ส่ง error กลับพร้อม dates=[] เพื่อให้ frontend แสดงสถานะได้ถูกต้อง
    const isConfigError = err.message?.includes('ENV ไม่ครบ') || err.message?.includes('token');
    return NextResponse.json({
      dates: [],
      githubConfigured: false,
      error: isConfigError ? 'GitHub token ยังไม่ได้ตั้งค่า' : String(err.message || err)
    });
  }
}
