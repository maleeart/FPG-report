import fieldMap from '../data/field-map.json';

const v = (val, fallback = '–') =>
  (val === undefined || val === null || val === '') ? fallback : String(val);

const passBox = r => r === 'pass'     ? '☑' : '☐';
const failBox = r => r === 'fail'     ? '☑' : '☐';
const normBox = r => r === 'normal'   ? '☑' : '☐';
const abnBox  = r => r === 'abnormal' ? '☑' : '☐';
const noneBox = r => r === 'none'     ? '☑' : '☐';

const FS = 'font-size:10.5px';
const PAD = 'padding:1px 3px';
const CELL = `${FS};${PAD};vertical-align:middle`;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family:'TH SarabunPSK','Sarabun','Angsana New',sans-serif; font-size:10.5px; color:#000; background:#fff; }
.page { width:210mm; min-height:297mm; padding:7mm 9mm; page-break-after:always; }
table { border-collapse:collapse; width:100%; }
td, th { border:1px solid #000; padding:1px 3px; vertical-align:middle; font-size:10.5px; }
.nb  { border:none !important; }
.chk { text-align:center; font-size:13px; }
.shdr { background:#c6efce; font-weight:bold; }
.sub  { background:#f2f2f2; font-weight:bold; }
.val  { text-align:center; }
@page { size:A4 portrait; margin:0; }
`;

/* ─── header ─── */
function header(machineInfo, data, logoB64, sheet) {
  const title = machineInfo?.type === 'fire_pump'
    ? 'INSPECTION REPORT OF FIRE PUMP'
    : 'INSPECTION REPORT OF GENERATOR';
  const logo = logoB64 ? `<img src="data:image/jpeg;base64,${logoB64}" style="height:44px">` : '';
  return `
<table style="margin-bottom:4px">
  <tr>
    <td class="nb" style="width:90px">${logo}</td>
    <td class="nb" style="text-align:center">
      <div style="font-size:10px">Electricity Generating Authority of Thailand &nbsp;|&nbsp; การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย</div>
      <div style="font-size:14px;font-weight:bold">${title}</div>
      <div style="font-size:10px">สำนักงาน ไทรน้อย</div>
    </td>
    <td class="nb" style="text-align:right;vertical-align:top;font-weight:bold;white-space:nowrap">${sheet}</td>
  </tr>
</table>`;
}

/* ─── PAGE 1: ตารางเดียว General Datas + checklist 0 + รูป ─── */
function sheet1(machineInfo, data, logoB64, imgB64List) {
  const isFp   = machineInfo?.type === 'fire_pump';
  const tmpl   = isFp ? fieldMap.fire_pump_template : fieldMap.generator_template;
  const items0 = tmpl?.sheet_visual_fields?.checklist_0_items || [];
  const g = data.generalData || {};
  const a = data.afterRun    || {};

  const fuelBefore = v(g.fuelBefore, '');
  const fuelAfter  = v(a.fuelAfter,  '');
  const hrsBefore  = v(g.runningHoursBefore, '');
  const hrsAfter   = v(a.runningHoursAfter, '');
  const tankCap    = machineInfo?.tank_capacity_l;
  const tankVal    = isFp ? (tankCap ? String(tankCap) : '') : v(g.runCount, '');
  const tankLabel  = isFp ? 'ความจุถังเชื้อเพลิง' : 'จำนวนครั้งที่ทำงาน';
  const tankUnit   = isFp ? 'Liters' : 'ครั้ง';

  /*
    9 คอลัมน์:
    1(13%) label  2(7%) val  3(9%) label  4(9%) val
    5(9%)  label  6(7%) val  7(11%) label
    8(7%)  ผ่าน   9(7%) ไม่ผ่าน  10(21%) หมายเหตุ
  */
  const CG = `<colgroup>
    <col style="width:13%"><col style="width:7%"><col style="width:9%"><col style="width:9%">
    <col style="width:9%"><col style="width:7%"><col style="width:11%">
    <col style="width:7%"><col style="width:7%"><col style="width:21%">
  </colgroup>`;

  const chkRows = items0.map((item, i) => {
    const r = (data.preVisual || [])[i] || {};
    return `<tr>
      <td class="val">${i + 1}</td>
      <td colspan="6">${item.text}</td>
      <td class="chk val">${passBox(r.result)}</td>
      <td class="chk val">${failBox(r.result)}</td>
      <td>${r.remark || ''}</td>
    </tr>`;
  }).join('');

  /* รูปประกอบ */
  const COLS = 4;
  let photoRows = '';
  if (imgB64List?.length > 0) {
    const padded = [...imgB64List];
    const rem = padded.length % COLS;
    if (rem) for (let i = 0; i < COLS - rem; i++) padded.push(null);
    for (let i = 0; i < padded.length; i += COLS) {
      const cells = padded.slice(i, i + COLS).map(b64 =>
        b64
          ? `<td style="padding:2px;border:1px solid #000;width:25%"><img src="data:image/jpeg;base64,${b64}" style="width:100%;max-height:105px;object-fit:contain;display:block;"></td>`
          : `<td style="border:1px solid #000;width:25%"></td>`
      ).join('');
      photoRows += `<tr>${cells}</tr>`;
    }
  }
  const photoSection = photoRows
    ? `<tr><td colspan="10" class="shdr">รูปประกอบเครื่อง</td></tr>
       <tr><td colspan="10" style="padding:0;border:none">
         <table style="width:100%;border-collapse:collapse">${photoRows}</table>
       </td></tr>`
    : '';

  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 1/2')}
  <table style="table-layout:fixed;width:100%">
    ${CG}
    <tr>
      <td colspan="9" style="font-weight:bold;${PAD}">General Datas</td>
      <td style="text-align:right;${PAD}">Sheet 1/2</td>
    </tr>
    <tr>
      <td style="font-weight:bold">Location</td>
      <td colspan="2">${v(machineInfo?.location_default)}</td>
      <td style="font-weight:bold">ชนิด</td>
      <td>${isFp ? 'Vertical' : 'Standby'}</td>
      <td colspan="2" style="font-weight:bold">Station No.</td>
      <td colspan="3">${machineInfo?.label || ''}</td>
    </tr>
    <tr>
      <td style="font-weight:bold">Model</td>
      <td>${v(machineInfo?.model_default)}</td>
      <td style="font-weight:bold">Serial-Number</td>
      <td colspan="2">${v(machineInfo?.serial_default)}</td>
      <td style="font-weight:bold">MFG</td>
      <td>${v(machineInfo?.mfg_default)}</td>
      <td colspan="2" style="font-weight:bold">RPM Rating</td>
      <td>${v(machineInfo?.rpm_rating_default)}</td>
    </tr>
    <tr>
      <td colspan="2" style="font-weight:bold">Qty. Of Fuel Liquid</td>
      <td colspan="2" class="val">( ) Gal &nbsp;(✓) Lit &nbsp;( ) kg</td>
      <td style="font-weight:bold">Fuel Level</td>
      <td class="val">(Before) ${fuelBefore}</td>
      <td class="val">/</td>
      <td class="val">(After) ${fuelAfter}</td>
      <td colspan="2">Liters</td>
    </tr>
    <tr>
      <td style="font-weight:bold">ระยะเวลาที่เครื่องยนต์ทำงาน</td>
      <td class="val">${v(g.runDurationMins, '')}</td>
      <td>mins.</td>
      <td style="font-weight:bold">${tankLabel}</td>
      <td class="val">${tankVal}</td>
      <td>${tankUnit}</td>
      <td style="font-weight:bold">ชั่วโมงการทำงาน</td>
      <td class="val">(Before) ${hrsBefore}</td>
      <td class="val">/</td>
      <td>(After) ${hrsAfter} Hrs.</td>
    </tr>
    <tr><td colspan="10" style="font-weight:bold;${PAD}">0.Pre Visual Inspection</td></tr>
    <tr class="sub">
      <th class="val">#</th>
      <th colspan="6" style="text-align:left">รายการตรวจสอบ</th>
      <th class="val">ผ่าน</th>
      <th class="val">ไม่ผ่าน</th>
      <th>หมายเหตุ</th>
    </tr>
    ${chkRows}
    ${photoSection}
  </table>
</div>`;
}

/* ─── PAGE 2 ─── */
function sheet2(machineInfo, data, logoB64, approverSigB64) {
  const isFp  = machineInfo?.type === 'fire_pump';
  const tmpl  = isFp ? fieldMap.fire_pump_template : fieldMap.generator_template;
  const items1 = tmpl?.sheet_data_fields?.checklist_1_items || [];
  const r = data.readings || {};
  const t = data.testRun  || {};
  const a = data.afterRun || {};
  const jp = r.jockeyPump || {};
  const el = r.electrical || {};

  const conclusion = a.conclusionText?.trim()
    || (tmpl?.sheet_data_fields?.conclusion_default || []).join('\n');
  const inspDate = data.inspectionDate || '–';

  /* checklist 1 — 6 คอลัมน์ */
  const chk1Rows = items1.map((item, i) => {
    const res = (data.preRunVisual || [])[i] || {};
    return `<tr>
      <td class="val" style="width:22px">${i + 1}</td>
      <td>${item.text}</td>
      <td class="chk val" style="width:26px">${normBox(res.result)}</td>
      <td class="chk val" style="width:26px">${abnBox(res.result)}</td>
      <td class="chk val" style="width:26px">${noneBox(res.result)}</td>
      <td style="width:22%">${res.remark || ''}</td>
    </tr>`;
  }).join('');

  /* sec2 + sec3 เคียงกัน: 10 cols ต่อฝั่ง (ใช้ 2 td ใหญ่) */
  const sec2Fp = `
<table style="width:100%;table-layout:fixed;margin-bottom:0">
  <colgroup>
    <col style="width:58%"><col style="width:14%"><col style="width:14%"><col style="width:14%">
  </colgroup>
  <tr><td colspan="4" class="shdr">2. ค่าที่บันทึกได้ก่อนเดินเครื่อง</td></tr>
  <tr class="sub"><th style="text-align:left">รายการ</th><th colspan="3" class="val">ค่าที่ได้</th></tr>
  <tr><td>ความดันน้ำในระบบก่อนเดินเครื่อง (Psi)</td><td colspan="3" class="val">${v(r.waterPressure)}</td></tr>
  <tr><td>แรงดันแบตเตอรี่ Battery #1 (Volt)</td><td colspan="3" class="val">${v(r.battery1Voltage)}</td></tr>
  <tr><td>แรงดันแบตเตอรี่ Battery #2 (Volt)</td><td colspan="3" class="val">${v(r.battery2Voltage)}</td></tr>
  <tr class="sub"><td colspan="4">Jockey Pump</td></tr>
  <tr>
    <td>แรงดัน (V)</td>
    <td class="val">L1-L2<br>${v(jp.voltageL1L2)}</td>
    <td class="val">L2-L3<br>${v(jp.voltageL2L3)}</td>
    <td class="val">L1-L3<br>${v(jp.voltageL1L3)}</td>
  </tr>
  <tr>
    <td>กระแส (A)</td>
    <td class="val">L1<br>${v(jp.currentL1)}</td>
    <td class="val">L2<br>${v(jp.currentL2)}</td>
    <td class="val">L3<br>${v(jp.currentL3)}</td>
  </tr>
</table>`;

  const sec2Gen = `
<table style="width:100%;table-layout:fixed;margin-bottom:0">
  <colgroup>
    <col style="width:44%"><col style="width:14%"><col style="width:14%"><col style="width:14%"><col style="width:14%">
  </colgroup>
  <tr><td colspan="5" class="shdr">2. ค่าที่บันทึกได้ก่อนเดินเครื่อง</td></tr>
  <tr class="sub"><th style="text-align:left">รายการ</th><th colspan="4" class="val">ค่าที่ได้</th></tr>
  <tr><td>แรงดันแบตเตอรี่ (Volt)</td><td colspan="4" class="val">${v(r.batteryVoltage)}</td></tr>
  <tr class="sub"><td colspan="5">ค่าแรงดัน Off Load (Volt)</td></tr>
  <tr>
    <td>Phase to Neutral (V)</td>
    <td class="val">L1-N<br>${v(el.offload_L1N)}</td>
    <td class="val">L2-N<br>${v(el.offload_L2N)}</td>
    <td class="val">L3-N<br>${v(el.offload_L3N)}</td>
    <td></td>
  </tr>
  <tr>
    <td>Phase to Phase (V)</td>
    <td class="val">L1-L2<br>${v(el.offload_L1L2)}</td>
    <td class="val">L2-L3<br>${v(el.offload_L2L3)}</td>
    <td class="val">L1-L3<br>${v(el.offload_L1L3)}</td>
    <td></td>
  </tr>
</table>`;

  const sec3RowsFp = [
    ['ความเร็วรอบ (RPM)',             v(t.rpm)],
    ['แรงดันน้ำมันเครื่อง (Psi)',      v(t.oilPressure)],
    ['อุณหภูมิน้ำหล่อเย็น (°C)',      v(t.coolantTemp)],
    ['แรงดันน้ำระบายความร้อน (Psi)',   v(t.coolingPressure)],
    ['แรงดันน้ำในระบบขณะเดิน (Psi)',  v(t.systemPressure)],
    ['อัตราการใช้เชื้อเพลิง (Liters)', v(t.fuelConsumption)],
  ];
  const sec3RowsGen = [
    ['ความเร็วรอบ (RPM)',             v(t.rpm)],
    ['แรงดันน้ำมันเครื่อง (Psi)',      v(t.oilPressure)],
    ['อุณหภูมิน้ำหล่อเย็น (°C)',      v(t.coolantTemp)],
    ['แรงดันชาร์จแบตเตอรี่ (Volt)',   v(t.chargeVoltage)],
    ['ความถี่ไฟฟ้า (Hz)',             v(t.frequency)],
    ['แรงดันน้ำในระบบ (Psi)',         v(t.systemPressure)],
    ['อัตราการใช้เชื้อเพลิง (Liters)', v(t.fuelConsumption)],
  ];
  const sec3Rows = (isFp ? sec3RowsFp : sec3RowsGen)
    .map(([lbl, val]) => `<tr><td>${lbl}</td><td class="val" style="width:28%">${val}</td></tr>`)
    .join('');
  const sec3 = `
<table style="width:100%;margin-bottom:0">
  <tr><td colspan="2" class="shdr">3. ค่าที่บันทึกได้ขณะเดินเครื่อง (Test Run)</td></tr>
  <tr class="sub"><th style="text-align:left">รายการ</th><th class="val">ค่าที่ได้</th></tr>
  ${sec3Rows}
</table>`;

  const approverImg = approverSigB64
    ? `<img src="data:image/png;base64,${approverSigB64}" style="height:34px;display:block;margin:0 auto 2px">`
    : '';

  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 2/2')}

  <!-- checklist 1 -->
  <table style="margin-bottom:3px">
    <tr><td colspan="6" class="shdr">1. Pre-Run Visual Inspection</td></tr>
    <tr class="sub">
      <th class="val" style="width:22px">#</th>
      <th style="text-align:left">รายการตรวจสอบ</th>
      <th class="val" style="width:26px">ปกติ</th>
      <th class="val" style="width:26px">ผิดปกติ</th>
      <th class="val" style="width:26px">ไม่มี</th>
      <th style="width:22%">หมายเหตุ</th>
    </tr>
    ${chk1Rows}
  </table>

  <!-- sec 2 + sec 3 เคียงกัน -->
  <table style="margin-bottom:3px">
    <tr>
      <td style="width:52%;vertical-align:top;padding:0;border:none">${isFp ? sec2Fp : sec2Gen}</td>
      <td style="width:2%;border:none"></td>
      <td style="width:46%;vertical-align:top;padding:0;border:none">${sec3}</td>
    </tr>
  </table>

  <!-- sec 4 หมายเหตุ + sec 5 สรุป เคียงกัน -->
  <table style="margin-bottom:3px">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0;border:none">
        <table>
          <tr><td class="shdr">4. หมายเหตุ / ข้อสังเกต</td></tr>
          <tr><td style="height:36px;white-space:pre-line">${a.comment || ''}</td></tr>
        </table>
      </td>
      <td style="width:2%;border:none"></td>
      <td style="width:48%;vertical-align:top;padding:0;border:none">
        <table>
          <tr><td class="shdr">5. สรุปผลการตรวจสอบ</td></tr>
          <tr><td style="height:36px;white-space:pre-line">${conclusion}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ลายเซ็น -->
  <table style="margin-top:4px">
    <tr>
      <td class="nb" style="width:50%;text-align:center">
        <div style="border-top:1px solid #000;padding-top:3px;margin-top:6px">
          <div>ผู้ตรวจสอบ</div>
          <div style="font-weight:bold;margin:2px 0">${a.inspectedBy || '( ………………………………… )'}</div>
          <div>วันที่ ${inspDate}</div>
        </div>
      </td>
      <td class="nb" style="width:50%;text-align:center">
        <div style="border-top:1px solid #000;padding-top:3px;margin-top:6px">
          ${approverImg}
          <div>ผู้อนุมัติ</div>
          <div style="font-weight:bold;margin:2px 0">${a.approvedBy || '( ………………………………… )'}</div>
          <div>วันที่ ${inspDate}</div>
        </div>
      </td>
    </tr>
  </table>
</div>`;
}

export function generateFpgReportHtml(records, logoB64, approverSigB64, machineImages = {}) {
  const pages = [];
  for (const [machineId, data] of Object.entries(records)) {
    if (!data) continue;
    const machineInfo = (fieldMap.machines || []).find(m => m.id === machineId)
      || { id: machineId, type: machineId.startsWith('generator') ? 'generator' : 'fire_pump' };
    pages.push(sheet1(machineInfo, data, logoB64, machineImages?.[machineId] || []));
    pages.push(sheet2(machineInfo, data, logoB64, approverSigB64));
  }
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><style>${CSS}</style></head><body>${pages.join('\n')}</body></html>`;
}
