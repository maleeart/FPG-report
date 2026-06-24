'use client';
import { Suspense } from 'react';

/**
 * /session — หน้าตรวจสอบแบบต่อเนื่องทุกเครื่อง
 *
 * Flow:
 *  FP#1 (step 0-5) → FP#2 (step 0-5) → FP#3 (step 0-5) → GEN#1 (step 0-5)
 *  → บันทึก+ดาวน์โหลดรวม → กลับหน้าหลัก
 *
 * Draft: localStorage `session:<date>` เก็บข้อมูลทุกเครื่องพร้อมกัน
 *        ถ้าเปิดหน้านี้ใหม่ กู้คืน draft อัตโนมัติ
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChecklistSection from '../components/ChecklistSection';
import NumericField from '../components/NumericField';
import TextField from '../components/TextField';
import SignaturePad from '../components/SignaturePad';
import GaugeProgress from '../components/GaugeProgress';
import ReferencePhotos from '../components/ReferencePhotos';
import { buildEmptyFormData, getMachineTemplate } from '../lib/formSchema';

const MACHINE_STEPS = 6; // steps per machine

function SessionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const DRAFT_KEY = `session:${date}`;

  const [fieldMap, setFieldMap] = useState(null);
  const [records, setRecords] = useState({});   // { machineId: formData }
  const [machineIdx, setMachineIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState(null);
  const saveTimerRef = useRef(null);

  // โหลด field-map
  useEffect(() => {
    fetch('/api/field-map').then(r => r.json()).then(setFieldMap).catch(console.error);
  }, []);

  // init / restore draft
  useEffect(() => {
    if (!fieldMap) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setRecords(saved.records || {});
        setMachineIdx(saved.machineIdx || 0);
        setStepIdx(saved.stepIdx || 0);
        return;
      }
    } catch {}
    // fresh start
    const fresh = {};
    for (const m of fieldMap.machines) {
      fresh[m.id] = buildEmptyFormData(fieldMap, m.id, date);
    }
    setRecords(fresh);
  }, [fieldMap]);

  // autosave draft ทุกครั้งที่ records/machineIdx/stepIdx เปลี่ยน
  useEffect(() => {
    if (!fieldMap || Object.keys(records).length === 0) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ records, machineIdx, stepIdx, savedAt: Date.now() }));
      } catch {}
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [records, machineIdx, stepIdx, fieldMap]);

  if (!fieldMap || Object.keys(records).length === 0) {
    return <main style={{ padding: 40, color: 'var(--ink-muted)' }}>กำลังโหลด...</main>;
  }

  const machines = fieldMap.machines;
  const totalMachines = machines.length;
  const currentMachine = machines[machineIdx];
  const currentData = records[currentMachine?.id] || {};
  const { tpl, isGen } = getMachineTemplate(fieldMap, currentMachine?.id) || {};

  const isLastMachine = machineIdx === totalMachines - 1;
  const isLastStep = stepIdx === MACHINE_STEPS - 1;
  const isVeryLast = isLastMachine && isLastStep;

  // progress overall
  const totalSteps = totalMachines * MACHINE_STEPS;
  const doneSteps = machineIdx * MACHINE_STEPS + stepIdx;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  const updateCurrentData = (updated) => {
    setRecords(prev => ({ ...prev, [currentMachine.id]: updated }));
  };

  const goNext = () => {
    if (isVeryLast) { handleFinalSubmit(); return; }
    if (isLastStep) {
      setMachineIdx(i => i + 1);
      setStepIdx(0);
    } else {
      setStepIdx(i => i + 1);
    }
  };

  const goPrev = () => {
    if (stepIdx > 0) {
      setStepIdx(i => i - 1);
    } else if (machineIdx > 0) {
      setMachineIdx(i => i - 1);
      setStepIdx(MACHINE_STEPS - 1);
    }
  };

  const isFirst = machineIdx === 0 && stepIdx === 0;

  const handleFinalSubmit = async () => {
    setSubmitState('submitting');
    setSubmitError(null);
    try {
      // บันทึกลง GitHub (best-effort)
      try {
        await fetch('/api/save-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, records, type: 'fpg' }),
        });
      } catch {}

      // ลบ draft
      localStorage.removeItem(DRAFT_KEY);
      // กลับหน้าหลัก — ให้ดาวน์โหลดไฟล์เองจากหน้าหลัก
      router.push(`/?saved=${date}`);
    } catch (err) {
      setSubmitError(String(err.message || err));
      setSubmitState('error');
    }
  };

  const visFields = tpl?.sheet_visual_fields;
  const dataFields = tpl?.sheet_data_fields;
  const preVisualItems = visFields?.checklist_0_items || [];
  const preRunItems = dataFields?.checklist_1_items || [];

  // label สำหรับ step ปัจจุบัน
  const stepTitles = [
    'ข้อมูลทั่วไป',
    '0. ตรวจสอบก่อนเข้าใช้งาน',
    '1. ตรวจสภาพก่อนเดินเครื่อง',
    'ค่าที่บันทึกได้',
    '2. Test-Run',
    '3. สรุปผล และลงชื่อ',
  ];

  const conclusionDefault = (dataFields?.conclusion_default || []).join('\n');

  return (
    <main className="page">
      {/* Header */}
      <header className="header">
        <button className="back-btn" onClick={() => router.push('/')}>‹</button>
        <div className="header-mid">
          <span className="machine-label">{currentMachine?.label}</span>
          <span className="step-label">{stepTitles[stepIdx]}</span>
        </div>
        <GaugeProgress percent={pct} label={`${machineIdx + 1}/${totalMachines}`} />
      </header>

      {/* Machine tabs */}
      <div className="machine-tabs">
        {machines.map((m, idx) => (
          <button key={m.id}
            className={`tab ${idx === machineIdx ? 'tab--active' : ''} ${idx < machineIdx ? 'tab--done' : ''}`}
            onClick={() => { setMachineIdx(idx); setStepIdx(0); }}>
            {idx < machineIdx ? '✓' : m.label.replace('Fire Pump', 'FP').replace('Generator', 'GEN')}
          </button>
        ))}
      </div>

      {/* Form body */}
      <section className="body">
        <h2 className="step-title">{stepTitles[stepIdx]}</h2>

        {stepIdx === 0 && (
          <GeneralStep
            data={currentData} setData={updateCurrentData}
            machine={currentMachine} isGen={isGen} />
        )}
        {stepIdx === 1 && (
          <ChecklistSection
            title="" items={preVisualItems.map(i => ({ label: i.text }))}
            values={currentData.preVisual || []} mode="2way"
            onChange={next => updateCurrentData({ ...currentData, preVisual: next })} />
        )}
        {stepIdx === 2 && (
          <ChecklistSection
            title="" items={preRunItems.map(i => ({ label: i.text }))}
            values={currentData.preRunVisual || []} mode="3way"
            onChange={next => updateCurrentData({ ...currentData, preRunVisual: next })} />
        )}
        {stepIdx === 3 && (
          <ReadingsStep data={currentData} setData={updateCurrentData} isGen={isGen} />
        )}
        {stepIdx === 4 && (
          <TestRunStep data={currentData} setData={updateCurrentData} isGen={isGen} />
        )}
        {stepIdx === 5 && (
          <AfterRunStep
            data={currentData} setData={updateCurrentData}
            isGen={isGen} conclusionDefault={conclusionDefault} />
        )}
      </section>

      {submitError && <p className="err-banner">{submitError}</p>}

      {/* Nav */}
      <nav className="nav">
        <button className="nav-btn nav-btn--ghost" onClick={goPrev} disabled={isFirst || submitState === 'submitting'}>
          ย้อนกลับ
        </button>
        <span className="nav-indicator">
          {machineIdx * MACHINE_STEPS + stepIdx + 1}/{totalSteps}
        </span>
        <button
          className={`nav-btn ${isVeryLast ? 'nav-btn--save' : 'nav-btn--primary'}`}
          onClick={goNext}
          disabled={submitState === 'submitting'}>
          {isVeryLast
            ? (submitState === 'submitting' ? 'กำลังบันทึก...' : '✓ บันทึกทั้งหมด')
            : (isLastStep ? `ไป ${machines[machineIdx + 1]?.label || ''}` : 'ถัดไป')}
        </button>
      </nav>

      <style jsx>{`
        .page { min-height:100dvh; display:flex; flex-direction:column; overflow-x:hidden; }

        .header {
          display:flex; align-items:center; gap:10px;
          padding:10px 14px; border-bottom:1px solid var(--border-hairline); flex-shrink:0;
        }
        .back-btn {
          background:none; border:none; color:var(--ink-muted);
          font-size:20px; cursor:pointer; padding:4px 6px; flex-shrink:0;
        }
        .header-mid { flex:1; min-width:0; }
        .machine-label {
          display:block; font-size:15px; font-weight:700; color:var(--ink-primary);
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .step-label { font-size:11px; color:var(--ink-muted); }

        /* Machine tabs */
        .machine-tabs {
          display:flex; padding:8px 14px; gap:6px; overflow-x:auto;
          border-bottom:1px solid var(--border-hairline); flex-shrink:0;
          -webkit-overflow-scrolling:touch;
        }
        .tab {
          flex-shrink:0; padding:5px 12px; border-radius:20px; font-size:12px;
          font-weight:600; border:1px solid var(--border-hairline); cursor:pointer;
          background:var(--bg-surface); color:var(--ink-muted);
          white-space:nowrap;
        }
        .tab--active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
        .tab--done { background:var(--status-pass-bg); color:var(--status-pass); border-color:var(--status-pass); }

        .body { flex:1; padding:14px 14px 140px; overflow-x:hidden; width:100%; box-sizing:border-box; }
        .step-title { font-size:16px; font-weight:700; margin:0 0 12px; }

        .err-banner { margin:0 14px 8px; padding:10px 12px;
          background:var(--status-fail-bg); color:var(--status-fail);
          border-radius:var(--radius-sm); font-size:13px; }

        .nav {
          position:sticky; bottom:0; display:flex; align-items:center;
          gap:8px; padding:10px 14px calc(10px + env(safe-area-inset-bottom));
          background:var(--bg-surface); border-top:1px solid var(--border-hairline);
        }
        .nav-indicator { font-family:var(--font-mono); font-size:12px; color:var(--ink-muted);
          flex-shrink:0; min-width:40px; text-align:center; }
        .nav-btn {
          min-height:46px; padding:0 14px; border-radius:var(--radius-md);
          font-size:14px; font-weight:600; cursor:pointer; border:none;
          -webkit-tap-highlight-color:transparent;
        }
        .nav-btn:disabled { opacity:0.4; }
        .nav-btn--ghost {
          background:transparent; color:var(--ink-secondary);
          border:1px solid var(--border-hairline); min-width:80px;
        }
        .nav-btn--primary { background:var(--accent); color:var(--accent-ink); flex:1; }
        .nav-btn--save { background:var(--status-pass); color:#fff; flex:1; }
      `}</style>
    </main>
  );
}

