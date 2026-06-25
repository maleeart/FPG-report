/**
 * excelExporter.js v3
 *
 * Strategy: 
 * 1. โหลด template → scan หา yellow cells (FFFFFF00) ทั้งหมด → clear เป็นขาวก่อน
 * 2. เขียนค่าลงเซลล์ที่ถูกต้อง
 * 3. วิธีนี้การันตีว่าไม่มีเหลืองเหลือ ไม่ว่าจะกรอกหรือไม่กรอก
 */

const ExcelJS = require('exceljs');
const path = require('path');

const fieldMap = require('../../src/data/field-map.json');

const WHITE_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFFF' },
  bgColor: { argb: 'FFFFFFFF' },
};

/** Clear ทุก yellow cell ใน worksheet (scan ทั้ง sheet รวม empty cells) */
function clearAllYellow(ws) {
  let count = 0;
  // ใช้ dimensions เพื่อ scan ทุก cell รวมที่ไม่มี value (yellow fill ไม่มีค่า)
  const dim = ws.dimensions;
  if (!dim) return 0;
  const maxRow = dim.bottom || 200;
  const maxCol = dim.right || 150;
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      try {
        const cell = ws.getCell(r, c);
        const fg = cell.fill?.fgColor;
        if (fg && (fg.argb === 'FFFFFF00' || fg.rgb === 'FFFFFF00')) {
          cell.fill = WHITE_FILL;
          count++;
        }
      } catch {}
    }
  }
  return count;
}

/** Clear yellow ในทุก sheet ของ workbook (เรียกครั้งเดียวตอนเริ่ม) */
function clearAllYellowAllSheets(wb) {
  let total = 0;
  wb.eachSheet((ws) => {
    total += clearAllYellow(ws);
  });
  return total;
}

/** ตั้ง fitToPage ทุก sheet ใน workbook + reset scale เพื่อไม่ให้ template override */
function applyFitToPageAllSheets(wb) {
  wb.eachSheet((ws) => {
    ws.pageSetup.fitToPage   = true;
    ws.pageSetup.fitToWidth  = 1;
    ws.pageSetup.fitToHeight = 0;
    ws.pageSetup.scale       = 100;
  });
}

/** เขียนค่าลง cell (ถ้าค่าว่างก็ข้าม — yellow ถูก clear แล้วในขั้นตอนก่อน) */
function setCell(ws, cellRef, value) {
  if (value === null || value === undefined || value === '') return;
  try {
    ws.getCell(cellRef).value = value;
  } catch (e) {
    console.warn(`setCell ${cellRef}:`, e.message);
  }
}

/** เขียน X ลง checklist cell */
function markCell(ws, col, row, mark) {
  if (!mark) return;
  try {
    ws.getCell(`${col}${row}`).value = mark;
  } catch {}
}

/** แปลง column number (1-based) → Excel letter (1=A, 26=Z, 27=AA, 42=AP …) */
function colNumToLetter(col) {
  let result = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    col = Math.floor((col - 1) / 26);
  }
  return result;
}

function numVal(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? String(v) : n;
}

