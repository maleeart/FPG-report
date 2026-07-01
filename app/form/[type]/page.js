'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const BUILDINGS = [
  'ท.0006','ท.0007','ท.0008','ท.0009','ท.0010',
  'ท.0011','ท.0012','ท.0014','ท.0015','ท.0016',
  'ท.0017','ท.0018','ท.0019','ท.0020','ท.0022',
  'ท.0023','ท.0026','ท.0027','ท.0028','ท.0029',
  'ต.0017','ต.0019','ต.0025','ต.0026','ต.0031','ต.0033',
];

// ─── Config per type ──────────────────────────────────────────────────────────
const FORM_CONFIG = {
  emergency: {
    title: 'Emergency Light',
    icon: '💡',
    color: '#16a34a',
    idLabel: 'ID / รหัสอุปกรณ์',
    idKey: 'id',
    fields: [
      { key: 'lightCondition', label: 'สภาพโคม',    opts: [{ v: 'pass',   l: 'ผ่าน',    c: '#16a34a' }, { v: 'fail',        l: 'ไม่ผ่าน',  c: '#dc2626' }] },
      { key: 'statusLight',   label: 'ไฟสถานะ',    opts: [{ v: 'normal', l: 'ปกติ',    c: '#16a34a' }, { v: 'abnormal',    l: 'ผิดปกติ',  c: '#dc2626' }] },
      { key: 'testResult',    label: 'ผลการ Test',  opts: [{ v: 'on',     l: 'ติด',     c: '#16a34a' }, { v: 'off',         l: 'ดับ',      c: '#dc2626' }] },
    ],
  },
  smoke: {
    title: 'Smoke Detector',
    icon: '🚨',
    color: '#0e7490',
    idLabel: 'Zone / Address',
    idKey: 'zone',
    fields: [
      { key: 'externalCondition', label: 'สภาพภายนอก',   opts: [{ v: 'normal', l: 'ปกติ',    c: '#16a34a' }, { v: 'dirty',       l: 'สกปรก',    c: '#dc2626' }] },
      { key: 'cleaned',           label: 'ถอดทำความสะอาด', opts: [{ v: 'yes',    l: 'ถอดแล้ว', c: '#16a34a' }, { v: 'no',          l: 'ไม่ถอด',   c: '#dc2626' }] },
      { key: 'workingCondition',  label: 'สภาพการทำงาน', opts: [{ v: 'normal', l: 'ปกติ',    c: '#16a34a' }, { v: 'not_working', l: 'ไม่ทำงาน', c: '#dc2626' }] },
    ],
  },
};

