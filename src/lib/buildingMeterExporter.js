const ExcelJS = require('exceljs');
const path = require('path');

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const TEMPLATE = path.join(process.cwd(), 'templates', 'FormจดMeter69 (New).xlsx');
const SHEET    = 'Print Rev2';

// minimal RFC4180 CSV parser — handles quotes, escaped "", commas-in-fields, CRLF, BOM
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// "26/06/2026" → "26 มิถุนายน 2569"  (ค.ศ. → พ.ศ.)
function toThaiDate(ddmmyyyy) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(ddmmyyyy || '').trim());
  if (!m) return '';
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12) return '';
  return `${d} ${THAI_MONTHS[mo - 1]} ${y + 543}`;
}

// ค่าที่ซ้ำมากที่สุด (ไม่นับค่าว่าง) — ถ้าไม่มีคืน ''
function mode(arr) {
  const c = {}; let best = '', bn = 0;
  for (const v of arr) { if (!v) continue; c[v] = (c[v] || 0) + 1; if (c[v] > bn) { bn = c[v]; best = v; } }
  return best;
}

async function generateBuildingMeterReport(csvText) {
  const rows = parseCSV(csvText).filter(r => r.length > 1);
  if (!rows.length) throw new Error('CSV ว่าง');
  const hdr = rows[0].map(h => h.trim());
  const iSort = hdr.indexOf('sort_order'), iUnit = hdr.indexOf('raw_unit'),
        iVal = hdr.indexOf('raw_reading'), iReader = hdr.indexOf('reader'), iDate = hdr.indexOf('reading_date');
  if (iSort < 0 || iUnit < 0 || iVal < 0) throw new Error('CSV ขาดคอลัมที่ต้องใช้ (sort_order/raw_unit/raw_reading)');

  const bySort = {};
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const no = parseInt(c[iSort], 10);
    if (!Number.isFinite(no)) continue;
    bySort[no] = {
      unit:   (c[iUnit]   || '').trim(),
      val:    (c[iVal]    || '').trim(),
      reader: iReader >= 0 ? (c[iReader] || '').trim() : '',
      date:   iDate   >= 0 ? (c[iDate]   || '').trim() : '',
    };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`ไม่พบ sheet: ${SHEET}`);

  // เติมค่า: ทุกแถวที่ col A (No) เป็นตัวเลข → lookup ตาม sort_order → D=Unit, E=Raw.Value
  const headerRows = [];
  ws.eachRow((row, r) => {
    const a = row.getCell(1).value;
    if (typeof a === 'string' && a.includes('ผู้จดบันทึก')) headerRows.push(r);
    if (typeof a === 'number') {
      const rec = bySort[a];
      if (rec) {
        ws.getCell(`D${r}`).value = rec.unit;
        const num = parseFloat(rec.val.replace(/,/g, ''));
        ws.getCell(`E${r}`).value = (rec.val !== '' && !isNaN(num)) ? num : rec.val;
      }
    }
  });

  // header แต่ละหน้า: ผู้จดบันทึก + วันที่ (ค่าที่ซ้ำมากสุดในหน้านั้น) — เขียนทับเฉพาะเมื่อมีค่า
  const lastRow = ws.rowCount;
  for (let h = 0; h < headerRows.length; h++) {
    const start = headerRows[h];
    const end = h + 1 < headerRows.length ? headerRows[h + 1] : lastRow + 1;
    const readers = [], dates = [];
    for (let r = start + 1; r < end; r++) {
      const a = ws.getRow(r).getCell(1).value;
      if (typeof a === 'number' && bySort[a]) { readers.push(bySort[a].reader); dates.push(bySort[a].date); }
    }
    const reader = mode(readers);
    const thaiDate = toThaiDate(mode(dates));
    if (reader)   ws.getCell(`A${start}`).value = 'ผู้จดบันทึก ' + reader;
    if (thaiDate) ws.getCell(`C${start}`).value = 'ประจำวันที่ ' + thaiDate;
  }

  // exceljs ทิ้ง manual page break ตอน read → ใส่กลับ (break ก่อนแต่ละหน้า = ก่อน title row ของหน้า 2..N)
  for (let h = 1; h < headerRows.length; h++) ws.getRow(headerRows[h] - 3).addPageBreak();

  return wb.xlsx.writeBuffer();
}

module.exports = { generateBuildingMeterReport, parseCSV, toThaiDate, mode };

// ponytail: self-check — node src/lib/buildingMeterExporter.js
if (require.main === module) {
  const assert = require('assert');
  assert.deepStrictEqual(parseCSV('a,b\n1,"x,y"\n'), [['a','b'],['1','x,y']]);
  assert.deepStrictEqual(parseCSV('﻿a,b\n1,2'), [['a','b'],['1','2']]);
  assert.deepStrictEqual(parseCSV('a\n"he said ""hi"""'), [['a'],['he said "hi"']]);
  assert.strictEqual(toThaiDate('26/06/2026'), '26 มิถุนายน 2569');
  assert.strictEqual(toThaiDate('2/7/2026'), '2 กรกฎาคม 2569');
  assert.strictEqual(toThaiDate('bad'), '');
  assert.strictEqual(mode(['a','b','a','']), 'a');
  assert.strictEqual(mode(['', '']), '');
  console.log('OK');
}