// ──────── Step Components ────────────────────────────────────────────────────

function GeneralStep({ data, setData, machine, isGen }) {
  const g = data.generalData || {};
  const upd = p => setData({ ...data, generalData: { ...g, ...p } });
  return (
    <div className="stack">
      <div className="machine-header">
        <strong>{machine.label}</strong>
        <span>{machine.location_default}</span>
      </div>
      <ReferencePhotos imageDir={machine.image_dir} imageFiles={machine.image_files} />
      <div className="badges">
        <div className="badge"><div className="bk">Model</div><div className="bv">{machine.model_default}</div></div>
        <div className="badge"><div className="bk">Serial</div><div className="bv">{machine.serial_default}</div></div>
      </div>
      <div className="r2">
        {!isGen
          ? <NumericField label="น้ำมัน (ก่อน)" unit="L" value={g.fuelBefore} onChange={v => upd({ fuelBefore: v })} />
          : <NumericField label="จำนวนครั้งทำงาน" unit="ครั้ง" value={g.runCount} onChange={v => upd({ runCount: v })} />
        }
        <NumericField label="ชม. (ก่อน)" unit="Hrs" value={g.runningHoursBefore} onChange={v => upd({ runningHoursBefore: v })} />
      </div>
      <NumericField label="ระยะเวลาเดินเครื่อง" unit="นาที" value={g.runDurationMins} onChange={v => upd({ runDurationMins: v })} />
      <style jsx>{`
        .stack{display:flex;flex-direction:column;gap:12px;width:100%}
        .machine-header{padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border-hairline);border-radius:var(--radius-md);}
        .machine-header strong{display:block;font-size:16px;color:var(--ink-primary);}
        .machine-header span{font-size:13px;color:var(--ink-muted);}
        .badges{display:flex;gap:8px;}
        .badge{flex:1;min-width:0;background:var(--bg-surface);border:1px solid var(--border-hairline);border-radius:var(--radius-sm);padding:8px 10px;overflow:hidden;}
        .bk{font-size:10px;color:var(--ink-muted);text-transform:uppercase;}
        .bv{font-family:var(--font-mono);font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .r2>:global(*){min-width:0}
      `}</style>
    </div>
  );
}

