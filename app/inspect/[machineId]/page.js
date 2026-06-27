'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { useDraftAutosave } from '../../lib/useDraftAutosave';
import { buildEmptyFormData, getMachineTemplate } from '../../lib/formSchema';

import ChecklistSection from '../../components/ChecklistSection';
import TextField from '../../components/TextField';
import NumericField from '../../components/NumericField';
import SignaturePad from '../../components/SignaturePad';
import GaugeProgress from '../../components/GaugeProgress';
import StepNav from '../../components/StepNav';
import ReferencePhotos from '../../components/ReferencePhotos';

export default function InspectionFormPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const machineId = params.machineId;
  const inspectionDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [fieldMap, setFieldMap] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitState, setSubmitState] = useState('idle');
  const [submitError, setSubmitError] = useState(null);
  const [submitWarning, setSubmitWarning] = useState(null);

  useEffect(() => {
    fetch('/api/field-map')
      .then((r) => r.json())
      .then(setFieldMap)
      .catch((e) => setSubmitError(String(e)));
  }, []);

  const draftKey = `${machineId}:${inspectionDate}`;
  const [githubRecord, setGithubRecord] = useState(undefined); // undefined=loading, null=none

  // GitHub มาก่อน: ถ้ามีข้อมูลในไฟล์ → ล้าง draft เก่า → ใช้ไฟล์
  useEffect(() => {
    if (!fieldMap) return;
    const storageKey = `fpg-draft:${draftKey}`;
    fetch(`/api/inspections?date=${inspectionDate}&type=fpg`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const rec = d?.records?.[machineId];
        if (rec) {
          localStorage.removeItem(storageKey); // ล้าง draft เก่า ให้ใช้ข้อมูลจากไฟล์
          setGithubRecord(rec);
        } else {
          setGithubRecord(null); // ไม่มีใน GitHub → useDraftAutosave ดู localStorage เอง
        }
      })
      .catch(() => setGithubRecord(null));
  }, [fieldMap, draftKey, inspectionDate, machineId]);

  const initialData = useMemo(() => {
    if (!fieldMap || githubRecord === undefined) return null;
    const empty = buildEmptyFormData(fieldMap, machineId, inspectionDate);
    return githubRecord ? { ...empty, ...githubRecord } : empty;
  }, [fieldMap, machineId, inspectionDate, githubRecord]);

  const { data, setData, saveStatus, restoredAt, clearDraft } = useDraftAutosave(draftKey, initialData);

  if (!fieldMap || !data) {
    return <main style={{padding:40,color:'var(--ink-muted)'}}>กำลังโหลด...</main>;
  }

  const found = getMachineTemplate(fieldMap, machineId);
  if (!found) {
    return <main style={{padding:40,color:'var(--ink-muted)'}}>ไม่พบเครื่อง &quot;{machineId}&quot;</main>;
  }

  const { machine, tpl, isGen } = found;
  const visFields = tpl.sheet_visual_fields;
  const dataFields = tpl.sheet_data_fields;
  const preVisualItems = visFields.checklist_0_items || [];
  const preRunItems = dataFields.checklist_1_items || [];

  // ─── Steps ────────────────────────────────────────────────────────────────
  const steps = [
    {
      title: 'ข้อมูลทั่วไป',
      render: () => <GeneralDataStep data={data} setData={setData} isGen={isGen} machine={machine} />,
    },
    {
      title: '0. ตรวจสอบสภาพก่อนเข้าใช้งาน',
      render: () => (
        <ChecklistSection
          title="0. Pre Visual Inspection"
          items={preVisualItems.map(i => ({ label: i.text }))}
          values={data.preVisual}
          mode="2way"
          onChange={(next) => setData({ ...data, preVisual: next })}
        />
      ),
    },
    {
      title: '1. ตรวจสภาพก่อนเดินเครื่อง',
      render: () => (
        <ChecklistSection
          title="1. Pre-Run Visual Inspection"
          items={preRunItems.map(i => ({ label: i.text }))}
          values={data.preRunVisual}
          mode="3way"
          onChange={(next) => setData({ ...data, preRunVisual: next })}
        />
      ),
    },
    {
      title: 'ค่าที่บันทึกได้',
      render: () => <ReadingsStep data={data} setData={setData} isGen={isGen} />,
    },
    {
      title: '2. Test-Run',
      render: () => <TestRunStep data={data} setData={setData} isGen={isGen} />,
    },
    {
      title: '3. สรุปผล และลงชื่อ',
      render: () => (
        <AfterRunStep
          data={data}
          setData={setData}
          isGen={isGen}
          conclusionDefault={
            (dataFields.conclusion_default || []).join('\n')
          }
        />
      ),
    },
  ];

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  // progress
  const total = preVisualItems.length + preRunItems.length;
  const filled = (data.preVisual || []).filter(v => v.result).length
               + (data.preRunVisual || []).filter(v => v.result).length;
  const percent = total ? (filled / total) * 100 : 0;

  // ─── navigation / submit ──────────────────────────────────────────────────
  const goHome = () => router.push('/');
  const goNext = () => {
    if (isLastStep) { handleSubmit(); return; }
    setStepIndex(i => Math.min(i + 1, steps.length - 1));
  };
  const goPrev = () => setStepIndex(i => Math.max(i - 1, 0));

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitWarning(null);
    const a = data.afterRun || {};
    if (!a.inspectedBy?.trim()) {
      setSubmitError('กรุณากรอกชื่อผู้ตรวจสอบก่อนบันทึก');
      return;
    }
    if (!a.inspectorSignature) {
      setSubmitError('กรุณาลงลายเซ็นผู้ตรวจสอบก่อนบันทึก');
      return;
    }
    setSubmitState('submitting');
    try {
      // บันทึกข้อมูลลง GitHub (ไม่ download ไฟล์ทันที — ให้ดาวน์โหลดเองจากหน้าหลัก)
      const res = await fetch('/api/save-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      // save-record อาจไม่มี (ถ้า GitHub token ไม่ได้ตั้ง) → ไม่เป็นไร แค่ warn
      if (res && !res.ok) {
        const e = await res.json().catch(() => ({}));
        setSubmitWarning(e.error || 'บันทึกประวัติลงระบบไม่สำเร็จ (ยังสามารถดาวน์โหลดจากหน้าหลักได้)');
      }
      clearDraft();
      setSubmitState('idle');
      // กลับหน้าหลักเพื่อดูรายการที่บันทึกและเลือกดาวน์โหลด
      router.push('/');
    } catch (err) {
      // network error → warn แต่ยังกลับหน้าหลัก
      console.error('save error:', err);
      clearDraft();
      setSubmitState('idle');
      router.push('/');
    }
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <main className="form-page">
      <header className="form-header">
        <button className="form-header__back" onClick={goHome}>‹ หน้าหลัก</button>
        <div className="form-header__title">
          <h1>{machine.label_th}</h1>
          <p>{inspectionDate}</p>
        </div>
        <GaugeProgress percent={percent} label={saveStatusLabel(saveStatus)} />
      </header>

      {restoredAt && stepIndex === 0 && (
        <p className="draft-banner">
          💾 กู้คืนข้อมูลเมื่อ {new Date(restoredAt).toLocaleString('th-TH')}
        </p>
      )}

      <section className="form-body">
        <h2 className="step-title">{currentStep.title}</h2>
        {currentStep.render()}
      </section>

      {submitError && <p className="submit-error">{submitError}</p>}
      {submitWarning && <p className="submit-warning">{submitWarning}</p>}

      <StepNav
        stepIndex={stepIndex}
        stepCount={steps.length}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={handleSubmit}
        isLastStep={isLastStep}
        submitLabel={submitState === 'submitting' ? 'กำลังสร้างรายงาน...' : '✓ บันทึกและดาวน์โหลด'}
        disabled={submitState === 'submitting'}
      />

      <style jsx>{`
        .form-page { min-height:100dvh; display:flex; flex-direction:column; overflow-x:hidden; }

        .form-header {
          display:flex; align-items:center; gap:10px;
          padding:12px 16px; border-bottom:1px solid var(--border-hairline);
        }
        .form-header__back {
          background:none; border:none; color:var(--ink-muted);
          font-size:14px; cursor:pointer; padding:8px 4px; flex-shrink:0;
          white-space:nowrap;
        }
        .form-header__title { flex:1; min-width:0; }
        .form-header__title h1 {
          font-size:15px; margin:0; color:var(--ink-primary);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .form-header__title p {
          margin:1px 0 0; font-size:11px; color:var(--ink-muted);
          font-family:var(--font-mono);
        }
        .draft-banner {
          margin:10px 16px 0; padding:8px 12px;
          background:var(--status-neutral-bg); border:1px solid var(--border-hairline);
          border-radius:var(--radius-sm); color:var(--ink-secondary); font-size:13px;
        }
        .form-body {
          flex:1;
          /* 140px เผื่อ StepNav (64px) + safe-area + spacing */
          padding:16px 16px 140px;
          /* กัน overflow ด้านขวาจาก grid children */
          overflow-x:hidden;
          width:100%;
          box-sizing:border-box;
        }
        .step-title { font-size:17px; font-weight:700; margin:0 0 14px; }
        .submit-error {
          margin:0 16px 6px; padding:10px 12px;
          background:var(--status-fail-bg); color:var(--status-fail);
          border-radius:var(--radius-sm); font-size:13px;
        }
        .submit-warning {
          margin:0 16px 6px; padding:10px 12px;
          background:rgba(232,163,61,0.12); color:var(--status-warn);
          border:1px solid var(--status-warn); border-radius:var(--radius-sm); font-size:13px;
        }
      `}</style>
    </main>
  );
}

