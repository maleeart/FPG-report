const ExcelJS = require('exceljs');

const THAI_DAYS  = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const FONT_NAME = 'TH Sarabun New';

const BORDER_THIN = { style: 'thin' };
const ALL_BORDERS = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };

const COL_BLUE = { argb: 'FF0000CC' };
const COL_RED  = { argb: 'FFFF0000' };

function thaiMonthYear(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Apply font + no-wrap + border to every cell in a row */
function styleRow(row, numCols) {
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.font = { ...(cell.font || {}), name: FONT_NAME };
    cell.alignment = { ...(cell.alignment || {}), wrapText: false };
    cell.border = ALL_BORDERS;
  }
}

/** Build header rows 1-6 for a monthly sheet — matches original Excel exactly */
function buildMonthHeaders(ws, yearMonth) {
  const bold = { bold: true, name: FONT_NAME };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: false };
  const left   = { horizontal: 'left',   vertical: 'middle', wrapText: false };

  // Row 1: A1:P1 — title
  ws.mergeCells('A1:P1');
  Object.assign(ws.getCell('A1'), {
    value: 'DAILY CHECK ELECTRICAL MAIN METER TPDL',
    font: { bold: true, size: 14, name: FONT_NAME },
    alignment: center,
  });

  // Row 2: A2:N2 — meter info | O2:P2 — month/year
  ws.mergeCells('A2:N2');
  Object.assign(ws.getCell('A2'), {
    value: '                                                ELSTER - KWH & KVAH  MEA  No.   MEA-140005423            ประเภท TOU 4.2.2',
    font: { name: FONT_NAME },
    alignment: left,
  });
  ws.mergeCells('O2:P2');
  Object.assign(ws.getCell('O2'), {
    value: thaiMonthYear(yearMonth),
    font: bold,
    alignment: center,
  });

  // Row 3-6: A3:B6 merged = "Date" col, C3:C6 = "Time"
  ws.mergeCells('A3:B6');
  Object.assign(ws.getCell('A3'), { value: 'Date', font: bold, alignment: center });
  ws.mergeCells('C3:C6');
  Object.assign(ws.getCell('C3'), { value: 'Time', font: bold, alignment: center });

  // Row 3: group headers
  ws.mergeCells('D3:I3');
  Object.assign(ws.getCell('D3'), { value: 'Electrical Consumption ( X 1,000 )', font: bold, alignment: center });
  ws.mergeCells('J3:L3');
  Object.assign(ws.getCell('J3'), { value: 'Previous Electrical Consumption', font: bold, alignment: center });
  ws.mergeCells('M3:N3');
  Object.assign(ws.getCell('M3'), { value: 'Maximun Demand', font: bold, alignment: center });
  ws.mergeCells('O3:P3');
  Object.assign(ws.getCell('O3'), { value: 'Power  Reactive', font: bold, alignment: center });

  // Row 4: sub-group headers
  ws.mergeCells('D4:E4');
  Object.assign(ws.getCell('D4'), { value: 'kWh', font: bold, alignment: center });
  ws.mergeCells('F4:G4');
  Object.assign(ws.getCell('F4'), { value: ' On Peak (9:00-22:00) kWh', font: bold, alignment: center });
  ws.mergeCells('H4:I4');
  Object.assign(ws.getCell('H4'), { value: ' Off Peak (22:00-9:00) kWh', font: bold, alignment: center });
  ws.mergeCells('J4:J5'); Object.assign(ws.getCell('J4'), { value: 'KWh',      font: bold, alignment: center });
  ws.mergeCells('K4:K5'); Object.assign(ws.getCell('K4'), { value: 'On Peak',  font: bold, alignment: center });
  ws.mergeCells('L4:L5'); Object.assign(ws.getCell('L4'), { value: 'Off Peak', font: bold, alignment: center });
  ws.mergeCells('M4:N4');
  Object.assign(ws.getCell('M4'), { value: 'kW', font: bold, alignment: center });
  ws.mergeCells('O4:O5'); Object.assign(ws.getCell('O4'), { value: 'kVarh', font: bold, alignment: center });
  ws.mergeCells('P4:P5'); Object.assign(ws.getCell('P4'), { value: 'kVar',  font: bold, alignment: center });

  // Row 5: Data / Q'TY/Day + Maximum Demand sub
  for (const [col, val] of [['D','Data'],['E',"Q'TY / Day"],['F','Data'],['G',"Q'TY / Day"],['H','Data'],['I',"Q'TY / Day"]]) {
    Object.assign(ws.getCell(`${col}5`), { value: val, font: bold, alignment: center });
  }
  Object.assign(ws.getCell('M5'), { value: 'On Peak',  font: bold, alignment: center });
  Object.assign(ws.getCell('N5'), { value: 'Off Peak', font: bold, alignment: center });

  // Row 6: meter numbers — D6:E6, F6:G6, H6:I6 merged (matching original)
  ws.mergeCells('D6:E6'); Object.assign(ws.getCell('D6'), { value: 10, font: bold, alignment: center });
  ws.mergeCells('F6:G6'); Object.assign(ws.getCell('F6'), { value: 11, font: bold, alignment: center });
  ws.mergeCells('H6:I6'); Object.assign(ws.getCell('H6'), { value: 12, font: bold, alignment: center });
  for (const [col, val] of [['J',20],['K',21],['L',22],['M',31],['N',32],['O',60],['P',61]]) {
    Object.assign(ws.getCell(`${col}6`), { value: val, font: bold, alignment: center });
  }

  // Apply border + font to header rows 1-6
  for (let r = 1; r <= 6; r++) styleRow(ws.getRow(r), 16);
}