function ReadingsStep({ data, setData, isGen }) {
  const r = data.readings || {};
  const upd = p => setData({ ...data, readings: { ...r, ...p } });
  const updJP = p => upd({ jockeyPump: { ...(r.jockeyPump || {}), ...p } });
  const updEl = p => upd({ electrical: { ...(r.electrical || {}), ...p } });

  if (isGen) {
    const el = r.electrical || {};
    return (
      <div className="stack">
        <NumericField label="แรงดันแบตเตอรี่" unit="V" value={r.batteryVoltage} onChange={v => upd({ batteryVoltage: v })} />
        <div className="sub">ค่าแรงดัน Off Load (V)</div>
        <div className="r3">
          <NumericField label="L1-N" unit="V" value={el.offload_L1N} onChange={v => updEl({ offload_L1N: v })} />
          <NumericField label="L2-N" unit="V" value={el.offload_L2N} onChange={v => updEl({ offload_L2N: v })} />
          <NumericField label="L3-N" unit="V" value={el.offload_L3N} onChange={v => updEl({ offload_L3N: v })} />
        </div>
        <div className="r3">
          <NumericField label="L1-L2" unit="V" value={el.offload_L1L2} onChange={v => updEl({ offload_L1L2: v })} />
          <NumericField label="L2-L3" unit="V" value={el.offload_L2L3} onChange={v => updEl({ offload_L2L3: v })} />
          <NumericField label="L1-L3" unit="V" value={el.offload_L1L3} onChange={v => updEl({ offload_L1L3: v })} />
        </div>
        <div className="sub">กระแสไฟฟ้า (A)</div>
        <div className="r3">
          <NumericField label="L1" unit="A" value={el.current_L1} onChange={v => updEl({ current_L1: v })} />
          <NumericField label="L2" unit="A" value={el.current_L2} onChange={v => updEl({ current_L2: v })} />
          <NumericField label="L3" unit="A" value={el.current_L3} onChange={v => updEl({ current_L3: v })} />
        </div>
        <style jsx>{`.stack{display:flex;flex-direction:column;gap:10px;width:100%} .sub{font-size:13px;font-weight:600;color:var(--ink-secondary);margin-top:4px;} .r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;} .r3>:global(*){min-width:0}`}</style>
      </div>
    );
  }

  const jp = r.jockeyPump || {};
  return (
    <div className="stack">
      <NumericField label="แรงดันน้ำในระบบ" unit="Psi" value={r.waterPressure} onChange={v => upd({ waterPressure: v })} />
      <div className="sub">Battery</div>
      <div className="r2">
        <NumericField label="#1" unit="V" value={r.battery1Voltage} onChange={v => upd({ battery1Voltage: v })} />
        <NumericField label="#2" unit="V" value={r.battery2Voltage} onChange={v => upd({ battery2Voltage: v })} />
      </div>
      <div className="sub">Jockey Pump แรงดัน (V)</div>
      <div className="r3">
        <NumericField label="L1-L2" unit="V" value={jp.voltageL1L2} onChange={v => updJP({ voltageL1L2: v })} />
        <NumericField label="L2-L3" unit="V" value={jp.voltageL2L3} onChange={v => updJP({ voltageL2L3: v })} />
        <NumericField label="L1-L3" unit="V" value={jp.voltageL1L3} onChange={v => updJP({ voltageL1L3: v })} />
      </div>
      <div className="sub">Jockey Pump กระแส (A)</div>
      <div className="r3">
        <NumericField label="L1" unit="A" value={jp.currentL1} onChange={v => updJP({ currentL1: v })} />
        <NumericField label="L2" unit="A" value={jp.currentL2} onChange={v => updJP({ currentL2: v })} />
        <NumericField label="L3" unit="A" value={jp.currentL3} onChange={v => updJP({ currentL3: v })} />
      </div>
      <style jsx>{`.stack{display:flex;flex-direction:column;gap:10px;width:100%} .sub{font-size:13px;font-weight:600;color:var(--ink-secondary);margin-top:4px;} .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;} .r2>:global(*){min-width:0} .r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;} .r3>:global(*){min-width:0}`}</style>
    </div>
  );
}