function saveStatusLabel(status) {
  if (status === 'saving') return 'กำลังบันทึก...';
  if (status === 'saved') return 'บันทึกแล้ว';
  if (status === 'error') return 'บันทึกไม่สำเร็จ';
  return '';
}

// ─── Step components ──────────────────────────────────────────────────────────

function GeneralDataStep({ data, setData, isGen, machine }) {
  const g = data.generalData || {};
  const upd = (p) => setData({ ...data, generalData: { ...g, ...p } });

  return (
    <div className="stack">
      {/* Header: ชื่อเครื่อง + สถานที่ (ไม่ต้องกรอก) */}
      <div className="machine-header">
        <span className="machine-header__name">{machine.label}</span>
        <span className="machine-header__loc">{machine.location_default}</span>
      </div>

      <ReferencePhotos imageDir={machine.image_dir} imageFiles={machine.image_files} />

      {/* Model / Serial badge */}
      <div className="badge-row">
        <span className="badge"><span className="badge__k">Model</span><span className="badge__v">{machine.model_default}</span></span>
        <span className="badge"><span className="badge__k">Serial</span><span className="badge__v">{machine.serial_default}</span></span>
      </div>

      <div className="row-2">
        {!isGen
          ? <NumericField label="น้ำมัน (ก่อน)" unit="L" value={g.fuelBefore} onChange={v => upd({ fuelBefore: v })} />
          : <NumericField label="จำนวนครั้งทำงาน" unit="ครั้ง" value={g.runCount} onChange={v => upd({ runCount: v })} />
        }
        <NumericField label="ชม.ทำงาน (ก่อน)" unit="Hrs" value={g.runningHoursBefore} onChange={v => upd({ runningHoursBefore: v })} />
      </div>

      <NumericField label="ระยะเวลาที่เดินเครื่อง" unit="นาที" value={g.runDurationMins} onChange={v => upd({ runDurationMins: v })} />

      <style jsx>{`
        .stack { display:flex; flex-direction:column; gap:14px; width:100%; }
        .machine-header {
          padding:12px 14px; background:var(--bg-surface);
          border:1px solid var(--border-hairline); border-radius:var(--radius-md);
        }
        .machine-header__name {
          display:block; font-size:18px; font-weight:700; color:var(--ink-primary);
        }
        .machine-header__loc {
          display:block; font-size:13px; color:var(--ink-muted); margin-top:2px;
        }
        .badge-row { display:flex; gap:10px; }
        .badge {
          flex:1; min-width:0; background:var(--bg-surface); border:1px solid var(--border-hairline);
          border-radius:var(--radius-sm); padding:9px 12px;
          display:flex; flex-direction:column; gap:2px; overflow:hidden;
        }
        .badge__k { font-size:10px; color:var(--ink-muted); text-transform:uppercase; letter-spacing:0.05em; }
        .badge__v { font-family:var(--font-mono); font-size:12px; font-weight:600; color:var(--ink-primary);
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .row-2 > :global(*) { min-width:0; }
      `}</style>
    </div>
  );
}

