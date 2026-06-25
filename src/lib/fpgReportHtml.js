import fieldMap from '../data/field-map.json';

const v = (val, fallback = '–') =>
  (val === undefined || val === null || val === '') ? fallback : String(val);

const passBox = r => r === 'pass'     ? '☑' : '☐';
const failBox = r => r === 'fail'     ? '☑' : '☐';
const normBox = r => r === 'normal'   ? '☑' : '☐';
const abnBox  = r => r === 'abnormal' ? '☑' : '☐';
const noneBox = r => r === 'none'     ? '☑' : '☐';

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'TH SarabunPSK','Sarabun','Angsana New',sans-serif;
  font-size: 13px; color: #000; background: #fff;
}
.page {
  width: 210mm; min-height: 297mm;
  padding: 10mm 12mm;
  page-break-after: always;
}
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; font-size: 13px; }
.nb { border: none !important; }
.chk { text-align: center; width: 36px; font-size: 16px; }
.sec {
  background: #c6efce; font-weight: bold;
  padding: 3px 6px; border: 1px solid #000;
  margin: 6px 0 0;
}
.sub { background: #f2f2f2; font-weight: bold; padding: 2px 5px; border: 1px solid #000; border-top: none; }
.thead-row { background: #f2f2f2; }
@page { size: A4 portrait; margin: 0; }
@media print { .page { padding: 10mm 12mm; } }
`;

function header(machineInfo, data, logoB64, sheet) {
  const title = machineInfo?.type === 'fire_pump'
    ? 'INSPECTION REPORT OF FIRE PUMP'
    : 'INSPECTION REPORT OF GENERATOR';
  const logo = logoB64
    ? `<img src="data:image/jpeg;base64,${logoB64}" style="height:52px">`
    : '';
  return `
<table style="margin-bottom:8px">
  <tr>
    <td class="nb" style="width:110px">${logo}</td>
    <td class="nb" style="text-align:center">
      <div>Electricity Generating Authority of Thailand</div>
      <div>การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย</div>
      <div style="font-size:16px;font-weight:bold">${title}</div>
      <div>สำนักงาน ไทรน้อย</div>
    </td>
    <td class="nb" style="text-align:right;vertical-align:top;white-space:nowrap">${sheet}</td>
  </tr>
</table>`;
}

function generalDatas(machineInfo, data) {
  const g  = data.generalData || {};
  const a  = data.afterRun    || {};
  const fp = machineInfo?.type === 'fire_pump';
  return `
<table style="margin-bottom:6px">
  <tr>
    <td colspan="8" style="font-weight:bold;background:#dce6f1">General Datas</td>
  </tr>
  <tr>
    <td style="width:100px;font-weight:bold">Location</td>
    <td colspan="2">${v(machineInfo?.location_default)}</td>
    <td style="font-weight:bold">ชนิด</td>
    <td>${fp ? 'Vertical' : 'Standby'}</td>
    <td style="font-weight:bold">Station No.</td>
    <td colspan="2">${machineInfo?.label || ''}</td>
  </tr>
  <tr>
    <td style="font-weight:bold">Model</td>
    <td>${v(machineInfo?.model_default)}</td>
    <td style="font-weight:bold">Serial-Number</td>
    <td colspan="2">${v(machineInfo?.serial_default)}</td>
    <td style="font-weight:bold">MFG</td>
    <td>${v(machineInfo?.mfg_default)}</td>
    <td>${v(machineInfo?.rpm_rating_default)} RPM</td>
  </tr>
  <tr>
    <td style="font-weight:bold">Fuel Level</td>
    <td colspan="3">Before: ${v(g.fuelBefore)} L &nbsp;/&nbsp; After: ${v(a.fuelAfter)} L</td>
    <td style="font-weight:bold">ชั่วโมงทำงาน</td>
    <td colspan="3">Before: ${v(g.runningHoursBefore)} / After: ${v(a.runningHoursAfter)} Hrs.</td>
  </tr>
  <tr>
    <td style="font-weight:bold">ระยะเวลาทดสอบ</td>
    <td colspan="3">${v(g.runDurationMins)} นาที${fp ? '' : ' &nbsp; | &nbsp; จำนวนครั้ง: ' + v(g.runCount) + ' ครั้ง'}</td>
    <td style="font-weight:bold">วันที่ตรวจสอบ</td>
    <td colspan="3">${data.inspectionDate || ''}</td>
  </tr>
</table>`;
}

function checklist0(items, results) {
  let rows = '';
  items.forEach((item, i) => {
    const r = results[i] || {};
    rows += `<tr>
      <td style="text-align:center;width:28px">${i + 1}</td>
      <td>${item.text}</td>
      <td class="chk">${passBox(r.result)}</td>
      <td class="chk">${failBox(r.result)}</td>
      <td>${r.remark || ''}</td>
    </tr>`;
  });
  return `
<div class="sec">0.Pre Visual Inspection</div>
<table>
  <thead>
    <tr class="thead-row">
      <th colspan="2" style="text-align:center">รายการตรวจสอบ</th>
      <th class="chk">ผ่าน</th>
      <th class="chk">ไม่ผ่าน</th>
      <th>หมายเหตุ</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function checklist1(items, results) {
  let rows = '';
  items.forEach((item, i) => {
    const r = results[i] || {};
    rows += `<tr>
      <td style="text-align:center;width:28px">${i + 1}</td>
      <td>${item.text}</td>
      <td class="chk">${normBox(r.result)}</td>
      <td class="chk">${abnBox(r.result)}</td>
      <td class="chk">${noneBox(r.result)}</td>
      <td>${r.remark || ''}</td>
    </tr>`;
  });
  return `
<div class="sec">1.Pre-Run Visual Inspection</div>
<table>
  <thead>
    <tr class="thead-row">
      <th style="width:28px">#</th>
      <th>รายการตรวจสอบ</th>
      <th class="chk">ปกติ</th>
      <th class="chk">ผิดปกติ</th>
      <th class="chk">ไม่มี</th>
      <th>หมายเหตุ</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function measureRows(pairs) {
  let rows = '';
  pairs.forEach(([label, val]) => {
    rows += `<tr><td style="width:300px">${label}</td><td>${val}</td></tr>`;
  });
  return `<table>${rows}</table>`;
}

function sheet1(machineInfo, data, logoB64) {
  const isFp = machineInfo?.type === 'fire_pump';
  const tmpl = isFp ? fieldMap.firepump_template : fieldMap.generator_template;
  const items0 = tmpl?.sheet_visual_fields?.checklist_0_items || [];
  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 1/2')}
  ${generalDatas(machineInfo, data)}
  ${checklist0(items0, data.preVisual || [])}
</div>`;
}

function sheet2(machineInfo, data, logoB64, approverSigB64) {
  const isFp = machineInfo?.type === 'fire_pump';
  const tmpl = isFp ? fieldMap.firepump_template : fieldMap.generator_template;
  const items1 = tmpl?.sheet_data_fields?.checklist_1_items || [];
  const r = data.readings || {};
  const t = data.testRun  || {};
  const a = data.afterRun || {};

  const conclusion = (a.conclusionText?.trim())
    ? a.conclusionText
    : (tmpl?.sheet_data_fields?.conclusion_default || []).join('\n');

  const jp   = r.jockeyPump  || {};
  const elec = r.electrical  || {};

  const measuresFp = [
    ['ความดันน้ำในระบบก่อนเดินเครื่อง (Psi)', v(r.waterPressure)],
    ['แรงดันแบตเตอรี่ Battery #1 (Volt)', v(r.battery1Voltage)],
    ['แรงดันแบตเตอรี่ Battery #2 (Volt)', v(r.battery2Voltage)],
    ['แรงดัน Jockey Pump L1-L2 / L2-L3 / L1-L3 (V)',
      v(jp.voltageL1L2) + ' / ' + v(jp.voltageL2L3) + ' / ' + v(jp.voltageL1L3)],
    ['กระแส Jockey Pump L1 / L2 / L3 (A)',
      v(jp.currentL1) + ' / ' + v(jp.currentL2) + ' / ' + v(jp.currentL3)],
  ];
  const measuresGen = [
    ['แรงดันแบตเตอรี่ (Volt)', v(r.batteryVoltage)],
    ['ค่าแรงดัน Off Load L1-N / L2-N / L3-N (V)',
      v(elec.offload_L1N) + ' / ' + v(elec.offload_L2N) + ' / ' + v(elec.offload_L3N)],
    ['ค่าแรงดัน Off Load L1-L2 / L2-L3 / L1-L3 (V)',
      v(elec.offload_L1L2) + ' / ' + v(elec.offload_L2L3) + ' / ' + v(elec.offload_L1L3)],
  ];

  const testFp = [
    ['ความเร็วรอบ (RPM)', v(t.rpm)],
    ['แรงดันน้ำมันเครื่อง (Psi)', v(t.oilPressure)],
    ['อุณหภูมิน้ำหล่อเย็น (°C)', v(t.coolantTemp)],
    ['แรงดันน้ำระบายความร้อน (Psi)', v(t.coolingPressure)],
    ['แรงดันน้ำในระบบขณะเดิน (Psi)', v(t.systemPressure)],
    ['อัตราการใช้เชื้อเพลิง (Liters)', v(t.fuelConsumption)],
  ];
  const testGen = [
    ['ความเร็วรอบ (RPM)', v(t.rpm)],
    ['แรงดันน้ำมันเครื่อง (Psi)', v(t.oilPressure)],
    ['อุณหภูมิน้ำหล่อเย็น (°C)', v(t.coolantTemp)],
    ['แรงดันชาร์จแบตเตอรี่ (Volt)', v(t.chargeVoltage)],
    ['ความถี่ไฟฟ้า (Hz)', v(t.frequency)],
    ['แรงดันน้ำในระบบ (Psi)', v(t.systemPressure)],
    ['อัตราการใช้เชื้อเพลิง (Liters)', v(t.fuelConsumption)],
  ];

  const approverImg = approverSigB64
    ? `<img src="data:image/png;base64,${approverSigB64}" style="height:40px">`
    : '';

  const inspDate = data.inspectionDate || '–';

  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 2/2')}
  ${checklist1(items1, data.preRunVisual || [])}

  <div class="sec">2.ค่าที่บันทึกได้ก่อนเดินเครื่อง</div>
  ${measureRows(isFp ? measuresFp : measuresGen)}

  <div class="sec">3.ค่าที่บันทึกได้ขณะเดินเครื่อง (Test Run)</div>
  ${measureRows(isFp ? testFp : testGen)}

  <div class="sec">4.หมายเหตุ / ข้อสังเกต</div>
  <div style="border:1px solid #000;padding:6px;min-height:42px;white-space:pre-line">${a.comment || ''}</div>

  <div class="sec">5.สรุปผลการตรวจสอบ</div>
  <div style="border:1px solid #000;padding:6px;min-height:32px;white-space:pre-line;margin-bottom:16px">${conclusion}</div>

  <table style="margin-top:8px">
    <tr>
      <td class="nb" style="width:50%;text-align:center;padding-top:8px">
        <div style="border-top:1px solid #000;padding-top:4px">
          <div>ผู้ตรวจสอบ</div>
          <div style="font-weight:bold;margin:4px 0">${a.inspectedBy || '( ................................ )'}</div>
          <div>วันที่ ${inspDate}</div>
        </div>
      </td>
      <td class="nb" style="width:50%;text-align:center;padding-top:8px">
        <div style="border-top:1px solid #000;padding-top:4px">
          ${approverImg}
          <div>ผู้อนุมัติ</div>
          <div style="font-weight:bold;margin:4px 0">${a.approvedBy || '( ................................ )'}</div>
          <div>วันที่ ${inspDate}</div>
        </div>
      </td>
    </tr>
  </table>
</div>`;
}

/**
 * สร้าง HTML ครบทุกเครื่องในวันนั้น — records = { machineId: data, ... }
 */
export function generateFpgReportHtml(records, logoB64, approverSigB64) {
  const pages = [];
  for (const [machineId, data] of Object.entries(records)) {
    if (!data) continue;
    const machineInfo = (fieldMap.machines || []).find(m => m.id === machineId)
      || { id: machineId, type: machineId.startsWith('generator') ? 'generator' : 'fire_pump' };
    pages.push(sheet1(machineInfo, data, logoB64));
    pages.push(sheet2(machineInfo, data, logoB64, approverSigB64));
  }
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}
