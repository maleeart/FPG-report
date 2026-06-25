import fieldMap from '../data/field-map.json';

const v = (val, unit = '') => {
  if (val === undefined || val === null || val === '') return '–';
  return unit ? `${val} ${unit}` : String(val);
};

const resultLabel = (r, type = 'fp') => {
  if (type === 'fp') {
    if (r === 'pass') return '<span style="color:#1a7f1a;font-weight:bold">✓ ผ่าน</span>';
    if (r === 'fail') return '<span style="color:#c00;font-weight:bold">✗ ไม่ผ่าน</span>';
    return '<span style="color:#888">–</span>';
  } else {
    if (r === 'normal') return '<span style="color:#1a7f1a;font-weight:bold">✓ ปกติ</span>';
    if (r === 'abnormal') return '<span style="color:#c00;font-weight:bold">✗ ผิดปกติ</span>';
    if (r === 'none') return '<span style="color:#888">ไม่มี</span>';
    return '<span style="color:#888">–</span>';
  }
};

function checklistTable(items, results = [], type = 'fp') {
  const rows = items.map((item, i) => {
    const r = results[i] || {};
    return `<tr>
      <td style="width:40px;text-align:center;color:#555">${i + 1}</td>
      <td>${item.text}</td>
      <td style="width:120px;text-align:center">${resultLabel(r.result, type)}</td>
      <td style="width:200px;color:#555">${r.remark || ''}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#f0f4ff">
      <th style="padding:6px 4px">#</th>
      <th style="padding:6px 4px;text-align:left">รายการตรวจสอบ</th>
      <th style="padding:6px 4px">ผล</th>
      <th style="padding:6px 4px;text-align:left">หมายเหตุ</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function infoRow(label, value) {
  return `<tr>
    <td style="width:220px;color:#555;padding:4px 8px">${label}</td>
    <td style="padding:4px 8px;font-weight:500">${value}</td>
  </tr>`;
}

function measureRow(label, value) {
  return `<tr>
    <td style="width:260px;color:#555;padding:3px 8px">${label}</td>
    <td style="padding:3px 8px;font-weight:500">${value}</td>
  </tr>`;
}

function section(title, content) {
  return `<div style="margin-bottom:20px">
    <h3 style="margin:0 0 8px;padding:6px 10px;background:#1a3a6b;color:#fff;font-size:14px;border-radius:4px">${title}</h3>
    ${content}
  </div>`;
}

export function generateFpgReportHtml(data, machineInfo) {
  const { generalData = {}, preVisual = [], preRunVisual = [], readings = {}, testRun = {}, afterRun = {} } = data;

  const isFp = machineInfo?.type === 'fire_pump';
  const tmpl = isFp ? fieldMap.firepump_template : fieldMap.generator_template;
  const items0 = tmpl?.sheet_visual_fields?.checklist_0_items || [];
  const items1 = tmpl?.sheet_data_fields?.checklist_1_items || [];

  const machineName = machineInfo?.label_th || machineInfo?.label || machineInfo?.id || 'เครื่อง';
  const location = generalData.location || machineInfo?.location_default || '–';
  const inspDate = data.inspectionDate ? new Date(data.inspectionDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '–';

  const conclusion = (afterRun.conclusionText && afterRun.conclusionText.trim())
    ? afterRun.conclusionText
    : (tmpl?.sheet_data_fields?.conclusion_default || []).join('\n');

  // Reading rows — fire pump vs generator differ
  const readingRows = isFp ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${measureRow('ความดันน้ำระบบ (ก่อน run)', v(readings.engine_system_water_pressure, 'bar'))}
      ${measureRow('แรงดันแบตเตอรี่ชุด 1', v(readings.battery_voltage_1, 'V'))}
      ${measureRow('แรงดันแบตเตอรี่ชุด 2', v(readings.battery_voltage_2, 'V'))}
      ${measureRow('แรงดัน Jockey L1-L2 / L2-L3 / L1-L3', `${v(readings.jockeyVoltage?.L1L2)} / ${v(readings.jockeyVoltage?.L2L3)} / ${v(readings.jockeyVoltage?.L1L3)} V`)}
    </table>` : `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${measureRow('แรงดันแบตเตอรี่', v(readings.battery_voltage, 'V'))}
    </table>`;

  const testRunRows = isFp ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${measureRow('รอบเครื่องยนต์ (RPM)', v(testRun.rpm))}
      ${measureRow('ความดันน้ำมันเครื่อง', v(testRun.oil_pressure, 'PSI'))}
      ${measureRow('ความดันน้ำระบายความร้อน', v(testRun.cooling_water_pressure, 'PSI'))}
      ${measureRow('อุณหภูมิน้ำหล่อเย็น (10 นาที)', v(testRun.coolant_temp_10min, '°C'))}
      ${measureRow('ความดันน้ำในระบบ', v(testRun.system_water_pressure, 'PSI'))}
      ${measureRow('อัตราการสิ้นเปลืองน้ำมัน', v(testRun.fuel_consumption_per_run, 'L'))}
    </table>` : `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${measureRow('รอบเครื่องยนต์ (RPM)', v(testRun.rpm))}
      ${measureRow('ความดันน้ำมันเครื่อง', v(testRun.oil_pressure, 'PSI'))}
      ${measureRow('อุณหภูมิน้ำหล่อเย็น', v(testRun.coolant_temp, '°C'))}
      ${measureRow('แรงดันไฟฟ้า L1-L2 / L2-L3 / L1-L3', `${v(testRun.voltageL1L2)} / ${v(testRun.voltageL2L3)} / ${v(testRun.voltageL1L3)} V`)}
      ${measureRow('กระแสไฟฟ้า L1 / L2 / L3', `${v(testRun.currentL1)} / ${v(testRun.currentL2)} / ${v(testRun.currentL3)} A`)}
      ${measureRow('ความถี่', v(testRun.frequency, 'Hz'))}
    </table>`;

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Sarabun', 'TH SarabunPSK', sans-serif; font-size:14px; color:#1a1a1a; margin:0; padding:20px 30px; }
    h1 { font-size:20px; margin:0 0 4px; }
    h2 { font-size:16px; margin:0 0 16px; color:#444; font-weight:normal; }
    table { border-collapse:collapse; }
    tbody tr:nth-child(even) { background:#fafafa; }
    tbody td, tbody th { border:1px solid #ddd; }
    .sig-box { border-top:1px solid #999; margin-top:40px; padding-top:8px; text-align:center; font-size:12px; color:#555; }
    @media print { body { padding:10px 15px; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #1a3a6b">
    <div>
      <h1>รายงานการตรวจสอบ ${machineName}</h1>
      <h2>${location}</h2>
    </div>
    <div style="text-align:right;font-size:13px;color:#555">
      <div>วันที่ตรวจสอบ</div>
      <div style="font-size:15px;font-weight:bold;color:#1a1a1a">${inspDate}</div>
    </div>
  </div>

  ${section('ข้อมูลทั่วไป', `<table style="width:100%;border-collapse:collapse;font-size:13px">
    ${infoRow('สถานที่', v(location))}
    ${infoRow('รุ่น / Model', v(generalData.model))}
    ${infoRow('หมายเลขเครื่อง (Serial)', v(generalData.serialNumber))}
    ${infoRow('น้ำมันก่อน / หลัง (L)', `${v(generalData.fuelBefore)} / ${v(generalData.fuelAfter)}`)}
    ${infoRow('ชั่วโมงทำงานก่อน / หลัง (hr)', `${v(generalData.runningHoursBefore)} / ${v(generalData.runningHoursAfter)}`)}
    ${infoRow('ระยะเวลาทดสอบ (นาที)', v(generalData.runDurationMins))}
  </table>`)}

  ${section('การตรวจสอบเบื้องต้น (Visual Inspection)', checklistTable(items0, preVisual, 'fp'))}

  ${section('การตรวจสอบก่อนเดินเครื่อง (Pre-Run Visual)', checklistTable(items1, preRunVisual, 'run'))}

  ${section('ค่าที่บันทึกได้ก่อนเดินเครื่อง', readingRows)}

  ${section('ค่าที่บันทึกได้ขณะเดินเครื่อง (Test Run)', testRunRows)}

  ${section('หมายเหตุ / ข้อสังเกต', `<div style="white-space:pre-line;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:50px;font-size:13px">${afterRun.comment || '–'}</div>`)}

  ${section('สรุปผลการตรวจสอบ', `<div style="white-space:pre-line;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:40px;font-size:13px">${conclusion}</div>`)}

  <div style="display:flex;justify-content:space-around;margin-top:40px">
    <div style="text-align:center;width:40%">
      <div class="sig-box">
        <div style="margin-top:4px">ผู้ตรวจสอบ</div>
        <div style="font-weight:bold;margin-top:4px">${afterRun.inspectedBy || '...........................'}</div>
        <div style="color:#888">${inspDate}</div>
      </div>
    </div>
    <div style="text-align:center;width:40%">
      <div class="sig-box">
        <div style="margin-top:4px">ผู้อนุมัติ</div>
        <div style="font-weight:bold;margin-top:4px">${afterRun.approvedBy || '...........................'}</div>
        <div style="color:#888">${inspDate}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
