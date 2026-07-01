const ExcelJS = require('exceljs');

const THAI_DAYS  = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function thaiMonthYear(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Build header rows 1-6 for a monthly sheet (cols A-P = 16 cols) */
function buildMonthHeaders(ws, yearMonth) {
  const bold = { bold: true };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Row 1: title merged A1:P1
  ws.mergeCells('A1:P1');
  const r1 = ws.getCell('A1');
  r1.value = 'DAILY CHECK ELECTRICAL MAIN METER กฟน.';
  r1.font = { bold: true, size: 13 };
  r1.alignment = center;

  // Row 2: month/year in col O
  ws.getCell('O2').value = thaiMonthYear(yearMonth);
  ws.getCell('O2').font = bold;

  // Row 3: group headers
  const r3groups = [
    ['A3:C3', 'Date/Time'],
    ['D3:I3', 'Electrical Consumption kWh'],
    ['J3:L3', 'Previous Electrical Consumption'],
    ['M3:N3', 'Maximum Demand'],
    ['O3:P3', 'Power Reactive'],
  ];
  for (const [range, val] of r3groups) {
    ws.mergeCells(range);
    const c = ws.getCell(range.split(':')[0]);
    c.value = val; c.font = bold; c.alignment = center;
  }

  // Row 4: sub-headers (one per meter group)
  const r4 = [
    ['D4:E4','kWh'],['F4:G4','On Peak kWh'],['H4:I4','Off Peak kWh'],
    ['J4','kWh'],['K4','On Peak'],['L4','Off Peak'],
    ['M4','kW'],['N4','-'],['O4','kVarh'],['P4','kVar'],
  ];
  for (const [range, val] of r4) {
    if (range.includes(':')) ws.mergeCells(range);
    const c = ws.getCell(range.split(':')[0]);
    c.value = val; c.font = bold; c.alignment = center;
  }

  // Row 5: Data/Q'TY/Day
  const r5cols = {
    A:'วัน', B:'วันที่', C:'เวลา',
    D:'Data', E:"Q'TY/Day", F:'Data', G:"Q'TY/Day", H:'Data', I:"Q'TY/Day",
    J:'Data', K:'Data', L:'Data', M:'Data', N:'Data', O:'Data', P:'Data',
  };
  for (const [col, val] of Object.entries(r5cols)) {
    const c = ws.getCell(`${col}5`);
    c.value = val; c.font = bold; c.alignment = center;
  }

  // Row 6: meter codes
  const r6cols = { D:'10', E:'', F:'11', G:'', H:'12', I:'', J:'20', K:'21', L:'22', M:'31', N:'32', O:'60', P:'61' };
  for (const [col, val] of Object.entries(r6cols)) {
    const c = ws.getCell(`${col}6`);
    c.value = val; c.font = bold; c.alignment = center;
  }
}

/**
 * generateMonthSheet — adds a worksheet to wb and fills it
 * Returns { totalE, totalG, totalI, lastEntry } for summary use
 */
function generateMonthSheet(wb, sheetName, yearMonth, monthData) {
  const ws = wb.addWorksheet(sheetName);
  buildMonthHeaders(ws, yearMonth);

  const days = monthData?.days || {};
  const total = daysInMonth(yearMonth);
  const [y, m] = yearMonth.split('-').map(Number);

  let prevD = null, prevF = null, prevH = null;
  let sumE = 0, sumG = 0, sumI = 0;
  let lastEntry = null; // last workday entry for summary

  for (let d = 1; d <= total; d++) {
    const dayStr = pad2(d);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const row = 6 + d; // data starts row 7

    const thaiDay = THAI_DAYS[dow];
    const ws_r = ws.getRow(row);

    ws_r.getCell(1).value = thaiDay;  // A
    ws_r.getCell(2).value = d;        // B

    const isWeekend = dow === 0 || dow === 6;
    const entry = days[dayStr];

    if (isWeekend) {
      // C-P = "-"
      for (let c = 3; c <= 16; c++) ws_r.getCell(c).value = '-';
      ws_r.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF3A3A3A' } }; });
    } else if (entry?.holiday) {
      ws_r.getCell(3).value = '-'; // C
      ws_r.getCell(4).value = entry.holiday; // D — holiday name
      for (let c = 5; c <= 16; c++) ws_r.getCell(c).value = '-';
      ws_r.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF78350F' } }; });
    } else if (entry && !entry.holiday) {
      // workday with data
      const { time, m10, m11, m12, m20, m21, m22, m31, m32, m60, m61 } = entry;
      ws_r.getCell(3).value = time || '';  // C
      ws_r.getCell(4).value = m10 ?? '';   // D
      // E: Q'TY
      const qtyE = prevD != null && m10 != null ? +(m10 - prevD).toFixed(3) : '-';
      ws_r.getCell(5).value = qtyE;
      ws_r.getCell(6).value = m11 ?? '';   // F
      const qtyG = prevF != null && m11 != null ? +(m11 - prevF).toFixed(3) : '-';
      ws_r.getCell(7).value = qtyG;
      ws_r.getCell(8).value = m12 ?? '';   // H
      const qtyI = prevH != null && m12 != null ? +(m12 - prevH).toFixed(3) : '-';
      ws_r.getCell(9).value = qtyI;
      ws_r.getCell(10).value = m20 ?? ''; // J
      ws_r.getCell(11).value = m21 ?? ''; // K
      ws_r.getCell(12).value = m22 ?? ''; // L
      ws_r.getCell(13).value = m31 ?? ''; // M
      ws_r.getCell(14).value = m32 ?? ''; // N
      ws_r.getCell(15).value = m60 ?? ''; // O
      ws_r.getCell(16).value = m61 ?? ''; // P

      if (typeof qtyE === 'number') sumE += qtyE;
      if (typeof qtyG === 'number') sumG += qtyG;
      if (typeof qtyI === 'number') sumI += qtyI;

      prevD = m10 ?? prevD;
      prevF = m11 ?? prevF;
      prevH = m12 ?? prevH;
      lastEntry = entry;
    } else {
      // workday, no data yet — leave C-P empty
    }
  }

  // TOTAL row
  const totalRow = ws.getRow(6 + total + 1);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(5).value = +sumE.toFixed(3);
  totalRow.getCell(7).value = +sumG.toFixed(3);
  totalRow.getCell(9).value = +sumI.toFixed(3);

  return { totalE: +sumE.toFixed(3), totalG: +sumG.toFixed(3), totalI: +sumI.toFixed(3), lastEntry };
}

function generateSummarySheet(wb, year, monthsData) {
  const ws = wb.addWorksheet(`รวม-${String(year).slice(2)}`);

  // Simple header
  ws.mergeCells('A1:K1');
  const h = ws.getCell('A1');
  h.value = `SUMMARY ELECTRICAL MAIN METER กฟน. ปี ${+year + 543}`;
  h.font = { bold: true, size: 13 };
  h.alignment = { horizontal: 'center', vertical: 'middle' };

  const headers2 = ['เดือน','kWh Total','On Peak kWh','Off Peak kWh','Prev kWh','Prev On Peak','Prev Off Peak','Max Demand On','Max Demand Off','kVarh','kVar'];
  headers2.forEach((v, i) => {
    const c = ws.getRow(2).getCell(i + 1);
    c.value = v; c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  let sumB = 0, sumC = 0, sumD = 0;
  let dataRow = 3;

  for (let mo = 1; mo <= 12; mo++) {
    const ym = `${year}-${pad2(mo)}`;
    const info = monthsData[ym];
    const row = ws.getRow(dataRow++);
    row.getCell(1).value = thaiMonthYear(ym);
    if (info) {
      row.getCell(2).value = info.totalE;
      row.getCell(3).value = info.totalG;
      row.getCell(4).value = info.totalI;
      const le = info.lastEntry || {};
      row.getCell(5).value  = le.m20 ?? '';
      row.getCell(6).value  = le.m21 ?? '';
      row.getCell(7).value  = le.m22 ?? '';
      row.getCell(8).value  = le.m31 ?? '';
      row.getCell(9).value  = le.m32 ?? '';
      row.getCell(10).value = le.m60 ?? '';
      row.getCell(11).value = le.m61 ?? '';
      sumB += info.totalE || 0;
      sumC += info.totalG || 0;
      sumD += info.totalI || 0;
    }
  }

  const tot = ws.getRow(dataRow);
  tot.getCell(1).value = 'TOTAL'; tot.getCell(1).font = { bold: true };
  tot.getCell(2).value = +sumB.toFixed(3);
  tot.getCell(3).value = +sumC.toFixed(3);
  tot.getCell(4).value = +sumD.toFixed(3);
}

async function generateMeterReport(yearMonth, monthData) {
  const wb = new ExcelJS.Workbook();
  generateMonthSheet(wb, yearMonth, yearMonth, monthData);
  return wb.xlsx.writeBuffer();
}

async function generateMeterYearReport(year, allMonthsData) {
  const wb = new ExcelJS.Workbook();
  const summaryData = {};
  for (let mo = 1; mo <= 12; mo++) {
    const ym = `${year}-${pad2(mo)}`;
    if (allMonthsData[ym]) {
      const info = generateMonthSheet(wb, THAI_MONTHS[mo-1], ym, allMonthsData[ym]);
      summaryData[ym] = info;
    }
  }
  generateSummarySheet(wb, year, summaryData);
  return wb.xlsx.writeBuffer();
}

module.exports = { generateMonthSheet, generateSummarySheet, generateMeterReport, generateMeterYearReport };
