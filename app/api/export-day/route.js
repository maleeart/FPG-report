import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { generateCombinedReport } from '../../../src/lib/excelExporter';
import { loadInspectionByDate } from '../../../src/lib/githubStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'Template_FPG.xlsx');
const execFileAsync = promisify(execFile);

/**
 * GET /api/export-day?date=2026-06-22&format=xlsx|pdf
 * ดาวน์โหลดรายงานรวมทุกเครื่องของวันนั้น
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const format = searchParams.get('format') || 'xlsx';
    if (!date) return NextResponse.json({ error: 'ต้องระบุ date' }, { status: 400 });

    // โหลดข้อมูลจาก GitHub
    let dayData = null;
    try {
      dayData = await loadInspectionByDate(date);
    } catch {
      dayData = null;
    }
    if (!dayData || !dayData.records || Object.keys(dayData.records).length === 0) {
      return NextResponse.json({ error: `ไม่พบข้อมูลวันที่ ${date}` }, { status: 404 });
    }

    // สร้าง Excel รวมทุกเครื่อง
    const xlsxBuf = await generateCombinedReport(dayData.records, TEMPLATE_PATH);
    const filename = `FPG_report_${date}`;

    if (format === 'pdf') {
      // แปลง xlsx → pdf ผ่าน LibreOffice (ใช้ได้เฉพาะบน server ที่มี soffice)
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veri-'));
      const xlsxPath = path.join(tmpDir, `${filename}.xlsx`);
      const pdfPath = path.join(tmpDir, `${filename}.pdf`);

      try {
        await fs.writeFile(xlsxPath, xlsxBuf);
        await execFileAsync('soffice', [
          '--headless', '--convert-to', 'pdf',
          '--outdir', tmpDir, xlsxPath,
        ], { timeout: 60000 });
        const pdfBuf = await fs.readFile(pdfPath);
        return new NextResponse(pdfBuf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          },
        });
      } finally {
        // ทำความสะอาด
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    // Default: xlsx
    return new NextResponse(xlsxBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });
  } catch (err) {
    console.error('export-day error:', err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