function generateMonthSheet(wb, sheetName, yearMonth, monthData) {
  const ws = wb.addWorksheet(sheetName);
  buildMonthHeaders(ws, yearMonth);

  const days = monthData?.days || {};
  const total = daysInMonth(yearMonth);
  const [y, m] = yearMonth.split('-').map(Number);

  let prevD = null, prevF = null, prevH = null;
  let sumE = 0, sumG = 0, sumI = 0;
  let lastEntry = null;

  for (let d = 1; d <= total; d++) {
    const dayStr = pad2(d);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay();
    const rowIdx = 6 + d;
    const ws_r = ws.getRow(rowIdx);

    ws_r.getCell(1).value = THAI_DAYS[dow]; // A
    ws_r.getCell(2).value = d;              // B

    const isWeekend = dow === 0 || dow === 6;
    const entry = days[dayStr];

    if (isWeekend) {
      for (let c = 3; c <= 16; c++) ws_r.getCell(c).value = '-';
      styleRow(ws_r, 16);
      // cols E(5)→O(15): blue font (matches original)
      for (let c = 5; c <= 15; c++) ws_r.getCell(c).font = { name: FONT_NAME, color: COL_BLUE };

    } else if (entry?.holiday) {
      ws.mergeCells(`C${rowIdx}:P${rowIdx}`);
      ws_r.getCell(3).value = entry.holiday;
      ws_r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      styleRow(ws_r, 16);
      ws_r.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; });
      ws_r.getCell(3).font = { name: FONT_NAME, bold: true, color: { argb: 'FF7F6000' } };

    } else if (entry && !entry.holiday) {
      const { time, m10, m11, m12, m20, m21, m22, m31, m32, m60, m61 } = entry;
      ws_r.getCell(3).value  = time || '';
      ws_r.getCell(4).value  = m10 ?? '';
      const qtyE = prevD != null && m10 != null ? +(m10 - prevD).toFixed(3) : '-';
      ws_r.getCell(5).value  = qtyE;
      ws_r.getCell(6).value  = m11 ?? '';
      const qtyG = prevF != null && m11 != null ? +(m11 - prevF).toFixed(3) : '-';
      ws_r.getCell(7).value  = qtyG;
      ws_r.getCell(8).value  = m12 ?? '';
      const qtyI = prevH != null && m12 != null ? +(m12 - prevH).toFixed(3) : '-';
      ws_r.getCell(9).value  = qtyI;
      ws_r.getCell(10).value = m20 ?? '';
      ws_r.getCell(11).value = m21 ?? '';
      ws_r.getCell(12).value = m22 ?? '';
      ws_r.getCell(13).value = m31 ?? '';
      ws_r.getCell(14).value = m32 ?? '';
      ws_r.getCell(15).value = m60 ?? '';
      ws_r.getCell(16).value = m61 ?? '';
      styleRow(ws_r, 16);
      // Q'TY/Day colors: E=blue, G=red, I=red (matches original)
      ws_r.getCell(5).font  = { name: FONT_NAME, color: COL_BLUE };
      ws_r.getCell(7).font  = { name: FONT_NAME, color: COL_RED };
      ws_r.getCell(9).font  = { name: FONT_NAME, color: COL_RED };

      if (typeof qtyE === 'number') sumE += qtyE;
      if (typeof qtyG === 'number') sumG += qtyG;
      if (typeof qtyI === 'number') sumI += qtyI;

      prevD = m10 ?? prevD;
      prevF = m11 ?? prevF;
      prevH = m12 ?? prevH;
      lastEntry = entry;
    } else {
      styleRow(ws_r, 16);
    }
  }

  // TOTAL row
  const totalRow = ws.getRow(6 + total + 1);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(5).value = +sumE.toFixed(3);
  totalRow.getCell(7).value = +sumG.toFixed(3);
  totalRow.getCell(9).value = +sumI.toFixed(3);
  styleRow(totalRow, 16);
  totalRow.getCell(1).font = { bold: true, name: FONT_NAME };

  return { totalE: +sumE.toFixed(3), totalG: +sumG.toFixed(3), totalI: +sumI.toFixed(3), lastEntry };
}