function ReadingsStep({ data, setData, isGen }) {
  const r = data.readings || {};
  const upd = (p) => setData({ ...data, readings: { ...r, ...p } });
  const updJP = (p) => upd({ jockeyPump: { ...(r.jockeyPump || {}), ...p } });
  const updElec = (p) => upd({ electrical: { ...(r.electrical || {}), ...p } });

  if (isGen) {
    const elec = r.electrical || {};
    return (
      <div className="stack">
        <NumericField label="แรงดันแบตเตอรี่" unit="Volt" value={r.batteryVoltage} onChange={v => upd({ batteryVoltage: v })} />

        <p className="section-sub">ค่าแรงดันไฟฟ้า (Off Load)</p>
        <div className="row-3">
          <NumericField label="L1-N" unit="V" value={elec.offload_L1N} onChange={v => updElec({ offload_L1N: v })} />
          <NumericField label="L2-N" unit="V" value={elec.offload_L2N} onChange={v => updElec({ offload_L2N: v })} />
          <NumericField label="L3-N" unit="V" value={elec.offload_L3N} onChange={v => updElec({ offload_L3N: v })} />
        </div>
        <div className="row-3">
          <NumericField label="L1-L2" unit="V" value={elec.offload_L1L2} onChange={v => updElec({ offload_L1L2: v })} />
          <NumericField label="L2-L3" unit="V" value={elec.offload_L2L3} onChange={v => updElec({ offload_L2L3: v })} />
          <NumericField label="L1-L3" unit="V" value={elec.offload_L1L3} onChange={v => updElec({ offload_L1L3: v })} />
        </div>

        <p className="section-sub">กระแสไฟฟ้า (Off Load)</p>
        <div className="row-3">
          <NumericField label="L1" unit="A" value={elec.current_L1} onChange={v => updElec({ current_L1: v })} />
          <NumericField label="L2" unit="A" value={elec.current_L2} onChange={v => updElec({ current_L2: v })} />
          <NumericField label="L3" unit="A" value={elec.current_L3} onChange={v => updElec({ current_L3: v })} />
        </div>
        <style jsx>{`.stack{display:flex;flex-direction:column;gap:12px;} .section-sub{margin:4px 0 0;font-size:13px;font-weight:600;color:var(--ink-secondary);} .row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;} .row-3>:global(*){min-width:0}`}</style>
      </div>
    );
  }

  // Fire Pump
  const jp = r.jockeyPump || {};
  return (
    <div className="stack">
      <NumericField label="แรงดันน้ำในระบบ" unit="Psi" value={r.waterPressure} onChange={v => upd({ waterPressure: v })} />

      <p className="section-sub">Battery Data</p>
      <div className="row-2">
        <NumericField label="Battery #1" unit="Volt" value={r.battery1Voltage} onChange={v => upd({ battery1Voltage: v })} />
        <NumericField label="Battery #2" unit="Volt" value={r.battery2Voltage} onChange={v => upd({ battery2Voltage: v })} />
      </div>

      <p className="section-sub">Jockey Pump — แรงดันไฟฟ้า (V)</p>
      <div className="row-3">
        <NumericField label="L1-L2" unit="V" value={jp.voltageL1L2} onChange={v => updJP({ voltageL1L2: v })} />
        <NumericField label="L2-L3" unit="V" value={jp.voltageL2L3} onChange={v => updJP({ voltageL2L3: v })} />
        <NumericField label="L1-L3" unit="V" value={jp.voltageL1L3} onChange={v => updJP({ voltageL1L3: v })} />
      </div>

      <p className="section-sub">Jockey Pump — กระแสไฟฟ้า (A)</p>
      <div className="row-3">
        <NumericField label="L1" unit="A" value={jp.currentL1} onChange={v => updJP({ currentL1: v })} />
        <NumericField label="L2" unit="A" value={jp.currentL2} onChange={v => updJP({ currentL2: v })} />
        <NumericField label="L3" unit="A" value={jp.currentL3} onChange={v => updJP({ currentL3: v })} />
      </div>

      <style jsx>{`.stack{display:flex;flex-direction:column;gap:12px;} .section-sub{margin:4px 0 0;font-size:13px;font-weight:600;color:var(--ink-secondary);} .row-2{display:grid;grid-template-columns:1fr 1fr;gap:8px;} .row-2>:global(*){min-width:0} .row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;} .row-3>:global(*){min-width:0}`}</style>
    </div>
  );
}

