import { NextResponse } from 'next/server';
import { loadMeterMonth, listMeterMonths } from '../../../src/lib/meterStorage';
import { generateMeterReport, generateMeterYearReport } from '../../../src/lib/meterExporter';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year  = searchParams.get('year');

    if (month) {
      const data = await loadMeterMonth(month);
      const buf = await generateMeterReport(month, data || { yearMonth: month, days: {} });
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="meter_${month}.xlsx"`,
        },
      });
    }

    if (year) {
      const months = await listMeterMonths(year);
      const allData = {};
      await Promise.all(months.map(async ym => {
        allData[ym] = await loadMeterMonth(ym);
      }));
      const buf = await generateMeterYearReport(year, allData);
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="meter_${year}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: 'ต้องระบุ month หรือ year' }, { status: 400 });
  } catch (err) {
    console.error('export-meter error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
