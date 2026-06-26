import fieldMap from '../data/field-map.json';

const v = (val, fallback = '–') =>
  (val === undefined || val === null || val === '') ? fallback : String(val);

const passBox = r => r === 'pass'     ? '☑' : '☐';
const failBox = r => r === 'fail'     ? '☑' : '☐';
const normBox = r => r === 'normal'   ? '☑' : '☐';
const abnBox  = r => r === 'abnormal' ? '☑' : '☐';
const noneBox = r => r === 'none'     ? '☑' : '☐';

const PAD = 'padding:1px 3px';

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

/* ─── PAGE 1: General Datas + checklist 0 + รูป ─── */
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

  /* รูปประกอบ — 4 ต่อแถว */
  const COLS = 4;
  let photoRows = '';
  if (imgB64List?.length > 0) {
    const padded = [...imgB64List];
    const rem = padded.length % COLS;
    if (rem) for (let i = 0; i < COLS - rem; i++) padded.push(null);
    for (let i = 0; i < padded.length; i += COLS) {
      const cells = padded.slice(i, i + COLS).map(b64 =>
        b64
          ? `<td style="padding:2px;border:1px solid #000;width:25%"><img src="data:image/jpeg;base64,${b64}" style="width:100%;max-height:130px;object-fit:contain;display:block;"></td>`
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
  const isFp = machineInfo?.type === 'fire_pump';
  const tmpl = isFp ? fieldMap.fire_pump_template : fieldMap.generator_template;
  const items1 = tmpl?.sheet_data_fields?.checklist_1_items || [];
  const r = data.readings || {};
  const t = data.testRun  || {};
  const a = data.afterRun || {};
  const jp = r.jockeyPump || {};
  const el = r.electrical || {};

  const conclusion = a.conclusionText?.trim()
    || (tmpl?.sheet_data_fields?.conclusion_default || []).join('\n');
  const inspDate = data.inspectionDate || '–';

  /* colgroup measurement table: รายการ | ค่า | หน่วย | สภาพปกติ | หมายเหตุ */
  const CG5 = `<colgroup>
    <col style="width:54%"><col style="width:14%"><col style="width:9%"><col style="width:8%"><col style="width:15%">
  </colgroup>`;

  /* Jockey Pump: nested split table (voltage left + current right) ไม่มีเซลว่างขวา */
  const jpRows = `
  <tr>
    <td colspan="5" style="padding:0">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup>
          <col style="width:18%"><col style="width:10.5%"><col style="width:10.5%"><col style="width:10.5%">
          <col style="width:18%"><col style="width:10.5%"><col style="width:10.5%"><col style="width:10.5%">
        </colgroup>
        <tr class="sub">
          <th class="val">Jockey Pump</th><th class="val">L1-L2</th><th class="val">L2-L3</th><th class="val">L1-L3</th>
          <th class="val">Jockey Pump</th><th class="val">L1</th><th class="val">L2</th><th class="val">L3</th>
        </tr>
        <tr>
          <td class="val">แรงดันไฟฟ้า (V)</td>
          <td class="val">${v(jp.voltageL1L2)}</td><td class="val">${v(jp.voltageL2L3)}</td><td class="val">${v(jp.voltageL1L3)}</td>
          <td class="val">กระแสไฟฟ้า (A)</td>
          <td class="val">${v(jp.currentL1)}</td><td class="val">${v(jp.currentL2)}</td><td class="val">${v(jp.currentL3)}</td>
        </tr>
      </table>
    </td>
  </tr>`;

  /* Pre-Run Measurements (Fire Pump): Engine + Battery Data + Jockey */
  const preRunFp = `
  <table style="table-layout:fixed;width:100%;margin-bottom:2px">
    ${CG5}
    <tr class="sub">
      <th rowspan="2" style="text-align:left">หัวข้อที่ทำการวัดค่า</th>
      <th colspan="3" class="val">ค่าที่บันทึกได้</th>
      <th rowspan="2">หมายเหตุ</th>
    </tr>
    <tr class="sub"><th class="val">ค่า</th><th class="val">หน่วย</th><th class="val">สภาพปกติ</th></tr>
    <tr class="sub"><td colspan="5" style="text-align:center">Engine</td></tr>
    <tr><td>แรงดันน้ำในระบบ</td><td class="val">${v(r.waterPressure)}</td><td class="val">Psi</td><td class="chk val">☐</td><td></td></tr>
    <tr class="sub"><td colspan="5" style="text-align:center">Battery Data</td></tr>
    <tr><td>แรงดันไฟฟ้าของแบตเตอรี่ No.1</td><td class="val">${v(r.battery1Voltage)}</td><td class="val">Volt</td><td class="chk val">☐</td><td></td></tr>
    <tr><td>แรงดันไฟฟ้าของแบตเตอรี่ No.2</td><td class="val">${v(r.battery2Voltage)}</td><td class="val">Volt</td><td class="chk val">☐</td><td></td></tr>
    ${jpRows}
  </table>`;

  /* Pre-Run Measurements (Generator): Battery + Offload Voltage */
  const preRunGen = `
  <table style="table-layout:fixed;width:100%;margin-bottom:2px">
    <colgroup>
      <col style="width:32%"><col style="width:10%"><col style="width:10%"><col style="width:10%">
      <col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:8%">
    </colgroup>
    <tr class="sub">
      <th style="text-align:left">หัวข้อที่ทำการวัดค่า</th>
      <th colspan="6" class="val">ค่าที่บันทึกได้</th>
      <th>หมายเหตุ</th>
    </tr>
    <tr><td>แรงดันแบตเตอรี่</td><td colspan="6" class="val">${v(r.batteryVoltage)}</td><td></td></tr>
    <tr class="sub"><td colspan="8" style="text-align:center">ค่าแรงดัน Off Load (Volt)</td></tr>
    <tr class="sub">
      <td></td>
      <th class="val">L1-N</th><th class="val">L2-N</th><th class="val">L3-N</th>
      <th class="val">L1-L2</th><th class="val">L2-L3</th><th class="val">L1-L3</th>
      <td></td>
    </tr>
    <tr>
      <td>Phase to Neutral / Phase to Phase</td>
      <td class="val">${v(el.offload_L1N)}</td><td class="val">${v(el.offload_L2N)}</td><td class="val">${v(el.offload_L3N)}</td>
      <td class="val">${v(el.offload_L1L2)}</td><td class="val">${v(el.offload_L2L3)}</td><td class="val">${v(el.offload_L1L3)}</td>
      <td></td>
    </tr>
  </table>`;

  /* Test-Run rows — ลำดับตรงตาม field-map row numbers */
  const testRunFp = [
    ['ความเร็วรอบของเครื่องยนต์',                    v(t.rpm),             'Rpm',    ''],
    ['แรงดันน้ำมันเครื่อง',                          v(t.oilPressure),     'Psi',    ''],
    ['แรงดันน้ำระบายความร้อน',                       v(t.coolingPressure), 'Psi',    ''],
    ['อุณหภูมิน้ำหล่อเย็นและเครื่องทำงาน 10 นาที', v(t.coolantTemp),     '°C',     '( ไม่ควรเกิน 90 °C )'],
    ['แรงดันน้ำในระบบ',                              v(t.systemPressure),  'Psi',    'ทดสอบปิด Valve ใหญ่'],
    ['อัตราการใช้เชื้อเพลิงต่อครั้ง',               v(t.fuelConsumption), 'Liters', ''],
  ];
  const testRunGen = [
    ['ความเร็วรอบของเครื่องยนต์', v(t.rpm),            'Rpm',   ''],
    ['แรงดันน้ำมันเครื่อง',       v(t.oilPressure),    'Psi',   ''],
    ['อุณหภูมิน้ำหล่อเย็น',      v(t.coolantTemp),    '°C',    ''],
    ['แรงดันชาร์จแบตเตอรี่',     v(t.chargeVoltage),  'Volt',  ''],
    ['ความถี่ไฟฟ้า',             v(t.frequency),      'Hz',    ''],
    ['อัตราการใช้เชื้อเพลิง',    v(t.fuelConsumption),'Liters',''],
  ];
  const testRunDataRows = (isFp ? testRunFp : testRunGen)
    .map(([lbl, val, unit, rem]) =>
      `<tr><td>${lbl}</td><td class="val">${val}</td><td class="val">${unit}</td><td class="chk val">☐</td><td>${rem}</td></tr>`)
    .join('');

  const afterRunLabel = isFp
    ? '3. After-Run &nbsp;&nbsp;&nbsp; (FirePump Auto Start : 110 psi. / Jockey Pump Start : 140 psi. Stop : 162 psi.)'
    : '3. After-Run';

  const approverImg = approverSigB64
    ? `<img src="data:image/png;base64,${approverSigB64}" style="height:34px;display:block;margin:0 auto 2px">`
    : '';

  return `
<div class="page">
  ${header(machineInfo, data, logoB64, 'Sheet 2/2')}

  <!-- 1. Pre-Run Visual Inspection -->
  <table style="table-layout:fixed;width:100%;margin-bottom:2px">
    <colgroup>
      <col style="width:4%"><col style="width:45%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:24%">
    </colgroup>
    <tr><td colspan="6" class="shdr">1. Pre-Run Visual Inspection</td></tr>
    <tr class="sub">
      <th class="val">#</th>
      <th style="text-align:left">รายการตรวจสอบ</th>
      <th class="val">ปกติ</th>
      <th class="val">ผิดปกติ</th>
      <th class="val">ไม่มี</th>
      <th>หมายเหตุ</th>
    </tr>
    ${items1.map((item, i) => {
      const res = (data.preRunVisual || [])[i] || {};
      return `<tr>
        <td class="val">${i + 1}</td>
        <td>${item.text}</td>
        <td class="chk val">${normBox(res.result)}</td>
        <td class="chk val">${abnBox(res.result)}</td>
        <td class="chk val">${noneBox(res.result)}</td>
        <td>${res.remark || ''}</td>
      </tr>`;
    }).join('')}
  </table>

  <!-- Pre-Run Measurements -->
  ${isFp ? preRunFp : preRunGen}

  <!-- 2. Test-Run -->
  <table style="table-layout:fixed;width:100%;margin-bottom:2px">
    ${CG5}
    <tr><td colspan="5" class="shdr">2. Test-Run</td></tr>
    <tr class="sub">
      <th rowspan="2" style="text-align:left">หัวข้อที่ทำการวัดค่า</th>
      <th colspan="3" class="val">ค่าที่บันทึกได้</th>
      <th rowspan="2">หมายเหตุ</th>
    </tr>
    <tr class="sub"><th class="val">ค่า</th><th class="val">หน่วย</th><th class="val">สภาพปกติ</th></tr>
    <tr class="sub"><td colspan="5" style="text-align:center">Engine</td></tr>
    ${testRunDataRows}
  </table>

  <!-- 3. After-Run + Anothers -->
  <table style="width:100%;margin-bottom:2px">
    <tr><td colspan="2" class="shdr">${afterRunLabel}</td></tr>
    <tr>
      <td style="width:15%;font-weight:bold;vertical-align:top;padding:3px 4px">Anothers :</td>
      <td style="white-space:pre-line;vertical-align:top;padding:3px 4px">${a.comment || ''}</td>
    </tr>
    <tr><td colspan="2" style="height:18px;border-top:none"></td></tr>
    <tr><td colspan="2" style="height:18px;border-top:1px dotted #ccc"></td></tr>
    <tr><td colspan="2" style="height:18px;border-top:1px dotted #ccc"></td></tr>
  </table>

  <!-- Conclusion Result -->
  <table style="width:100%;margin-bottom:4px">
    <tr><td class="shdr">Conclusion Result :</td></tr>
    <tr><td style="white-space:pre-line;padding:2px 6px;min-height:30px">${conclusion}</td></tr>
  </table>

  <!-- ลายเซ็น -->
  <table style="margin-top:6px">
    <tr>
      <td class="nb" style="width:50%;text-align:center;padding-top:8px">
        <div style="border-top:1px solid #000;display:inline-block;width:72%;padding-top:3px">
          <div>ผู้ตรวจสอบ</div>
          <div style="font-weight:bold;margin:2px 0">${a.inspectedBy || '( ………………………………… )'}</div>
          <div>วันที่ ${inspDate}</div>
        </div>
      </td>
      <td class="nb" style="width:50%;text-align:center;padding-top:8px">
        <div style="border-top:1px solid #000;display:inline-block;width:72%;padding-top:3px">
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
