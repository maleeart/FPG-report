import { NextResponse } from 'next/server';
import path from 'path';
import { generateExcelReport } from '../../../src/lib/excelExporter';
import { saveInspectionRecord } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'Template_FPG.xlsx');

/**
 * POST /api/export-report
 * Body: { machineId, inspectionDate, generalData, preVisual, preRunVisual, readings, testRun, afterRun }
 * 
 * ชื่อไฟล์: <machineId>_<inspectionDate>.xlsx
 * บันทึกประวัติลง GitHub (best-effort ไม่บล็อก download)
 */
export async function POST(request) {
  try {
    const data = await request.json();
    if (!data || !data.machineId) {
      return NextResponse.json({ error: 'ต้องระบุ machineId' }, { status: 400 });
    }

    const buffer = await generateExcelReport(data, TEMPLATE_PATH);

    // บันทึกประวัติ GitHub (best-effort)
    let githubSaveStatus = 'skipped';
    try {
      await saveInspectionRecord(data.machineId, data.inspectionDate, data);
      githubSaveStatus = 'saved';
    } catch (err) {
      console.error('บันทึกประวัติ GitHub ไม่สำเร็จ:', err.message);
      githubSaveStatus = 'failed';
    }

    // ชื่อไฟล์ใช้วันที่ตรวจสอบ
    const date = data.inspectionDate || new Date().toISOString().slice(0, 10);
    const filename = `FPG_report_${date}_${data.machineId}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'X-Github-Save-Status': githubSaveStatus,
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Github-Save-Status',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'สร้างรายงานไม่สำเร็จ', detail: String(error?.message || error) },
      { status: 500 }
    );
  }
}
