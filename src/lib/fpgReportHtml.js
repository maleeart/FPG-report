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
  font-size: 11.5px; color: #000; background: #fff;
}
.page {
  width: 210mm; min-height: 297mm;
  padding: 8mm 10mm;
  page-break-after: always;
  page-break-inside: avoid;
}
table { border-collapse: collapse; width: 100%; }
td, th {
  border: 1px solid #000;
  padding: 2px 4px;
  vertical-align: middle;
  font-size: 11.5px;
}
.no-border { border: none !important; }
.chk { text-align: center; width: 32px; font-size: 14px; }
.sec-hdr {
  background: #c6efce; font-weight: bold; font-size: 12px;
  padding: 2px 5px;
}
.sub-hdr { background: #f2f2f2; font-weight: bold; }
.thead-row { background: #dce6f1; }
.num-col { text-align: center; width: 24px; }
.val-col { text-align: center; width: 80px; }
.photo-cell { text-align: center; padding: 3px; border: 1px solid #000; }
@page { size: A4 portrait; margin: 0; }
@media print { .page { padding: 8mm 10mm; } }
`;

/* ---- header ---- */
function header(machineInfo, data, logoB64, sheet) {
  const title = machineInfo?.type === 'fire_pump'
    ? 'INSPECTION REPORT OF FIRE PUMP'
    : 'INSPECTION REPORT OF GENERATOR';
  const logo = logoB64
    ? `<img src="data:image/jpeg;base64,${logoB64}" style="height:48px">`
    : '';
  return `
<table style="margin-bottom:5px">
  <tr>
    <td class="no-border" style="width:100px">${logo}</td>
    <td class="no-border" style="text-align:center">
      <div style="font-size:11px">Electricity Generating Authority of Thailand</div>
      <div style="font-size:11px">การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย</div>
      <div style="font-size:15px;font-weight:bold">${title}</div>
      <div style="font-size:11px">สำนักงาน ไทรน้อย</div>
    </td>
    <td class="no-border" style="text-align:right;vertical-align:top;white-space:nowrap;font-weight:bold">${sheet}</td>
  </tr>
</table>`;
}

/* ---- general data ---- */
function generalDatas(machineInfo, data) {
  const g  = data.generalData || {};
  const a  = data.afterRun    || {};
  const fp = machineInfo?.type === 'fire_pump';
  const fuelBefore = v(g.fuelBefore, '');
  const fuelAfter  = v(a.fuelAfter,  '');
  const hrsBefore  = v(g.runningHoursBefore, '');
  const hrsAfter   = v(a.runningHoursAfter, '');
  return `
<table style="margin-bottom:4px;font-size:11px">
  <tr>
    <td colspan="9" style="font-weight:bold;padding:2px 4px">General Datas</td>
    <td style="text-align:right;font-size:10px;white-space:nowrap;padding:2px 4px">Sheet 1/2</td>
  </tr>
  <tr>
    <td style="font-weight:bold;white-space:nowrap">Location</td>
    <td colspan="2">${v(machineInfo?.location_default)}</td>
    <td style="font-weight:bold">ชนิด</td>
    <td>${fp ? 'Vertical' : 'Standby'}</td>
    <td colspan="2" style="font-weight:bold">Station No.</td>
    <td colspan="3">${machineInfo?.label || ''}</td>
  </tr>
  <tr>
    <td style="font-weight:bold">Model</td>
    <td>${v(machineInfo?.model_default)}</td>
    <td style="font-weight:bold;white-space:nowrap">Serial-Number</td>
    <td colspan="2">${v(machineInfo?.serial_default)}</td>
    <td style="font-weight:bold">MFG</td>
    <td>${v(machineInfo?.mfg_default)}</td>
    <td style="font-weight:bold;white-space:nowrap">RPM Rating</td>
    <td colspan="2">${v(machineInfo?.rpm_rating_default)}</td>
  </tr>
  <tr>
    <td colspan="2" style="font-weight:bold;white-space:nowrap">Qty. Of Fuel Liquid</td>
    <td colspan="2" style="text-align:center;white-space:nowrap">
      ( ) Gal &nbsp; ( ✓ ) Lit &nbsp; ( ) kg
    </td>
    <td style="font-weight:bold;white-space:nowrap">Fuel Level</td>
    <td style="white-space:nowrap">(Before)&nbsp; ${fuelBefore}</td>
    <td style="text-align:center">/</td>
    <td style="white-space:nowrap">(After)&nbsp; ${fuelAfter}</td>
    <td colspan="2">Liters</td>
  </tr>
  <tr>
    <td style="font-weight:bold;white-space:nowrap">ระยะเวลาที่เครื่องยนต์ทำงาน</td>
    <td style="text-align:center">${v(g.runDurationMins, '')}</td>
    <td style="white-space:nowrap">mins.</td>
    <td style="font-weight:bold;white-space:nowrap">${fp ? 'ความจุถังเชื้อเพลิง' : 'จำนวนครั้งที่ทำงาน'}</td>
    <td style="text-align:center">${fp ? '' : v(g.runCount, '')}</td>
    <td style="white-space:nowrap">${fp ? 'Liters' : 'ครั้ง'}</td>
    <td style="font-weight:bold;white-space:nowrap">ชั่วโมงการทำงาน</td>
    <td style="white-space:nowrap">(Before)&nbsp; ${hrsBefore}</td>
    <td style="text-align:center">/</td>
    <td style="white-space:nowrap">(After)&nbsp; ${hrsAfter}&nbsp; Hrs.</td>
  </tr>
</table>`;
}

/* ---- checklist 0: Pre Visual Inspection ---- */
function checklist0(items, results) {
  const rows = items.map((item, i) => {
    const r = results[i] || {};
    return `<tr>
      <td class="num-col">${i + 1}</td>
      <td>${item.text}</td>
      <td class="chk">${passBox(r.result)}</td>
      <td class="chk">${failBox(r.result)}</td>
      <td style="width:90px">${r.remark || ''}</td>
    </tr>`;
  }).join('');
  return `
<table style="margin-bottom:4px">
  <tr>
    <td colspan="5" class="sec-hdr">0. Pre Visual Inspection</td>
  </tr>
  <tr class="thead-row">
    <th class="num-col">#</th>
    <th style="text-align:left">รายการตรวจสอบ</th>
    <th class="chk">ผ่าน</th>
    <th class="chk">ไม่ผ่าน</th>
    <th>หมายเหตุ</th>
  </tr>
  ${rows}
</table>`;
}

/* ---- machine photos ---- */
function machinePhotos(imgB64List) {
  if (!imgB64List || imgB64List.length === 0) return '';
  const COLS = 4;
  const padded = [...imgB64List];
  const rem = padded.length % COLS;
  if (rem !== 0) for (let i = 0; i < COLS - rem; i++) padded.push(null);
  let photoRows = '';
  for (let i = 0; i < padded.length; i += COLS) {
    const rowCells = padded.slice(i, i + COLS).map(b64 =>
      b64
        ? `<td class="photo-cell" style="width:${100/COLS}%"><img src="data:image/jpeg;base64,${b64}" style="width:100%;max-height:80px;object-fit:contain;display:block;" /></td>`
        : `<td class="photo-cell" style="width:${100/COLS}%"></td>`
    ).join('');
    photoRows += `<tr>${rowCells}</tr>`;
  }
  return `
<table>
  <tr><td colspan="${COLS}" class="sec-hdr">รูปประกอบเครื่อง</td></tr>
  ${photoRows}
</table>`;
}

/* ---- PAGE 1 ---- */
function sheet1(machineInfo, data, logoB64, imgB64List) {
  const isFp = machineInfo?.type === 'fire_pump';
  const tmpl = isFp ? fieldMap.fire_pump_template : fieldMap.generator_template;
  const items0 = tmpl?.sheet_visual_fields?.checklist_0_items || [];
  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 1/2')}
  ${generalDatas(machineInfo, data)}
  ${checklist0(items0, data.preVisual || [])}
  ${machinePhotos(imgB64List)}
</div>`;
}

/* ---- checklist 1: Pre-Run Visual Inspection ---- */
function checklist1(items, results) {
  const rows = items.map((item, i) => {
    const r = results[i] || {};
    return `<tr>
      <td class="num-col">${i + 1}</td>
      <td>${item.text}</td>
      <td class="chk">${normBox(r.result)}</td>
      <td class="chk">${abnBox(r.result)}</td>
      <td class="chk">${noneBox(r.result)}</td>
      <td style="width:90px">${r.remark || ''}</td>
    </tr>`;
  }).join('');
  return `
<table style="margin-bottom:4px">
  <tr>
    <td colspan="6" class="sec-hdr">1. Pre-Run Visual Inspection</td>
  </tr>
  <tr class="thead-row">
    <th class="num-col">#</th>
    <th style="text-align:left">รายการตรวจสอบ</th>
    <th class="chk">ปกติ</th>
    <th class="chk">ผิดปกติ</th>
    <th class="chk">ไม่มี</th>
    <th>หมายเหตุ</th>
  </tr>
  ${rows}
</table>`;
}

/* ---- section 2 FP: measurements before run (with Jockey split cols) ---- */
function sec2TableFp(r) {
  const jp = r.jockeyPump || {};
  return `
<table style="margin-bottom:4px">
  <tr><td colspan="7" class="sec-hdr">2. ค่าที่บันทึกได้ก่อนเดินเครื่อง</td></tr>
  <tr class="thead-row">
    <th colspan="4" style="text-align:left">รายการ</th>
    <th colspan="3" style="text-align:center">ค่าที่ได้</th>
  </tr>
  <tr>
    <td colspan="4">ความดันน้ำในระบบก่อนเดินเครื่อง (Psi)</td>
    <td colspan="3" class="val-col">${v(r.waterPressure)}</td>
  </tr>
  <tr>
    <td colspan="4">แรงดันแบตเตอรี่ Battery #1 (Volt)</td>
    <td colspan="3" class="val-col">${v(r.battery1Voltage)}</td>
  </tr>
  <tr>
    <td colspan="4">แรงดันแบตเตอรี่ Battery #2 (Volt)</td>
    <td colspan="3" class="val-col">${v(r.battery2Voltage)}</td>
  </tr>
  <tr class="sub-hdr">
    <td colspan="7">Jockey Pump</td>
  </tr>
  <tr>
    <td colspan="4">แรงดัน (Volt)</td>
    <td style="text-align:center;width:60px">L1-L2<br/>${v(jp.voltageL1L2)}</td>
    <td style="text-align:center;width:60px">L2-L3<br/>${v(jp.voltageL2L3)}</td>
    <td style="text-align:center;width:60px">L1-L3<br/>${v(jp.voltageL1L3)}</td>
  </tr>
  <tr>
    <td colspan="4">กระแส (Amp)</td>
    <td style="text-align:center">L1<br/>${v(jp.currentL1)}</td>
    <td style="text-align:center">L2<br/>${v(jp.currentL2)}</td>
    <td style="text-align:center">L3<br/>${v(jp.currentL3)}</td>
  </tr>
</table>`;
}

/* ---- section 2 GEN ---- */
function sec2TableGen(r) {
  const el = r.electrical || {};
  return `
<table style="margin-bottom:4px">
  <tr><td colspan="7" class="sec-hdr">2. ค่าที่บันทึกได้ก่อนเดินเครื่อง</td></tr>
  <tr class="thead-row">
    <th colspan="4" style="text-align:left">รายการ</th>
    <th colspan="3" style="text-align:center">ค่าที่ได้</th>
  </tr>
  <tr>
    <td colspan="4">แรงดันแบตเตอรี่ (Volt)</td>
    <td colspan="3" class="val-col">${v(r.batteryVoltage)}</td>
  </tr>
  <tr class="sub-hdr">
    <td colspan="7">ค่าแรงดัน Off Load (Volt)</td>
  </tr>
  <tr>
    <td colspan="4">Phase to Neutral</td>
    <td style="text-align:center;width:60px">L1-N<br/>${v(el.offload_L1N)}</td>
    <td style="text-align:center;width:60px">L2-N<br/>${v(el.offload_L2N)}</td>
    <td style="text-align:center;width:60px">L3-N<br/>${v(el.offload_L3N)}</td>
  </tr>
  <tr>
    <td colspan="4">Phase to Phase</td>
    <td style="text-align:center">L1-L2<br/>${v(el.offload_L1L2)}</td>
    <td style="text-align:center">L2-L3<br/>${v(el.offload_L2L3)}</td>
    <td style="text-align:center">L1-L3<br/>${v(el.offload_L1L3)}</td>
  </tr>
</table>`;
}

/* ---- section 3: test run ---- */
function sec3Table(isFp, t) {
  const rowsFp = [
    ['ความเร็วรอบ (RPM)',                  v(t.rpm)],
    ['แรงดันน้ำมันเครื่อง (Psi)',           v(t.oilPressure)],
    ['อุณหภูมิน้ำหล่อเย็น (°C)',           v(t.coolantTemp)],
    ['แรงดันน้ำระบายความร้อน (Psi)',        v(t.coolingPressure)],
    ['แรงดันน้ำในระบบขณะเดิน (Psi)',       v(t.systemPressure)],
    ['อัตราการใช้เชื้อเพลิง (Liters)',     v(t.fuelConsumption)],
  ];
  const rowsGen = [
    ['ความเร็วรอบ (RPM)',                  v(t.rpm)],
    ['แรงดันน้ำมันเครื่อง (Psi)',           v(t.oilPressure)],
    ['อุณหภูมิน้ำหล่อเย็น (°C)',           v(t.coolantTemp)],
    ['แรงดันชาร์จแบตเตอรี่ (Volt)',        v(t.chargeVoltage)],
    ['ความถี่ไฟฟ้า (Hz)',                  v(t.frequency)],
    ['แรงดันน้ำในระบบ (Psi)',              v(t.systemPressure)],
    ['อัตราการใช้เชื้อเพลิง (Liters)',     v(t.fuelConsumption)],
  ];
  const rows = (isFp ? rowsFp : rowsGen).map(([label, val]) =>
    `<tr><td>${label}</td><td class="val-col">${val}</td></tr>`
  ).join('');
  return `
<table style="margin-bottom:4px">
  <tr><td colspan="2" class="sec-hdr">3. ค่าที่บันทึกได้ขณะเดินเครื่อง (Test Run)</td></tr>
  <tr class="thead-row">
    <th style="text-align:left">รายการ</th>
    <th style="text-align:center;width:80px">ค่าที่ได้</th>
  </tr>
  ${rows}
</table>`;
}

/* ---- PAGE 2 ---- */
function sheet2(machineInfo, data, logoB64, approverSigB64) {
  const isFp = machineInfo?.type === 'fire_pump';
  const tmpl = isFp ? fieldMap.fire_pump_template : fieldMap.generator_template;
  const items1 = tmpl?.sheet_data_fields?.checklist_1_items || [];
  const r = data.readings || {};
  const t = data.testRun  || {};
  const a = data.afterRun || {};

  const conclusion = (a.conclusionText?.trim())
    ? a.conclusionText
    : (tmpl?.sheet_data_fields?.conclusion_default || []).join('\n');

  const approverImg = approverSigB64
    ? `<img src="data:image/png;base64,${approverSigB64}" style="height:36px;display:block;margin:0 auto 2px">`
    : '';
  const inspDate = data.inspectionDate || '–';

  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 2/2')}

  ${checklist1(items1, data.preRunVisual || [])}

  ${isFp ? sec2TableFp(r) : sec2TableGen(r)}

  ${sec3Table(isFp, t)}

  <table style="margin-bottom:4px">
    <tr><td class="sec-hdr">4. หมายเหตุ / ข้อสังเกต</td></tr>
    <tr><td style="min-height:34px;white-space:pre-line;padding:4px">${a.comment || ''}</td></tr>
  </table>

  <table style="margin-bottom:8px">
    <tr><td class="sec-hdr">5. สรุปผลการตรวจสอบ</td></tr>
    <tr><td style="min-height:28px;white-space:pre-line;padding:4px">${conclusion}</td></tr>
  </table>

  <table>
    <tr>
      <td class="no-border" style="width:50%;text-align:center">
        <div style="border-top:1px solid #000;padding-top:4px;margin-top:8px">
          <div>ผู้ตรวจสอบ</div>
          <div style="font-weight:bold;margin:3px 0">${a.inspectedBy || '( ………………………………… )'}</div>
          <div>วันที่ ${inspDate}</div>
        </div>
      </td>
      <td class="no-border" style="width:50%;text-align:center">
        <div style="border-top:1px solid #000;padding-top:4px;margin-top:8px">
          ${approverImg}
          <div>ผู้อนุมัติ</div>
          <div style="font-weight:bold;margin:3px 0">${a.approvedBy || '( ………………………………… )'}</div>
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
export function generateFpgReportHtml(records, logoB64, approverSigB64, machineImages = {}) {
  const pages = [];
  for (const [machineId, data] of Object.entries(records)) {
    if (!data) continue;
    const machineInfo = (fieldMap.machines || []).find(m => m.id === machineId)
      || { id: machineId, type: machineId.startsWith('generator') ? 'generator' : 'fire_pump' };
    const imgList = machineImages?.[machineId] || [];
    pages.push(sheet1(machineInfo, data, logoB64, imgList));
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