function TestRunStep({ data, setData, isGen }) {
  const t = data.testRun || {};
  const upd = p => setData({ ...data, testRun: { ...t, ...p } });
  return (
    <div className="stack">
      <NumericField label="ความเร็วรอบ" unit="RPM" value={t.rpm} onChange={v => upd({ rpm: v })} />
      <NumericField label="แรงดันน้ำมันเครื่อง" unit="Psi" value={t.oilPressure} onChange={v => upd({ oilPressure: v })} />
      <NumericField label="อุณหภูมิน้ำหล่อเย็น" unit="°C" value={t.coolantTemp} onChange={v => upd({ coolantTemp: v })} />
      {!isGen ? (
        <>
          <NumericField label="แรงดันน้ำระบาย" unit="Psi" value={t.coolingPressure} onChange={v => upd({ coolingPressure: v })} />
          <NumericField label="แรงดันน้ำในระบบ" unit="Psi" value={t.systemPressure} onChange={v => upd({ systemPressure: v })} />
        </>
      ) : (
        <>
          <NumericField label="แรงดันชาร์จแบต" unit="V" value={t.chargeVoltage} onChange={v => upd({ chargeVoltage: v })} />
          <NumericField label="ความถี่ไฟฟ้า" unit="Hz" value={t.frequency} onChange={v => upd({ frequency: v })} />
          <NumericField label="แรงดันน้ำในระบบ" unit="Psi" value={t.systemPressure} onChange={v => upd({ systemPressure: v })} />
        </>
      )}
      <NumericField label="อัตราการใช้เชื้อเพลิง" unit="L" value={t.fuelConsumption} onChange={v => upd({ fuelConsumption: v })} />
      <style jsx>{`.stack{display:flex;flex-direction:column;gap:10px;width:100%}`}</style>
    </div>
  );
}