function TestRunStep({ data, setData, isGen }) {
  const t = data.testRun || {};
  const upd = (p) => setData({ ...data, testRun: { ...t, ...p } });

  return (
    <div className="stack">
      <NumericField label="ความเร็วรอบ (RPM)" unit="Rpm" value={t.rpm} onChange={v => upd({ rpm: v })} />
      <NumericField label="แรงดันน้ำมันเครื่อง" unit="Psi" value={t.oilPressure} onChange={v => upd({ oilPressure: v })} />
      <NumericField label="อุณหภูมิน้ำหล่อเย็น" unit="°C" value={t.coolantTemp} onChange={v => upd({ coolantTemp: v })} />
      {!isGen ? (
        <>
          <NumericField label="แรงดันน้ำระบายความร้อน" unit="Psi" value={t.coolingPressure} onChange={v => upd({ coolingPressure: v })} />
          <NumericField label="แรงดันน้ำในระบบ" unit="Psi" value={t.systemPressure} onChange={v => upd({ systemPressure: v })} />
        </>
      ) : (
        <>
          <NumericField label="แรงดันชาร์ตแบตเตอรี่" unit="Volt" value={t.chargeVoltage} onChange={v => upd({ chargeVoltage: v })} />
          <NumericField label="ความถี่ไฟฟ้า" unit="Hz" value={t.frequency} onChange={v => upd({ frequency: v })} />
          <NumericField label="แรงดันน้ำในระบบ" unit="Psi" value={t.systemPressure} onChange={v => upd({ systemPressure: v })} />
        </>
      )}
      <NumericField label="อัตราการใช้เชื้อเพลิง" unit="Liters" value={t.fuelConsumption} onChange={v => upd({ fuelConsumption: v })} />
      <style jsx>{`.stack{display:flex;flex-direction:column;gap:12px;width:100%}`}</style>
    </div>
  );
}

