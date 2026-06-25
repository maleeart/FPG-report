'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';

const v = (val, unit = '') => {
  if (val === undefined || val === null || val === '') return '–';
  return unit ? `${val} ${unit}` : String(val);
};

// ─── Main loader ──────────────────────────────────────────────────────────────
function ReportInner() {
  const { filename } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [fieldMap, setFieldMap] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/inspections?filename=${encodeURIComponent(filename)}`).then(r => {
        if (!r.ok) throw new Error('ไม่พบข้อมูล (filename: ' + filename + ')');
        return r.json();
      }),
      fetch('/api/field-map').then(r => r.json()),
    ])
      .then(([d, fm]) => { setData(d); setFieldMap(fm); })
      .catch(err => setError(err.message));
  }, [filename]);

  if (error) return <div style={{ padding: 40, color: '#c03232', fontFamily: 'sans-serif' }}>❌ {error}</div>;
  if (!data || !fieldMap) return <div style={{ padding: 40, color: '#666', fontFamily: 'sans-serif' }}>กำลังโหลดข้อมูล...</div>;

  const isFpg = data.type === 'fpg';
  const typeLabel = isFpg ? 'Fire Pump & Generator' : data.type === 'emergency' ? 'Emergency Light' : 'Smoke Detector';

  return (
    <div className="rp-root">
      {/* toolbar — ซ่อนตอนพิมพ์ */}
      <div className="no-print toolbar">
        <button className="btn-back" onClick={() => router.back()}>‹ กลับ</button>
        <span className="toolbar-title">ตัวอย่างก่อนพิมพ์ · {typeLabel}</span>
        <button className="btn-print" onClick={() => window.print()}>📄 ออกรายงาน PDF (A4)</button>
      </div>

      <div className="rp-pages">
        {isFpg
          ? <FpgReport data={data} fieldMap={fieldMap} />
          : <ListReport data={data} fieldMap={fieldMap} />
        }
      </div>

      <style jsx global>{`
        /* ═══════════════ PRINT ═══════════════ */
        @media print {
          @page { size: A4 portrait; margin: 12mm 15mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            font-family: 'TH Sarabun New', 'Sarabun', 'Noto Sans Thai', sans-serif !important;
            font-size: 10pt !important;
            color: #000 !important;
            background: #fff !important;
            margin: 0 !important;
          }
          .no-print  { display: none !important; }
          .rp-root   { padding: 0 !important; background: none !important; }
          .rp-pages  { max-width: none !important; width: 100% !important; padding: 0 !important; }
          .page-break { page-break-before: always; }
          tr   { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .avoid-break { page-break-inside: avoid; }
        }

        /* ═══════════════ BASE ═══════════════ */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #c8c8c8; font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; color: #000; }
        .rp-root { min-height: 100vh; padding-top: 64px; }

        /* toolbar */
        .toolbar {
          position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 999;
          display: flex; align-items: center; gap: 12px; padding: 0 16px;
          background: #111827; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .toolbar-title { flex: 1; text-align: center; font-size: 13px; color: #9ca3af; }
        .btn-back {
          padding: 7px 14px; border-radius: 8px; border: 1px solid #374151;
          background: #1f2937; color: #d1d5db; font-size: 13px; cursor: pointer;
        }
        .btn-print {
          padding: 9px 18px; border-radius: 8px; border: none;
          background: #dc2626; color: #fff; font-size: 13px; font-weight: 700;
          cursor: pointer; white-space: nowrap;
        }
        .btn-print:hover { background: #b91c1c; }

        /* A4 page card */
        .rp-pages {
          max-width: 210mm; margin: 0 auto; padding: 16px 16px 60px;
          display: flex; flex-direction: column; gap: 0;
        }
        .a4-page {
          background: #fff; padding: 14mm 15mm;
          box-shadow: 0 4px 28px rgba(0,0,0,0.22);
          margin-bottom: 14px;
          color: #000;
        }
        @media print { .a4-page { box-shadow: none; padding: 0; margin: 0; } }

        /* ═══════════════ FORM ELEMENTS ═══════════════ */
        .form-header {
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 2.5px solid #000; padding-bottom: 6pt; margin-bottom: 8pt;
          gap: 8pt;
        }
        .form-header-logo { height: 48pt; width: auto; object-fit: contain; flex-shrink: 0; }
        @media print { .form-header-logo { height: 44pt !important; } }
        .form-header-center { flex: 1; display: flex; flex-direction: column; gap: 2pt; text-align: center; }
        .form-org   { font-size: 8pt;  color: #000; font-weight: 600; }
        .form-title { font-size: 14pt; color: #000; font-weight: 900; line-height: 1.2; }
        .form-sub   { font-size: 9pt;  color: #000; }
        .form-header-right { text-align: right; line-height: 1.8; flex-shrink: 0; }
        .form-date-label { font-size: 8pt;  color: #000; }
        .form-date-val   { font-size: 12pt; color: #000; font-weight: 800; }

        /* info table */
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; font-size: 9pt; color: #000; }
        .info-table td { border: 1px solid #333; padding: 3pt 6pt; vertical-align: middle; }
        .info-table .lbl { background: #e8e8e8; font-weight: 700; color: #000; white-space: nowrap; }
        @media print { .info-table .lbl { background: #e0e0e0 !important; } }

        /* section header bar */
        .sec-hd {
          background: #1a1a2e; color: #fff;
          font-size: 9.5pt; font-weight: 700;
          padding: 3pt 8pt; margin: 8pt 0 0; letter-spacing: 0.03em;
        }
        @media print { .sec-hd { background: #000 !important; color: #fff !important; } }

        /* checklist / readings table */
        .r-tbl { width: 100%; border-collapse: collapse; font-size: 8.5pt; color: #000; }
        .r-tbl th, .r-tbl td { border: 1px solid #444; padding: 3pt 5pt; vertical-align: middle; line-height: 1.4; }
        .r-tbl th { background: #e0e0e0; font-weight: 700; text-align: center; color: #000; }
        @media print { .r-tbl th { background: #d8d8d8 !important; } }
        .r-tbl td.c { text-align: center; }
        .r-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }

        /* result badges — สีเข้มพอพิมพ์ได้ชัด */
        .pass { color: #14532d; font-weight: 700; }
        .fail { color: #7f1d1d; font-weight: 700; }
        .norm { color: #14532d; font-weight: 700; }
        .abno { color: #7f1d1d; font-weight: 700; }
        .na   { color: #000; }

        /* conclusion + signature */
        .concl-box {
          border: 1px solid #444; padding: 5pt 8pt; min-height: 26pt;
          font-size: 9pt; color: #000; white-space: pre-wrap; line-height: 1.6; margin-bottom: 6pt;
        }
        .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-top: 6pt; }
        .sig-box { border: 1px solid #444; padding: 5pt 8pt; text-align: center; }
        .sig-box-lbl  { font-size: 8pt;  color: #000; font-weight: 600; margin-bottom: 2pt; }
        .sig-img      { height: 48pt; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
        @media print { .sig-img { height: 44pt !important; } }
        .sig-blank    { height: 48pt; width: 68%; margin: 0 auto; }
        .sig-line     { border-top: 1.5px solid #000; width: 80%; margin: 4pt auto 3pt; }
        .sig-name     { font-size: 9.5pt; color: #000; font-weight: 700; }
        .sig-role     { font-size: 8pt;   color: #000; }
        .sig-date     { font-size: 8pt;   color: #000; margin-top: 2pt; }

        /* ═══════════════ PHOTO PAGE ═══════════════ */
        .photo-header {
          border-bottom: 2px solid #000; padding-bottom: 5pt; margin-bottom: 10pt;
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .photo-header-title { font-size: 12pt; font-weight: 900; color: #000; }
        .photo-header-sub   { font-size: 9pt; color: #000; }
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8pt;
          align-items: start;
        }
        .photo-cell { display: flex; flex-direction: column; gap: 3pt; }
        .photo-cell img {
          width: 100%; aspect-ratio: 4/3; object-fit: cover;
          border: 1px solid #555; border-radius: 2pt;
          display: block;
        }
        .photo-caption {
          font-size: 7.5pt; color: #000; text-align: center;
          background: #f0f0f0; border: 1px solid #ccc; padding: 2pt 4pt; border-radius: 1pt;
        }
        @media print { .photo-caption { background: #ececec !important; } }
      `}</style>
    </div>
  );
}

// ─── FPG Report: 2 หน้าต่อเครื่อง (หน้า 1 = ข้อมูล, หน้า 2 = รูปประกอบ) ────
function FpgReport({ data, fieldMap }) {
  return (
    <>
      {fieldMap.machines.map((machine, mIdx) => {
        const rec = data.records?.[machine.id];
        if (!rec) return null;

        const isGen     = machine.type === 'generator';
        const tpl       = isGen ? fieldMap.generator_template : fieldMap.fire_pump_template;
        const preVisualItems = tpl.sheet_visual_fields.checklist_0_items || [];
        const preRunItems    = tpl.sheet_data_fields.checklist_1_items   || [];
        const g        = rec.generalData || {};
        const readings = rec.readings    || {};
        const testRun  = rec.testRun     || {};
        const afterRun = rec.afterRun    || {};
        const jp = readings.jockeyPump   || {};
        const el = readings.electrical   || {};
        const inspDate = rec.inspectionDate || data.date;
        const hasPhotos = machine.image_files?.length > 0;

        return (
          <div key={machine.id}>

            {/* ══════════════ หน้า 1 : ข้อมูลการตรวจสอบ ══════════════ */}
            <div className={`a4-page${mIdx > 0 ? ' page-break' : ''}`}>

              {/* header */}
              <div className="form-header">
                <img src="/assets/shared/egat-logo.jpg" alt="EGAT" className="form-header-logo" />
                <div className="form-header-center">
                  <span className="form-org">การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย · สำนักงานไทรน้อย</span>
                  <span className="form-title">{machine.label_th || machine.label}</span>
                  <span className="form-sub">{machine.label} · {machine.location_default}</span>
                </div>
                <div className="form-header-right">
                  <div className="form-date-label">วันที่ตรวจสอบ</div>
                  <div className="form-date-val">{inspDate}</div>
                </div>
              </div>

              {/* machine info */}
              <table className="info-table">
                <tbody>
                  <tr>
                    <td className="lbl">Model</td><td>{machine.model_default}</td>
                    <td className="lbl">Serial No.</td><td>{machine.serial_default}</td>
                    <td className="lbl">ผู้ผลิต</td><td>{machine.mfg_default}</td>
                  </tr>
                  <tr>
                    {!isGen ? (
                      <><td className="lbl">น้ำมัน ก่อน/หลัง</td><td>{v(g.fuelBefore)} / {v(afterRun.fuelAfter)} L</td></>
                    ) : (
                      <><td className="lbl">จำนวนครั้งทำงาน</td><td>{v(g.runCount)} ครั้ง</td></>
                    )}
                    <td className="lbl">ชั่วโมง ก่อน/หลัง</td>
                    <td>{v(g.runningHoursBefore)} / {v(afterRun.runningHoursAfter)} Hrs</td>
                    <td className="lbl">เวลาเดินเครื่อง</td>
                    <td>{v(g.runDurationMins)} นาที</td>
                  </tr>
                </tbody>
              </table>

              {/* checklist 0 */}
              <div className="avoid-break">
                <div className="sec-hd">0. ตรวจสอบก่อนเข้าใช้งาน (Pre-Visual Checklist)</div>
                <table className="r-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ textAlign: 'left' }}>รายการ</th>
                      <th style={{ width: '13%' }}>ผลการตรวจ</th>
                      <th style={{ width: '24%' }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preVisualItems.map((item, i) => {
                      const e = (rec.preVisual || [])[i] || {};
                      return (
                        <tr key={i}>
                          <td className="c">{i + 1}</td>
                          <td>{item.text}</td>
                          <td className="c">
                            {e.result === 'pass' && <span className="pass">✓ ผ่าน</span>}
                            {e.result === 'fail' && <span className="fail">✗ ไม่ผ่าน</span>}
                            {!e.result && <span className="na">–</span>}
                          </td>
                          <td>{e.note || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* checklist 1 */}
              <div className="avoid-break">
                <div className="sec-hd">1. ตรวจสภาพก่อนเดินเครื่อง (Pre-Run Checklist)</div>
                <table className="r-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ textAlign: 'left' }}>รายการ</th>
                      <th style={{ width: '13%' }}>ผลการตรวจ</th>
                      <th style={{ width: '24%' }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preRunItems.map((item, i) => {
                      const e = (rec.preRunVisual || [])[i] || {};
                      return (
                        <tr key={i}>
                          <td className="c">{i + 1}</td>
                          <td>{item.text}</td>
                          <td className="c">
                            {e.result === 'normal'   && <span className="norm">✓ ปกติ</span>}
                            {e.result === 'abnormal' && <span className="abno">✗ ผิดปกติ</span>}
                            {e.result === 'na'       && <span className="na">ไม่มี</span>}
                            {!e.result && <span className="na">–</span>}
                          </td>
                          <td>{e.note || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* readings + test run */}
              <div className="avoid-break">
                <div className="sec-hd">2. ค่าที่บันทึกได้ระหว่าง Test-Run</div>
                <table className="r-tbl">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '38%' }}>รายการ</th>
                      <th style={{ width: '12%' }}>ค่า</th>
                      <th style={{ width: '8%' }}>หน่วย</th>
                      <th style={{ textAlign: 'left', width: '30%' }}>รายการ</th>
                      <th style={{ width: '12%' }}>ค่า</th>
                      <th style={{ width: '8%' }}>หน่วย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isGen ? (<>
                      <MRow a="แรงดันแบตเตอรี่"  av={readings.batteryVoltage} au="V"   b="ความเร็วรอบ"              bv={testRun.rpm}              bu="RPM" />
                      <MRow a="V Off-Load L1-N"   av={el.offload_L1N}          au="V"   b="แรงดันน้ำมันเครื่อง"      bv={testRun.oilPressure}      bu="Psi" />
                      <MRow a="V Off-Load L2-N"   av={el.offload_L2N}          au="V"   b="อุณหภูมิน้ำหล่อเย็น"     bv={testRun.coolantTemp}      bu="°C"  />
                      <MRow a="V Off-Load L3-N"   av={el.offload_L3N}          au="V"   b="แรงดันชาร์จแบต"           bv={testRun.chargeVoltage}    bu="V"   />
                      <MRow a="V Off-Load L1-L2"  av={el.offload_L1L2}         au="V"   b="ความถี่ไฟฟ้า"             bv={testRun.frequency}        bu="Hz"  />
                      <MRow a="V Off-Load L2-L3"  av={el.offload_L2L3}         au="V"   b="แรงดันน้ำในระบบ"          bv={testRun.systemPressure}   bu="Psi" />
                      <MRow a="V Off-Load L1-L3"  av={el.offload_L1L3}         au="V"   b="อัตราสิ้นเปลืองเชื้อเพลิง" bv={testRun.fuelConsumption} bu="L"  />
                      <MRow a="กระแส L1"           av={el.current_L1}           au="A"   b="" bv="" bu="" />
                      <MRow a="กระแส L2"           av={el.current_L2}           au="A"   b="" bv="" bu="" />
                      <MRow a="กระแส L3"           av={el.current_L3}           au="A"   b="" bv="" bu="" />
                    </>) : (<>
                      <MRow a="แรงดันน้ำในระบบ"       av={readings.waterPressure}   au="Psi" b="ความเร็วรอบ"               bv={testRun.rpm}              bu="RPM" />
                      <MRow a="แรงดันแบตเตอรี่ #1"    av={readings.battery1Voltage} au="V"   b="แรงดันน้ำมันเครื่อง"       bv={testRun.oilPressure}      bu="Psi" />
                      <MRow a="แรงดันแบตเตอรี่ #2"    av={readings.battery2Voltage} au="V"   b="แรงดันน้ำระบาย"            bv={testRun.coolingPressure}  bu="Psi" />
                      <MRow a="Jockey V L1-L2"         av={jp.voltageL1L2}           au="V"   b="อุณหภูมิน้ำหล่อเย็น"      bv={testRun.coolantTemp}      bu="°C"  />
                      <MRow a="Jockey V L2-L3"         av={jp.voltageL2L3}           au="V"   b="แรงดันน้ำในระบบ (ขณะเดิน)" bv={testRun.systemPressure}  bu="Psi" />
                      <MRow a="Jockey V L1-L3"         av={jp.voltageL1L3}           au="V"   b="อัตราสิ้นเปลืองเชื้อเพลิง" bv={testRun.fuelConsumption} bu="L"  />
                      <MRow a="Jockey A L1"            av={jp.currentL1}             au="A"   b="" bv="" bu="" />
                      <MRow a="Jockey A L2"            av={jp.currentL2}             au="A"   b="" bv="" bu="" />
                      <MRow a="Jockey A L3"            av={jp.currentL3}             au="A"   b="" bv="" bu="" />
                    </>)}
                  </tbody>
                </table>
              </div>

              {/* conclusion + signature */}
              <div className="avoid-break" style={{ marginTop: '8pt' }}>
                <div className="sec-hd">3. สรุปผลและลงชื่อผู้ตรวจสอบ</div>
                {afterRun.comment && (
                  <div className="concl-box" style={{ borderBottom: 'none', marginBottom: 0 }}>
                    <strong style={{ fontSize: '8pt' }}>หมายเหตุ / Remarks:</strong><br />{afterRun.comment}
                  </div>
                )}
                <div className="concl-box">
                  <strong style={{ fontSize: '8pt' }}>สรุปผล / Conclusion:</strong><br />
                  {afterRun.conclusionText || '–'}
                </div>
                <div className="sig-row">
                  {/* ── Inspector ── */}
                  <div className="sig-box">
                    <div className="sig-box-lbl">ลายเซ็นผู้ตรวจสอบ / Inspector Signature</div>
                    {afterRun.inspectorSignature
                      ? <img src={afterRun.inspectorSignature} alt="ลายเซ็นผู้ตรวจ" className="sig-img" />
                      : <div className="sig-blank" />
                    }
                    <div className="sig-line" />
                    <div className="sig-name">{v(afterRun.inspectedBy)}</div>
                    <div className="sig-role">ผู้ตรวจสอบ / Inspector</div>
                    <div className="sig-date">วันที่ {inspDate}</div>
                  </div>
                  {/* ── Approver (ใช้รูป default เสมอ) ── */}
                  <div className="sig-box">
                    <div className="sig-box-lbl">ลายเซ็นผู้อนุมัติ / Approver Signature</div>
                    <img
                      src="/assets/shared/signature-approver.png"
                      alt="ลายเซ็นผู้อนุมัติ"
                      className="sig-img"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="sig-line" />
                    <div className="sig-name">{v(afterRun.approvedBy) !== '–' ? v(afterRun.approvedBy) : 'ตวงเพชร'}</div>
                    <div className="sig-role">ผู้อนุมัติ / Approver</div>
                    <div className="sig-date">วันที่ {inspDate}</div>
                  </div>
                </div>
              </div>

            </div>{/* end หน้า 1 */}

            {/* ══════════════ หน้า 2 : รูปภาพประกอบ ══════════════ */}
            {hasPhotos && (
              <div className="a4-page page-break">
                <div className="photo-header">
                  <div>
                    <div className="photo-header-title">รูปภาพประกอบ — {machine.label_th || machine.label}</div>
                    <div className="photo-header-sub">{machine.label} · {machine.location_default} · วันที่ {inspDate}</div>
                  </div>
                  <div style={{ fontSize: '8pt', color: '#000', textAlign: 'right' }}>
                    การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย · สำนักงานไทรน้อย
                  </div>
                </div>

                <div className="photo-grid">
                  {machine.image_files.map((f, idx) => (
                    <div key={f} className="photo-cell">
                      <img
                        src={`/${machine.image_dir}/${f}`}
                        alt={`รูปที่ ${idx + 1}`}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="photo-caption">รูปที่ {idx + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        );
      })}
    </>
  );
}

// helper: แถวตารางค่าวัด 2 ฝั่ง
function MRow({ a, av, au, b, bv, bu }) {
  const fmtVal = x => (x !== undefined && x !== null && x !== '') ? x : '–';
  return (
    <tr>
      <td>{a}</td>
      <td className="r">{fmtVal(av)}</td>
      <td className="c">{au}</td>
      <td>{b}</td>
      <td className="r">{b ? fmtVal(bv) : ''}</td>
      <td className="c">{bu}</td>
    </tr>
  );
}

// ─── Emergency / Smoke List Report ───────────────────────────────────────────
function ListReport({ data, fieldMap }) {
  const { general = {}, devices = [] } = data.records || {};
  const isEmer  = data.type === 'emergency';
  const title   = isEmer ? 'รายงานตรวจสอบไฟฉุกเฉิน (Emergency Light)' : 'รายงานตรวจสอบ Smoke Detector';
  const passCount = devices.filter(d =>
    isEmer ? d.lightCondition === 'pass' : d.externalCondition === 'normal'
  ).length;

  return (
    <div className="a4-page">
      <div className="form-header">
        <img src="/assets/shared/egat-logo.jpg" alt="EGAT" className="form-header-logo" />
        <div className="form-header-center">
          <span className="form-org">การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย · สำนักงานไทรน้อย</span>
          <span className="form-title">{title}</span>
        </div>
        <div className="form-header-right">
          <div className="form-date-label">วันที่ตรวจสอบ</div>
          <div className="form-date-val">{general.inspectionDate || data.date}</div>
        </div>
      </div>

      <table className="info-table" style={{ marginBottom: '8pt' }}>
        <tbody>
          <tr>
            <td className="lbl">ผู้ตรวจสอบ</td><td>{general.inspector || '–'}</td>
            <td className="lbl">อาคาร</td><td>{general.building || '–'}</td>
            <td className="lbl">ชั้น / โซน</td><td>{general.floor || '–'}</td>
          </tr>
          <tr>
            <td className="lbl">Model</td><td>{general.model || '–'}</td>
            <td className="lbl">Serial No.</td><td>{general.serial || '–'}</td>
            <td className="lbl">ผู้ผลิต</td><td>{general.mfg || '–'}</td>
          </tr>
        </tbody>
      </table>

      {/* summary */}
      <div style={{ display: 'flex', gap: '8pt', marginBottom: '8pt', fontSize: '9pt' }}>
        <span style={{ border: '1px solid #14532d', borderRadius: '4pt', padding: '3pt 10pt', color: '#14532d', fontWeight: 700 }}>
          ปกติ / ผ่าน: {passCount} จุด
        </span>
        {devices.length - passCount > 0 && (
          <span style={{ border: '1px solid #7f1d1d', borderRadius: '4pt', padding: '3pt 10pt', color: '#7f1d1d', fontWeight: 700 }}>
            ไม่ผ่าน: {devices.length - passCount} จุด
          </span>
        )}
        <span style={{ border: '1px solid #444', borderRadius: '4pt', padding: '3pt 10pt', color: '#000' }}>
          รวม: {devices.length} จุด
        </span>
      </div>

      {isEmer ? (
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>#</th>
              <th style={{ width: '14%' }}>รหัส / ID</th>
              <th style={{ textAlign: 'left' }}>ตำแหน่งติดตั้ง</th>
              <th style={{ width: '11%' }}>สภาพโคม</th>
              <th style={{ width: '11%' }}>ไฟสถานะ</th>
              <th style={{ width: '11%' }}>ผล Test</th>
              <th style={{ width: '18%' }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr key={i}>
                <td className="c">{i + 1}</td>
                <td className="c">{d.id || '–'}</td>
                <td>{d.location || '–'}</td>
                <td className="c">{d.lightCondition  === 'pass'   ? <span className="pass">✓ ผ่าน</span>  : <span className="fail">✗ ไม่ผ่าน</span>}</td>
                <td className="c">{d.statusLight     === 'normal' ? <span className="norm">ปกติ</span>     : <span className="abno">ผิดปกติ</span>}</td>
                <td className="c">{d.testResult      === 'on'     ? <span className="pass">ติด</span>      : <span className="fail">ดับ</span>}</td>
                <td>{d.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="r-tbl">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>#</th>
              <th style={{ width: '16%' }}>Zone / Address</th>
              <th style={{ textAlign: 'left' }}>ตำแหน่งติดตั้ง</th>
              <th style={{ width: '13%' }}>สภาพภายนอก</th>
              <th style={{ width: '13%' }}>ทำความสะอาด</th>
              <th style={{ width: '13%' }}>สภาพการทำงาน</th>
              <th style={{ width: '16%' }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr key={i}>
                <td className="c">{i + 1}</td>
                <td className="c">{d.zone || '–'}</td>
                <td>{d.location || '–'}</td>
                <td className="c">{d.externalCondition === 'normal'     ? <span className="norm">ปกติ</span>      : <span className="abno">สกปรก</span>}</td>
                <td className="c">{d.cleaned           === 'yes'        ? <span className="pass">✓ ทำแล้ว</span> : <span className="fail">ไม่ทำ</span>}</td>
                <td className="c">{d.workingCondition  === 'normal'     ? <span className="norm">ปกติ</span>      : <span className="abno">ไม่ทำงาน</span>}</td>
                <td>{d.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: 'sans-serif', color: '#666' }}>กำลังโหลด...</div>}>
      <ReportInner />
    </Suspense>
  );
}
