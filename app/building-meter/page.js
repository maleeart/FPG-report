'use client';

import { useRouter } from 'next/navigation';

const FORM_URL = 'https://maleeart.github.io/Energy-Dashboard/docs/meter_form.html';

export default function BuildingMeterPage() {
  const router = useRouter();
  return (
    <div className="root">
      <header className="hdr">
        <button className="back" onClick={() => router.push('/')}>‹</button>
        <div>
          <h1 className="title">🏢 Meter อาคาร</h1>
          <p className="sub">บันทึกค่ามิเตอร์รายอาคาร</p>
        </div>
      </header>

      {/* ฟอร์มของช่าง (host บน GitHub Pages, ผูกกับ Google Apps Script) ฝังในแอปให้ดูเป็นหน้าเดียวกัน */}
      <iframe className="frame" src={FORM_URL} title="Meter อาคาร" />

      <style jsx>{`
        .root { min-height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; }
        .hdr { display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border-hairline); }
        .back { background: none; border: none; font-size: 28px; color: var(--ink-muted); cursor: pointer; padding: 0 6px 0 0; line-height: 1; }
        .title { font-size: 18px; font-weight: 800; color: var(--ink-primary); margin: 0; }
        .sub { font-size: 12px; color: var(--ink-muted); margin: 2px 0 0; }
        .frame { flex: 1; width: 100%; border: none; background: #fff; }
      `}</style>
    </div>
  );
}