function AfterRunStep({ data, setData, isGen, conclusionDefault }) {
  const a = data.afterRun || {};
  const upd = (p) => setData({ ...data, afterRun: { ...a, ...p } });
  const conclusionVal = a.conclusionText !== undefined && a.conclusionText !== ''
    ? a.conclusionText : conclusionDefault;

  return (
    <div className="stack">
      {/* ค่าหลังทดสอบ */}
      <div className="after-box">
        <p className="after-box__label">บันทึกค่าหลังทดสอบ</p>
        {!isGen ? (
          /* FP: น้ำมัน + ชั่วโมง — 2 col แต่ไม่มี padding box ด้านข้างที่ทำให้แคบ */
          <div className="row-2">
            <NumericField label="น้ำมัน (หลัง)" unit="L" value={a.fuelAfter} onChange={v => upd({ fuelAfter: v })} />
            <NumericField label="ชม. (หลัง)" unit="Hrs" value={a.runningHoursAfter} onChange={v => upd({ runningHoursAfter: v })} />
          </div>
        ) : (
          /* GEN: ชั่วโมงอย่างเดียว — full width */
          <NumericField label="ชั่วโมงทำงาน (หลัง)" unit="Hrs" value={a.runningHoursAfter} onChange={v => upd({ runningHoursAfter: v })} />
        )}
      </div>

      <TextField label="หมายเหตุ (After-Run)" multiline value={a.comment}
        onChange={v => upd({ comment: v })}
        placeholder="เช่น น้ำมันหล่อลื่นรั่วซึม, อาการผิดปกติอื่นๆ" />

      <TextField label="สรุปผล (Conclusion Result)" multiline
        value={conclusionVal} onChange={v => upd({ conclusionText: v })} />

      <SignaturePad label="ลายเซ็นผู้ตรวจสอบ *" value={a.inspectorSignature}
        onChange={sig => upd({ inspectorSignature: sig })} />
      <TextField label="ชื่อผู้ตรวจสอบ *" value={a.inspectedBy} onChange={v => upd({ inspectedBy: v })} />

      <div style={{ height:1, background:'var(--border-hairline)', margin:'4px 0' }} />

      <TextField label="ชื่อผู้อนุมัติ (กรอกภายหลังได้)" value={a.approvedBy} onChange={v => upd({ approvedBy: v })} />

      <style jsx>{`
        .stack { display:flex; flex-direction:column; gap:14px; width:100%; }
        .after-box {
          background:var(--bg-surface); border:1px solid var(--status-warn);
          border-radius:var(--radius-md); padding:12px 10px;
          display:flex; flex-direction:column; gap:10px;
        }
        .after-box__label {
          margin:0; font-size:12px; font-weight:700; color:var(--status-warn);
          text-transform:uppercase; letter-spacing:0.05em;
        }
        .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .row-2 > :global(*) { min-width:0; }
      `}</style>
    </div>
  );
}
