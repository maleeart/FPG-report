const ExcelJS = require('exceljs');
const path = require('path');

const TEMPLATE_FILES = {
  emergency: 'Emergency light.xlsx',
  smoke:     'Smoke detector.xlsx',
};
const SHEET_NAMES = {
  emergency: 'Emer1-2',
  smoke:     'Smoke 1-2',
};

async function generateListReport(type, data) {
  const tplFile = TEMPLATE_FILES[type];
  if (!tplFile) throw new Error(`ไม่รู้จัก type: ${type}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), 'templates', tplFile));

  const ws = wb.getWorksheet(SHEET_NAMES[type]);
  if (!ws) throw new Error(`ไม่พบ sheet: ${SHEET_NAMES[type]}`);

  const g = data.general || {};
  ws.getCell('F6').value = g.inspectionDate || data.date || '';
  ws.getCell('B7').value = g.building  || '';
  ws.getCell('D7').value = g.floor     || '';
  ws.getCell('F7').value = g.inspector || '';
  ws.getCell('B8').value = g.model     || '';
  ws.getCell('D8').value = g.serial    || '';
  ws.getCell('F8').value = g.mfg       || '';

  (data.devices || []).forEach((dev, i) => {
    const row = 10 + i;
    if (row > 39) return;
    if (type === 'emergency') {
      ws.getCell(`A${row}`).value = dev.id       || '';
      ws.getCell(`B${row}`).value = dev.location || '';
      ws.getCell(`C${row}`).value = dev.lightCondition  === 'pass'        ? 'ผ่าน'       : dev.lightCondition  === 'fail'        ? 'ไม่ผ่าน'    : '';
      ws.getCell(`D${row}`).value = dev.statusLight     === 'normal'      ? 'ปกติ'       : dev.statusLight     === 'abnormal'    ? 'ผิดปกติ'    : '';
      ws.getCell(`E${row}`).value = dev.testResult      === 'on'          ? 'ติด'        : dev.testResult      === 'off'         ? 'ดับ'        : '';
      if (dev.remarks) ws.getCell(`F${row}`).value = dev.remarks;
    } else {
      ws.getCell(`A${row}`).value = dev.zone     || '';
      ws.getCell(`B${row}`).value = dev.location || '';
      ws.getCell(`C${row}`).value = dev.externalCondition === 'normal'    ? 'ปกติ'       : dev.externalCondition === 'dirty'      ? 'สกปรก'     : '';
      ws.getCell(`D${row}`).value = dev.cleaned  === 'yes'                ? '✓'          : '';
      ws.getCell(`E${row}`).value = dev.workingCondition  === 'normal'    ? 'ปกติ'       : dev.workingCondition  === 'not_working'? 'ไม่ทำงาน'  : '';
      if (dev.remarks) ws.getCell(`F${row}`).value = dev.remarks;
    }
  });

  return wb.xlsx.writeBuffer();
}

module.exports = { generateListReport };