function makeDevice(cfg) {
  const d = { location: '', remarks: '' };
  d[cfg.idKey] = '';
  cfg.fields.forEach(f => { d[f.key] = f.opts[0].v; });
  return d;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FormPage() {
  const { type } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cfg = FORM_CONFIG[type];

  const today = new Date().toISOString().slice(0, 10);
  const date = searchParams.get('date') || today;
  const DRAFT_KEY = `form:${type}:${date}`;

  const [step, setStep] = useState(0); // 0=เลือกอาคาร, 1=ข้อมูลทั่วไป, 2=อุปกรณ์, 3=ยืนยัน
  const [general, setGeneral] = useState({
    inspectionDate: date, building: '', floor: '', inspector: '', model: '', serial: '', mfg: '',
  });
  const [devices, setDevices] = useState([makeDevice(cfg || FORM_CONFIG.emergency)]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [prefilledFrom, setPrefilledFrom] = useState(null); // ข้อความรอบที่ดึงมาเติมให้ (แสดงใน step อุปกรณ์)
  const [floorTemplates, setFloorTemplates] = useState([]); // รายการไฟล์เก่าของอาคารนี้ (ล่าสุดต่อชั้น) ให้เลือก
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const [checkingTemplates, setCheckingTemplates] = useState(false);
  const draftRef = useRef(null);

  if (!cfg) return <main style={{ padding: 40 }}>ไม่รู้จักประเภทฟอร์มนี้</main>;

  // restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.general) setGeneral(d.general);
        if (d.devices?.length) setDevices(d.devices);
      }
    } catch {}
  }, []);

  // กดถัดไปจากหน้าเลือกอาคาร — เช็คไฟล์เก่าของอาคารนี้ก่อน (ตึกเดียวมีได้หลายชั้น = หลายไฟล์)
  // ถ้าเจอ ให้เลือกเองว่าจะเอา template จากชั้นไหน แทนที่จะเดาให้อัตโนมัติ
  const handleBuildingNext = async () => {
    if (!general.building?.trim()) {
      setValidationError('กรุณาเลือกอาคารก่อน');
      return;
    }
    setValidationError(null);
    setCheckingTemplates(true);
    try {
      const { dates } = await fetch('/api/inspections').then(r => r.json());
      const matches = (dates || [])
        .filter(x => x.type === type && x.building === general.building)
        .sort((a, b) => b.date.localeCompare(a.date));
      // เก็บไฟล์ล่าสุดไว้ต่อชั้นเดียว (ตึกเดียวมีหลายชั้น = หลายไฟล์)
      const seenFloors = new Set();
      const byFloor = matches.filter(m => {
        const key = m.floor || '';
        if (seenFloors.has(key)) return false;
        seenFloors.add(key);
        return true;
      });
      if (byFloor.length) {
        setFloorTemplates(byFloor);
        setShowTemplatePopup(true);
      } else {
        setStep(1); // ไม่พบไฟล์เก่า ไปกรอกข้อมูลทั่วไปตามปกติ
      }
    } catch {
      setStep(1); // ดึงข้อมูลไม่สำเร็จ ให้กรอกเองตามปกติ
    } finally {
      setCheckingTemplates(false);
    }
  };

  // ผู้ใช้เลือก template จาก popup (หรือเลือก "เริ่มใหม่" → tmpl = null)
  const applyTemplate = async (tmpl) => {
    setShowTemplatePopup(false);
    if (!tmpl) { setStep(1); return; } // เริ่มใหม่ → กรอกข้อมูลทั่วไปเอง
    try {
      const rec = await fetch(`/api/inspections?filename=${encodeURIComponent(tmpl.filename)}`).then(r => r.json());
      const prevDevices = rec.records?.devices || [];
      const prevGeneral = rec.records?.general || {};
      setGeneral(g => ({
        ...g,
        floor:  tmpl.floor || prevGeneral.floor || '',
        model:  prevGeneral.model  || '',
        serial: prevGeneral.serial || '',
        mfg:    prevGeneral.mfg    || '',
      }));
      if (prevDevices.length) {
        setDevices(prevDevices.map(d => {
          const nd = makeDevice(cfg);
          nd[cfg.idKey] = d[cfg.idKey] || '';
          nd.location = d.location || '';
          return nd;
        }));
      }
      setPrefilledFrom(`${tmpl.floor ? 'ชั้น ' + tmpl.floor + ' · ' : ''}${tmpl.date}`);
      setStep(2); // ใช้ template แล้ว ข้ามหน้าข้อมูลทั่วไป ไปตรวจอุปกรณ์ได้เลย
    } catch {
      setStep(1); // โหลด template ไม่สำเร็จ ให้กรอกเอง
    }
  };

  // autosave draft
  useEffect(() => {
    clearTimeout(draftRef.current);
    draftRef.current = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ general, devices })); } catch {}
    }, 600);
    return () => clearTimeout(draftRef.current);
  }, [general, devices]);

  // ── Device helpers ──────────────────────────────────────────────────────────
  const addDevice = () => {
    if (devices.length >= 30) return;
    const prev = devices[devices.length - 1];
    const next = makeDevice(cfg);
    // inherit id/zone from previous device for convenience
    if (prev) next[cfg.idKey] = prev[cfg.idKey];
    setDevices(d => [...d, next]);
  };
  const removeDevice = idx => setDevices(d => d.filter((_, i) => i !== idx));
  const updateDevice = (idx, key, val) =>
    setDevices(d => d.map((dev, i) => i === idx ? { ...dev, [key]: val } : dev));

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!general.inspector?.trim()) {
      setValidationError('กรุณากรอกชื่อผู้ตรวจสอบก่อน');
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saveDate = general.inspectionDate || date;
      const building = general.building || '';
      const floor    = general.floor    || '';

      // save to GitHub
      await fetch('/api/save-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: saveDate, type, building, floor, records: { general, devices } }),
      });

      localStorage.removeItem(DRAFT_KEY);

      // redirect to home — user downloads Excel from History via GET (mobile-compatible)
      router.push(`/?saved=${saveDate}`);
    } catch (err) {
      setSubmitError(String(err.message || err));
      setSubmitting(false);
    }
  };

  const accentColor = cfg.color;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="root">
      {/* Header */}
      <header className="header" style={{ borderBottom: `3px solid ${accentColor}` }}>
        <button className="back-btn" onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/')}>‹</button>
        <div>
          <h1 className="title">{cfg.icon} {cfg.title}</h1>
          <p className="subtitle">
            {general.inspectionDate || date}
            {step > 0 && general.building ? ` · ${general.building}` : ''}
            {' · '}{step === 0 ? 'เลือกอาคาร' : step === 1 ? 'ข้อมูลทั่วไป' : step === 2 ? `อุปกรณ์ ${devices.length} รายการ` : 'ยืนยัน'}
          </p>
        </div>
      </header>

      {/* Popup — เลือก template จากไฟล์เก่าของอาคารนี้ (แยกตามชั้น) */}
      {showTemplatePopup && (
        <div className="overlay" onClick={() => applyTemplate(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <span className="modal__icon">📋</span>
            <h2 className="modal__title">พบข้อมูลเก่าของอาคารนี้</h2>
            <p className="modal__msg">เลือกชั้นที่ต้องการดึงรายการอุปกรณ์มาเติมให้ (สถานะจะรีเซ็ตให้ตรวจใหม่)</p>
            <div className="template-list">
              {floorTemplates.map(t => (
                <button key={t.filename} className="modal__close template-opt" onClick={() => applyTemplate(t)}>
                  {t.floor ? `ชั้น ${t.floor}` : '(ไม่ระบุชั้น)'} · {t.date}
                </button>
              ))}
            </div>
            <button className="modal__close" onClick={() => applyTemplate(null)}>เริ่มใหม่ (ไม่ใช้ template)</button>
          </div>
        </div>
      )}

      {/* Step 0 — เลือกอาคาร */}
      {step === 0 && (
        <section className="section">
          <Field label="วันที่ตรวจสอบ" value={general.inspectionDate}
            onChange={v => setGeneral(g => ({ ...g, inspectionDate: v }))} type="date" />
          <div className="field-row">
            <label className="field-label">อาคาร</label>
            <select className="field-select"
              value={general.building}
              onChange={e => { setGeneral(g => ({ ...g, building: e.target.value })); setValidationError(null); }}>
              <option value="">-- เลือกอาคาร --</option>
              {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {validationError && <p className="validation-err">{validationError}</p>}
          <button className="btn-next" style={{ background: accentColor }}
            disabled={checkingTemplates}
            onClick={handleBuildingNext}>
            {checkingTemplates ? 'กำลังตรวจสอบข้อมูลเก่า...' : 'ถัดไป'}
          </button>
        </section>
      )}

      {/* Step 1 — ข้อมูลทั่วไป (ข้ามถ้าใช้ template) */}
      {step === 1 && (
        <section className="section">
          <Field label="ชั้น" value={general.floor}
            onChange={v => setGeneral(g => ({ ...g, floor: v }))} placeholder="ชั้น / โซน" />
          <Field label="Model" value={general.model}
            onChange={v => setGeneral(g => ({ ...g, model: v }))} placeholder="รุ่น" />
          <Field label="Serial Number" value={general.serial}
            onChange={v => setGeneral(g => ({ ...g, serial: v }))} placeholder="S/N" />
          <Field label="MFG" value={general.mfg}
            onChange={v => setGeneral(g => ({ ...g, mfg: v }))} placeholder="ผู้ผลิต" />
          <button className="btn-next" style={{ background: accentColor }}
            onClick={() => setStep(2)}>
            ถัดไป → ตรวจสอบอุปกรณ์
          </button>
        </section>
      )}

      {/* Step 2 — Device List */}
      {step === 2 && (
        <section className="section">
          {prefilledFrom && (
            <p className="prefill-note">📋 ดึงรายการอุปกรณ์จากรอบล่าสุด ({prefilledFrom}) มาเติมให้ — ตรวจสอบและปรับผลใหม่</p>
          )}
          {devices.map((dev, idx) => (
            <div key={idx} className="device-card">
              <div className="device-header">
                <span className="device-num">#{idx + 1}</span>
                {devices.length > 1 && (
                  <button className="btn-remove" onClick={() => removeDevice(idx)}>✕</button>
                )}
              </div>
              <Field label={cfg.idLabel} value={dev[cfg.idKey]}
                onChange={v => updateDevice(idx, cfg.idKey, v)} placeholder={cfg.idLabel} />
              <Field label="ตำแหน่งติดตั้ง" value={dev.location}
                onChange={v => updateDevice(idx, 'location', v)} placeholder="ตำแหน่ง" />
              {cfg.fields.map(f => (
                <div key={f.key} className="field-row">
                  <label className="field-label">{f.label}</label>
                  <div className="toggle-group">
                    {f.opts.map(opt => (
                      <button key={opt.v}
                        className={`toggle-btn ${dev[f.key] === opt.v ? 'active' : ''}`}
                        style={dev[f.key] === opt.v ? { background: opt.c || accentColor, color: '#fff', borderColor: opt.c || accentColor } : {}}
                        onClick={() => updateDevice(idx, f.key, opt.v)}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Field label="หมายเหตุ" value={dev.remarks}
                onChange={v => updateDevice(idx, 'remarks', v)} placeholder="(ถ้ามี)" optional />
            </div>
          ))}

          {devices.length < 30 && (
            <button className="btn-add" onClick={addDevice}>+ เพิ่มอุปกรณ์</button>
          )}

          <button className="btn-next" style={{ background: accentColor }}
            onClick={() => setStep(3)}>
            ถัดไป → ยืนยัน
          </button>
        </section>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (() => {
        const firstField = cfg.fields[0];
        const passCount = devices.filter(d => d[firstField.key] === firstField.opts[0].v).length;
        const failCount = devices.length - passCount;
        const failDevices = devices.filter(d => d[firstField.key] !== firstField.opts[0].v);
        return (
          <section className="section confirm-section">
            <div className="confirm-icon">{cfg.icon}</div>
            <h2 className="confirm-title">{cfg.title}</h2>
            <p className="confirm-sub">วันที่ {general.inspectionDate || date}</p>

            <Field label="ผู้ตรวจสอบ" value={general.inspector}
              onChange={v => { setGeneral(g => ({ ...g, inspector: v })); setValidationError(null); }} placeholder="ชื่อผู้ตรวจสอบ" />

            {/* info summary */}
            <div className="confirm-info">
              <div className="ci-row"><span className="ci-key">อาคาร / ชั้น</span><span className="ci-val">{[general.building, general.floor].filter(Boolean).join(' / ') || '–'}</span></div>
            </div>

            <div className="confirm-stats">
              <div className="stat">
                <span className="stat-num">{devices.length}</span>
                <span className="stat-label">อุปกรณ์ทั้งหมด</span>
              </div>
              <div className="stat stat--pass">
                <span className="stat-num">{passCount}</span>
                <span className="stat-label">ปกติ / ผ่าน</span>
              </div>
              {failCount > 0 && (
                <div className="stat stat--fail">
                  <span className="stat-num">{failCount}</span>
                  <span className="stat-label">ไม่ผ่าน</span>
                </div>
              )}
            </div>

            {failDevices.length > 0 && (
              <div className="fail-list">
                <div className="fail-list-title">⚠ รายการที่ไม่ผ่าน / ผิดปกติ</div>
                {failDevices.map((d, i) => {
                  const idVal = d[cfg.idKey];
                  const badFields = cfg.fields.filter(f => f.opts[0].v !== d[f.key]);
                  return (
                    <div key={i} className="fail-item">
                      <span className="fail-id">{idVal || `#${devices.indexOf(d) + 1}`}</span>
                      <span className="fail-loc">{d.location || ''}</span>
                      <span className="fail-fields">{badFields.map(f => f.label).join(', ')}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {validationError && <p className="validation-err">{validationError}</p>}
            {submitError && <p className="error-msg">{submitError}</p>}
            <button className="btn-submit" style={{ background: accentColor }}
              disabled={submitting}
              onClick={handleSubmit}>
              {submitting ? '⏳ กำลังบันทึก...' : '✓ บันทึก'}
            </button>
            <button className="btn-back-edit" onClick={() => setStep(2)}>‹ แก้ไขรายการ</button>
          </section>
        );
      })()}

      <style jsx>{`
        .root { min-height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; }
        .header { display: flex; align-items: center; gap: 14px; padding: 18px 16px 14px; }
        .back-btn { background: none; border: none; font-size: 28px; cursor: pointer; color: var(--ink-primary); padding: 0 8px 0 0; line-height: 1; }
        .title { font-size: 18px; font-weight: 800; color: var(--ink-primary); margin: 0; }
        .subtitle { font-size: 12px; color: var(--ink-muted); margin: 2px 0 0; }

        .section { padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; }

        .field-row { display: flex; flex-direction: column; gap: 4px; }
        .field-label { font-size: 12px; font-weight: 600; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .field-select { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border-strong); background: var(--bg-surface-raised); color: var(--ink-primary); font-size: 15px; font-weight: 600; appearance: auto; }

        .toggle-group { display: flex; gap: 8px; }
        .toggle-btn { flex: 1; padding: 8px 4px; border: 1.5px solid var(--border-strong); border-radius: 10px; background: var(--bg-surface-raised); font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink-secondary); transition: all 0.12s; }

        .device-card { background: var(--bg-surface-raised); border: 1px solid var(--border-hairline); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .device-header { display: flex; justify-content: space-between; align-items: center; }
        .device-num { font-size: 13px; font-weight: 700; color: var(--ink-muted); }
        .btn-remove { background: none; border: none; font-size: 16px; color: var(--ink-muted); cursor: pointer; padding: 2px 6px; border-radius: 6px; }
        .btn-remove:hover { background: rgba(220,38,38,0.1); color: #dc2626; }

        .btn-add { padding: 12px; border: 2px dashed var(--border-strong); border-radius: 14px; background: none; font-size: 14px; font-weight: 600; color: var(--ink-secondary); cursor: pointer; }
        .btn-next { padding: 14px; border-radius: 14px; border: none; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer; }
        .btn-submit { padding: 16px; border-radius: 16px; border: none; font-size: 16px; font-weight: 700; color: #fff; cursor: pointer; width: 100%; }
        .btn-submit:disabled { opacity: 0.6; }
        .btn-back-edit { padding: 12px; border-radius: 14px; border: 1px solid var(--border-strong); background: var(--bg-surface-raised); font-size: 14px; font-weight: 600; color: var(--ink-secondary); cursor: pointer; }

        .confirm-section { align-items: center; gap: 12px; padding-top: 32px; }
        .confirm-icon { font-size: 56px; }
        .confirm-title { font-size: 22px; font-weight: 800; color: var(--ink-primary); margin: 0; }
        .confirm-sub { font-size: 14px; color: var(--ink-muted); margin: 0; }

        .confirm-info { width: 100%; background: var(--bg-surface-raised); border: 1px solid var(--border-hairline); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
        .ci-row { display: flex; justify-content: space-between; gap: 8px; }
        .ci-key { font-size: 12px; color: var(--ink-muted); flex-shrink: 0; }
        .ci-val { font-size: 12px; font-weight: 600; color: var(--ink-primary); text-align: right; }

        .confirm-stats { display: flex; gap: 20px; margin: 4px 0 4px; }
        .stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 16px; border-radius: 12px; background: var(--bg-surface-raised); border: 1px solid var(--border-hairline); }
        .stat--pass { background: var(--status-pass-bg); border-color: var(--status-pass); }
        .stat--fail { background: var(--status-fail-bg); border-color: var(--status-fail); }
        .stat-num { font-size: 28px; font-weight: 800; color: var(--ink-primary); line-height: 1; }
        .stat--pass .stat-num { color: var(--status-pass); }
        .stat--fail .stat-num { color: var(--status-fail); }
        .stat-label { font-size: 11px; color: var(--ink-muted); }

        .fail-list { width: 100%; background: var(--status-fail-bg); border: 1px solid var(--status-fail); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
        .fail-list-title { font-size: 12px; font-weight: 700; color: var(--status-fail); margin-bottom: 2px; }
        .fail-item { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; background: rgba(255,255,255,0.5); border-radius: 8px; }
        .fail-id { font-size: 13px; font-weight: 700; color: var(--ink-primary); }
        .fail-loc { font-size: 11px; color: var(--ink-muted); }
        .fail-fields { font-size: 11px; color: var(--status-fail); font-weight: 600; }

        .validation-err { color: var(--status-fail); font-size: 13px; font-weight: 600; background: var(--status-fail-bg); border-radius: 8px; padding: 8px 12px; margin: 0; }
        .prefill-note { color: var(--ink-muted); font-size: 12px; background: var(--bg-surface-raised); border: 1px solid var(--border-hairline); border-radius: 10px; padding: 8px 12px; margin: 0; }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 24px; }
        .modal { background: var(--bg-surface); border-radius: 24px; padding: 28px 22px; width: 100%; max-width: 320px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .modal__icon { font-size: 44px; }
        .modal__title { font-size: 18px; font-weight: 800; color: var(--ink-primary); margin: 0; }
        .modal__msg { font-size: 13px; color: var(--ink-secondary); margin: 0 0 6px; }
        .modal__close { width: 100%; padding: 12px; background: var(--bg-surface-raised); border: 1px solid var(--border-strong); border-radius: 12px; font-size: 14px; font-weight: 600; color: var(--ink-primary); cursor: pointer; }
        .template-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
        .template-opt { text-align: left; }
        .error-msg { color: var(--status-fail); font-size: 13px; text-align: center; }
      `}</style>
    </div>
  );
}

// ─── Reusable Field ───────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', optional }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{optional ? ' (ถ้ามี)' : ''}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1.5px solid var(--border-strong)',
          background: 'var(--bg-surface)',
          fontSize: 14,
          color: 'var(--ink-primary)',
          outline: 'none',
        }}
      />
    </div>
  );
}