function AfterRunStep({ data, setData, isGen, conclusionDefault }) {
  const a = data.afterRun || {};
  const upd = p => setData({ ...data, afterRun: { ...a, ...p } });
  const conclusionVal = a.conclusionText || conclusionDefault;
  return (
    <div className="stack">
      <div className="abox">
        <div className="abox-label">บันทึกค่าหลังทดสอบ</div>
        <div className="r2">
          {!isGen
            ? <NumericField label="น้ำมัน (หลัง)" unit="L" value={a.fuelAfter} onChange={v => upd({ fuelAfter: v })} />
            : <div />
          }
          <NumericField label="ชม. (หลัง)" unit="Hrs" value={a.runningHoursAfter} onChange={v => upd({ runningHoursAfter: v })} />
        </div>
      </div>
      <TextField label="หมายเหตุ" multiline value={a.comment} onChange={v => upd({ comment: v })}
        placeholder="เช่น น้ำมันหล่อลื่นรั่วซึม..." />
      <TextField label="สรุปผล" multiline value={conclusionVal} onChange={v => upd({ conclusionText: v })} />
      <SignaturePad label="ลายเซ็นผู้ตรวจสอบ" value={a.inspectorSignature} onChange={sig => upd({ inspectorSignature: sig })} />
      <TextField label="ชื่อผู้ตรวจสอบ" value={a.inspectedBy} onChange={v => upd({ inspectedBy: v })} />
      <div style={{ height: 1, background: 'var(--border-hairline)' }} />
      <TextField label="ชื่อผู้อนุมัติ (กรอกภายหลัง)" value={a.approvedBy} onChange={v => upd({ approvedBy: v })} />
      <style jsx>{`
        .stack{display:flex;flex-direction:column;gap:12px;width:100%}
        .abox{background:var(--bg-surface);border:1px solid var(--status-warn);border-radius:var(--radius-md);padding:10px;}
        .abox-label{font-size:11px;font-weight:700;color:var(--status-warn);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;}
        .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .r2>:global(*){min-width:0}
      `}</style>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<main style={{padding:40,color:'var(--ink-muted)'}}>กำลังโหลด...</main>}>
      <SessionPageInner />
    </Suspense>
  );
}