function generateSummarySheet(wb, year, monthsData) {
  const ws = wb.addWorksheet(`รวม-${String(year).slice(2)}`);
  const bold   = { bold: true, name: FONT_NAME };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: false };
  const left   = { horizontal: 'left',   vertical: 'middle', wrapText: false };

  // Row 1: A1:K1
  ws.mergeCells('A1:K1');
  Object.assign(ws.getCell('A1'), {
    value: 'DAILY CHECK ELECTRICAL MAIN METER TPDL',
    font: { bold: true, size: 14, name: FONT_NAME },
    alignment: center,
  });

  // Row 2: A2:I2 + J2:K2
  ws.mergeCells('A2:I2');
  Object.assign(ws.getCell('A2'), {
    value: '                                                ELSTER - KWH & KVAH  MEA  No.   MEA-140005423            ประเภท TOU 4.2.2',
    font: { name: FONT_NAME },
    alignment: left,
  });
  ws.mergeCells('J2:K2');
  Object.assign(ws.getCell('J2'), {
    value: thaiMonthYear(`${year}-01`) + ` - ` + thaiMonthYear(`${year}-12`),
    font: { ...bold, color: COL_BLUE },
    alignment: center,
  });

  // Row 3-6: A3:A6 = "Date"
  ws.mergeCells('A3:A6');
  Object.assign(ws.getCell('A3'), { value: 'Date', font: bold, alignment: center });

  // Row 3: group headers
  ws.mergeCells('B3:D3');
  Object.assign(ws.getCell('B3'), { value: 'Electrical Consumption ( X 1,000 )', font: bold, alignment: center });
  ws.mergeCells('E3:G3');
  Object.assign(ws.getCell('E3'), { value: 'Previous Electrical Consumption', font: bold, alignment: center });
  ws.mergeCells('H3:I3');
  Object.assign(ws.getCell('H3'), { value: 'Maximun Demand', font: bold, alignment: center });
  ws.mergeCells('J3:K3');
  Object.assign(ws.getCell('J3'), { value: 'Power  Reactive', font: bold, alignment: center });

  // Row 4
  Object.assign(ws.getCell('B4'), { value: 'kWh',                     font: bold, alignment: center });
  Object.assign(ws.getCell('C4'), { value: ' On Peak (kWh)',           font: bold, alignment: center });
  Object.assign(ws.getCell('D4'), { value: ' Off Peak (kWh)',          font: bold, alignment: center });
  ws.mergeCells('E4:E5'); Object.assign(ws.getCell('E4'), { value: 'KWh',      font: bold, alignment: center });
  ws.mergeCells('F4:F5'); Object.assign(ws.getCell('F4'), { value: 'On Peak',  font: bold, alignment: center });
  ws.mergeCells('G4:G5'); Object.assign(ws.getCell('G4'), { value: 'Off Peak', font: bold, alignment: center });
  ws.mergeCells('H4:I4');
  Object.assign(ws.getCell('H4'), { value: 'kW', font: bold, alignment: center });
  ws.mergeCells('J4:J5'); Object.assign(ws.getCell('J4'), { value: 'kVarh', font: bold, alignment: center });
  ws.mergeCells('K4:K5'); Object.assign(ws.getCell('K4'), { value: 'kVar',  font: bold, alignment: center });

  // Row 5
  Object.assign(ws.getCell('B5'), { value: "Q'TY / Day", font: bold, alignment: center });
  Object.assign(ws.getCell('C5'), { value: "Q'TY / Day", font: bold, alignment: center });
  Object.assign(ws.getCell('D5'), { value: "Q'TY / Day", font: bold, alignment: center });
  Object.assign(ws.getCell('H5'), { value: 'On Peak',    font: bold, alignment: center });
  Object.assign(ws.getCell('I5'), { value: 'Off Peak',   font: bold, alignment: center });

  // Row 6: meter codes
  for (const [col, val] of [['B',10],['C',11],['D',12],['E',20],['F',21],['G',22],['H',31],['I',32],['J',60],['K',61]]) {
    Object.assign(ws.getCell(`${col}6`), { value: val, font: bold, alignment: center });
  }

  // style header rows
  for (let r = 1; r <= 6; r++) styleRow(ws.getRow(r), 11);

  // Data rows: one per month
  let sumB = 0, sumC = 0, sumD = 0;
  let dataRow = 7;

  for (let mo = 1; mo <= 12; mo++) {
    const ym = `${year}-${pad2(mo)}`;
    const info = monthsData[ym];
    const row = ws.getRow(dataRow++);
    row.getCell(1).value = thaiMonthYear(ym);
    if (info) {
      row.getCell(2).value  = info.totalE;
      row.getCell(3).value  = info.totalG;
      row.getCell(4).value  = info.totalI;
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
    styleRow(row, 11);
    // Q'TY columns B,C,D: blue, red, red
    row.getCell(2).font = { name: FONT_NAME, color: COL_BLUE };
    row.getCell(3).font = { name: FONT_NAME, color: COL_RED };
    row.getCell(4).font = { name: FONT_NAME, color: COL_RED };
  }

  const tot = ws.getRow(dataRow);
  tot.getCell(1).value = 'TOTAL'; tot.getCell(1).font = bold;
  tot.getCell(2).value = +sumB.toFixed(3); tot.getCell(2).font = { name: FONT_NAME, bold: true, color: COL_BLUE };
  tot.getCell(3).value = +sumC.toFixed(3); tot.getCell(3).font = { name: FONT_NAME, bold: true, color: COL_RED };
  tot.getCell(4).value = +sumD.toFixed(3); tot.getCell(4).font = { name: FONT_NAME, bold: true, color: COL_RED };
  styleRow(tot, 11);
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
