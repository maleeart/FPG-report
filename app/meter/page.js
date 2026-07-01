'use client';

import { useRouter } from 'next/navigation';

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function MeterPage() {
  const router = useRouter();
  const now = new Date();
  const year = now.getFullYear();
  const buddhistYear = year + 543;

  const months = Array.from({ length: 12 }, (_, i) => {
    const mo = i + 1;
    const ym = `${year}-${String(mo).padStart(2, '0')}`;
    return { mo, ym, label: THAI_MONTHS_SHORT[i] };
  });

  return (
    <div className="root">
      <header className="hdr">
        <button className="back" onClick={() => router.push('/')}>‹</button>
        <div>
          <h1 className="title">⚡ Meter กฟน. Main</h1>
          <p className="sub">บันทึกค่ามิเตอร์ไฟฟ้า {buddhistYear}</p>
        </div>
      </header>

      <main className="grid">
        {months.map(({ mo, ym, label }) => (
          <button key={ym} className="month-card" onClick={() => router.push(`/meter/${ym}`)}>
            <span className="month-num">{mo}</span>
            <span className="month-label">{label}</span>
          </button>
        ))}
      </main>

      <div className="footer">
        <button className="export-btn" onClick={() => { window.location.href = `/api/export-meter?year=${year}`; }}>
          ⬇ Export รวมปี {buddhistYear}
        </button>
      </div>

      <style jsx>{`
        .root { min-height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; padding-bottom: 80px; }
        .hdr { display: flex; align-items: center; gap: 12px; padding: 20px 16px 16px; border-bottom: 1px solid var(--border-hairline); }
        .back { background: none; border: none; font-size: 28px; color: var(--ink-muted); cursor: pointer; padding: 0 6px 0 0; line-height: 1; }
        .title { font-size: 20px; font-weight: 800; color: var(--ink-primary); margin: 0; }
        .sub { font-size: 13px; color: var(--ink-muted); margin: 2px 0 0; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 20px 16px; }
        .month-card {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 4px; padding: 18px 8px;
          background: linear-gradient(135deg, #78350f 0%, #d97706 100%);
          border: none; border-radius: 16px; cursor: pointer;
          box-shadow: 0 4px 12px rgba(217,119,6,0.3);
          transition: transform 0.1s;
          -webkit-tap-highlight-color: transparent;
        }
        .month-card:active { transform: scale(0.95); }
        .month-num { font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
        .month-label { font-size: 13px; color: rgba(255,255,255,0.85); }
        .footer { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; padding: 12px 16px; background: var(--bg-base); border-top: 1px solid var(--border-hairline); }
        .export-btn {
          width: 100%; padding: 14px; background: linear-gradient(135deg, #78350f 0%, #d97706 100%);
          color: #fff; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