async function writeMachineData(wb, data) {
  const machine = fieldMap.machines.find(m => m.id === data.machineId);
  if (!machine) throw new Error(`ไม่พบเครื่อง: ${data.machineId}`);

  const isGen = machine.type === 'generator';
  const tmpl = isGen ? fieldMap.generator_template : fieldMap.fire_pump_template;
  const vf = tmpl.sheet_visual_fields;    // sheet_visual
  const df = tmpl.sheet_data_fields;      // sheet_data

  const ws1 = wb.getWorksheet(machine.sheet_visual);
  const ws2 = wb.getWorksheet(machine.sheet_data);
  if (!ws1) throw new Error(`ไม่พบ sheet: ${machine.sheet_visual}`);
  if (!ws2) throw new Error(`ไม่พบ sheet: ${machine.sheet_data}`);

  // ── เขียนค่า (yellow ถูก clear ไปแล้วทุก sheet ก่อนหน้านี้) ──────────────
  const g = data.generalData || {};
  const afterRun = data.afterRun || {};

  // Header (sheet1)
  setCell(ws1, vf.fuel_before,       numVal(g.fuelBefore));
  setCell(ws1, vf.fuel_after,        numVal(afterRun.fuelAfter));
  setCell(ws1, vf.run_duration_mins, numVal(g.runDurationMins));
  setCell(ws1, vf.hours_before,      numVal(g.runningHoursBefore));
  setCell(ws1, vf.hours_after,       numVal(afterRun.runningHoursAfter));
  if (isGen && vf.run_count) setCell(ws1, vf.run_count, numVal(g.runCount));

  // Pre-Visual Checklist (sheet1) - 2way: pass=CR / fail=DA
  const pvc = vf.checklist_0_pass_col;
  const pfc = vf.checklist_0_fail_col;
  const preVisual = data.preVisual || [];
  (vf.checklist_0_items || []).forEach((item, idx) => {
    const v = preVisual[idx];
    if (!v) return;
    if (v.result === 'pass') markCell(ws1, pvc, item.row, 'X');
    else if (v.result === 'fail') markCell(ws1, pfc, item.row, 'X');
    if (v.note) setCell(ws1, `${vf.checklist_0_note_col || 'DJ'}${item.row}`, v.note);
  });

  // Pre-Run Checklist (sheet2) - 3way: normal=BI / abnormal=BR / na=CA
  const preRun = data.preRunVisual || [];
  (df.checklist_1_items || []).forEach((item, idx) => {
    const v = preRun[idx];
    if (!v) return;
    if (v.result === 'normal')    markCell(ws2, df.checklist_1_normal_col,   item.row, 'X');
    if (v.result === 'abnormal')  markCell(ws2, df.checklist_1_abnormal_col, item.row, 'X');
    if (v.result === 'na')        markCell(ws2, df.checklist_1_na_col,       item.row, 'X');
    if (v.note) setCell(ws2, `${df.checklist_1_note_col || 'CJ'}${item.row}`, v.note);
  });

  // Readings (sheet2)
  const r = data.readings || {};
  if (!isGen) {
    setCell(ws2, df.water_pressure_cell,   numVal(r.waterPressure));
    setCell(ws2, df.battery1_voltage_cell, numVal(r.battery1Voltage));
    setCell(ws2, df.battery2_voltage_cell, numVal(r.battery2Voltage));
    const jp = r.jockeyPump || {};
    setCell(ws2, df.jockey_voltage_L1L2,   numVal(jp.voltageL1L2));
    setCell(ws2, df.jockey_voltage_L2L3,   numVal(jp.voltageL2L3));
    setCell(ws2, df.jockey_voltage_L1L3,   numVal(jp.voltageL1L3));
    setCell(ws2, df.jockey_current_L1,     numVal(jp.currentL1));
    setCell(ws2, df.jockey_current_L2,     numVal(jp.currentL2));
    setCell(ws2, df.jockey_current_L3,     numVal(jp.currentL3));
  } else {
    setCell(ws2, df.battery_voltage_cell,  numVal(r.batteryVoltage));
    const el = r.electrical || {};
    setCell(ws2, df.elec_offload_L1N,   numVal(el.offload_L1N));
    setCell(ws2, df.elec_offload_L2N,   numVal(el.offload_L2N));
    setCell(ws2, df.elec_offload_L3N,   numVal(el.offload_L3N));
    setCell(ws2, df.elec_offload_L1L2,  numVal(el.offload_L1L2));
    setCell(ws2, df.elec_offload_L2L3,  numVal(el.offload_L2L3));
    setCell(ws2, df.elec_offload_L1L3,  numVal(el.offload_L1L3));
    setCell(ws2, df.elec_current_L1,    numVal(el.current_L1));
    setCell(ws2, df.elec_current_L2,    numVal(el.current_L2));
    setCell(ws2, df.elec_current_L3,    numVal(el.current_L3));
  }

  // Test-Run (sheet2)
  const t = data.testRun || {};
  setCell(ws2, df.rpm_cell,              numVal(t.rpm));
  setCell(ws2, df.oil_pressure_cell,     numVal(t.oilPressure));
  setCell(ws2, df.coolant_temp_cell,     numVal(t.coolantTemp));
  setCell(ws2, df.fuel_consumption_cell, numVal(t.fuelConsumption));
  if (!isGen) {
    setCell(ws2, df.cooling_pressure_cell, numVal(t.coolingPressure));
    setCell(ws2, df.system_pressure_cell,  numVal(t.systemPressure));
  } else {
    setCell(ws2, df.charge_voltage_cell, numVal(t.chargeVoltage));
    setCell(ws2, df.frequency_cell,      numVal(t.frequency));
    setCell(ws2, df.system_pressure_cell, numVal(t.systemPressure));
  }

  // After-Run: Anothers (sheet2)
  const remarks = (afterRun.comment || '').split('\n');
  (df.anothers_rows || []).forEach((row, idx) => {
    if (remarks[idx]) setCell(ws2, `${df.anothers_col}${row}`, remarks[idx]);
  });

  // Conclusion (sheet2)
  const conclusionText = (afterRun.conclusionText && afterRun.conclusionText.trim())
    ? afterRun.conclusionText
    : (df.conclusion_default || []).join('\n');
  const conclusionLines = conclusionText.split('\n');
  (df.conclusion_rows || []).forEach((row, idx) => {
    setCell(ws2, `${df.conclusion_col}${row}`, conclusionLines[idx] || '');
  });

  // วันที่บันทึก → ใช้วันที่กรอกข้อมูล (inspectionDate) ไม่ใช่วันนี้
  const inspDate = data.inspectionDate ? new Date(data.inspectionDate) : new Date();
  // df.inspected_by_date / approved_by_date = เซลล์วันที่จริงใน template (AP107 / CY107)
  setCell(ws2, df.inspected_by_date, inspDate);
  setCell(ws2, df.approved_by_date,  inspDate);
  // ชื่อผู้อนุมัติ: ใช้ค่า default ใน template (ตวงเพชร) → ไม่ต้องเขียนทับ

  // ลายเซ็นผู้ตรวจสอบ: ใช้ภาพถ้ามี, ไม่มีให้พิมพ์ชื่อที่ตำแหน่งลายเซ็น
  if (df.signature_inspector) {
    const sig = df.signature_inspector;
    if (afterRun.inspectorSignature) {
      try {
        const base64 = afterRun.inspectorSignature.replace(/^data:image\/\w+;base64,/, '');
        const imgId = wb.addImage({ base64, extension: 'png' });
        ws2.addImage(imgId, {
          tl: { col: sig.col - 1, row: sig.row - 1 },
          br: { col: sig.col2 - 1, row: sig.row2 - 1 },
          editAs: 'twoCell',
        });
      } catch (e) { console.warn('signature image error:', e.message); }
    } else if (afterRun.inspectedBy) {
      // ไม่มีลายเซ็น → พิมพ์ชื่อเป็นตัวหนังสือที่แถว sig.row (บนของ sig area)
      const nameCell = `${colNumToLetter(sig.col)}${sig.row}`;
      setCell(ws2, nameCell, afterRun.inspectedBy);
    }
  }
}

async function generateExcelReport(data, templatePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const cleared = clearAllYellowAllSheets(wb);
  console.log(`cleared ${cleared} yellow cells across all sheets`);
  applyFitToPageAllSheets(wb);
  await writeMachineData(wb, data);
  return wb.xlsx.writeBuffer();
}

async function generateCombinedReport(records, templatePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const cleared = clearAllYellowAllSheets(wb);
  console.log(`cleared ${cleared} yellow cells across all sheets`);
  applyFitToPageAllSheets(wb);
  for (const [machineId, data] of Object.entries(records)) {
    if (!data) continue;
    try {
      await writeMachineData(wb, { ...data, machineId });
    } catch (e) {
      console.error(`generateCombinedReport ${machineId}:`, e.message);
    }
  }
  return wb.xlsx.writeBuffer();
}

module.exports = { generateExcelReport, generateCombinedReport };
