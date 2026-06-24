'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

// ─── ไม่แตะ Logic / API / Export / History ─────────────────────────────────

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── state เดิมทั้งหมด ───────────────────────────────────────────────────
  const [dates, setDates] = useState(null);
  const [githubOk, setGithubOk] = useState(null);
  const [githubError, setGithubError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [comingSoon, setComingSoon] = useState(null); // unused — kept for future
  const [openGroups, setOpenGroups] = useState(new Set(['fpg', 'emergency', 'smoke']));
  const toggleGroup = type => setOpenGroups(prev => {
    const next = new Set(prev);
    next.has(type) ? next.delete(type) : next.add(type);
    return next;
  });
  const today = new Date().toISOString().slice(0, 10);
  const SESSION_KEY = `session:${today}`;

  useEffect(() => {
    try { if (localStorage.getItem(SESSION_KEY)) setHasDraft(true); } catch {}
    if (searchParams.get('saved')) setJustSaved(true);
  }, []);

  useEffect(() => {
    fetch('/api/inspections')
      .then(r => r.json())
      .then(d => {
        setDates(d.dates || []);
        setGithubOk(d.githubConfigured !== false);
        if (d.error && !d.githubConfigured) setGithubError(d.error);
      })
      .catch(() => { setDates([]); setGithubOk(false); setGithubError('ไม่สามารถเชื่อมต่อ API ได้'); });
  }, []);

  // ── handler เดิม ─────────────────────────────────────────────────────────
  const handleDownload = async (date, type = 'fpg', filename = null, building = '', floor = '') => {
    setDownloading(filename || date);
    try {
      const isList = type === 'emergency' || type === 'smoke';
      const endpoint = isList ? '/api/export-list' : '/api/export-combined';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, filename, building, floor }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'ดาวน์โหลดไม่สำเร็จ'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const prefix = type === 'fpg' ? 'FPG' : type === 'emergency' ? 'Emergency' : 'Smoke';
      const bldFlr = [building, floor].filter(Boolean).join('_');
      a.href = url; a.download = `${prefix}_report_${date}${bldFlr ? '_' + bldFlr : ''}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) { alert('เกิดข้อผิดพลาด: ' + err.message); }
    finally { setDownloading(null); }
  };

  // ── UI ใหม่ ───────────────────────────────────────────────────────────────
  return (
    <div className="root">

      {/* ── Header ── */}
      <header className="header">
        <Image src="/logo.png" alt="Veri" width={40} height={40} className="logo" priority />
        <div>
          <h1 className="title">Facility Inspection</h1>
          <p className="subtitle">ระบบบันทึกการตรวจสอบ</p>
        </div>
      </header>

      {/* ── Banners ── */}
      {justSaved && (
        <div className="banner banner--green">
          ✓ บันทึกข้อมูลเรียบร้อย — ดาวน์โหลดได้ที่ History
        </div>
      )}
      {githubOk === false && (
        <div className="banner banner--amber">
          ⚠ {githubError || 'GitHub token ยังไม่ได้ตั้งค่า'}
        </div>
      )}

      {/* ── Card Grid ── */}
      <main className="grid">

        {/* Card 1 — Fire Pump & Generator (ใหญ่ full-width) */}
        <button
          className="card card--fpg"
          onClick={() => router.push(`/session?date=${today}`)}>
          <span className="card__icon">🚒⚡</span>
          <div className="card__body">
            <span className="card__title">Fire Pump &amp; Generator</span>
            <span className="card__sub">
              {hasDraft ? '💾 มี draft ที่ค้างไว้' : `ตรวจสอบวันนี้ · ${today}`}
            </span>
          </div>
          <span className="card__arrow">›</span>
        </button>

        {/* Card 2 — Emergency Light */}
        <button
          className="card card--emergency"
          onClick={() => router.push(`/form/emergency?date=${today}`)}>
          <span className="card__icon">💡</span>
          <div className="card__body">
            <span className="card__title">Emergency Light</span>
            <span className="card__sub">ไฟฉุกเฉิน</span>
          </div>
          <span className="card__arrow">›</span>
        </button>

        {/* Card 3 — Smoke Detector */}
        <button
          className="card card--smoke"
          onClick={() => router.push(`/form/smoke?date=${today}`)}>
          <span className="card__icon">🚨</span>
          <div className="card__body">
            <span className="card__title">Smoke Detector</span>
            <span className="card__sub">อุปกรณ์ตรวจจับควัน</span>
          </div>
          <span className="card__arrow">›</span>
        </button>

        {/* Card 4 — History */}
        <button
          className="card card--history"
          onClick={() => setShowHistory(v => !v)}>
          <span className="card__icon">📋</span>
          <div className="card__body">
            <span className="card__title">History</span>
            <span className="card__sub">
              {dates === null ? 'กำลังโหลด...' : `${dates.length} รายการ`}
            </span>
          </div>
          <span className="card__arrow">{showHistory ? '⌄' : '›'}</span>
        </button>

      </main>

      {/* ── History panel ── */}
      {showHistory && (
        <section className="history-panel">
          {dates?.length === 0 && <p className="history-empty">ยังไม่มีประวัติ</p>}
          {githubOk === false && <p className="history-empty">⚠ ต้องตั้งค่า GitHub token ก่อน</p>}
          {[
            { type: 'fpg',       icon: '🚒⚡', label: 'Fire Pump & Generator', accent: '#c0392b' },
            { type: 'emergency', icon: '💡',   label: 'Emergency Light',        accent: '#1e7e34' },
            { type: 'smoke',     icon: '🚨',   label: 'Smoke Detector',         accent: '#1a4a8a' },
          ].map(({ type, icon, label, accent }) => {
            const group = (dates || []).filter(d => d.type === type);
            if (!group.length) return null;
            const isOpen = openGroups.has(type);
            return (
              <div key={type} className="hist-group">
                <button className="hist-group-hd" onClick={() => toggleGroup(type)}
                  style={{ borderLeft: `4px solid ${accent}` }}>
                  <span className="hist-group-icon">{icon}</span>
                  <span className="hist-group-label">{label}</span>
                  <span className="hist-group-count">{group.length}</span>
                  <span className="hist-group-arrow">{isOpen ? '⌄' : '›'}</span>
                </button>
                {isOpen && group.map(({ date, building, floor, filename }) => {
                  const dlKey = filename || date;
                  const location = [building, floor].filter(Boolean).join(' · ');
                  return (
                    <div key={filename || `${type}_${date}`}
                      className={`hist-row ${date === today ? 'hist-row--today' : ''}`}>
                      <div className="hist-info">
                        {location && <span className="hist-location">{location}</span>}
                        <span className="hist-date">{date}{date === today ? ' · วันนี้' : ''}</span>
                      </div>
                      <button className="btn-dl" disabled={!!downloading}
                        onClick={() => handleDownload(date, type, filename, building, floor)}>
                        {downloading === dlKey ? '⏳' : '⬇︎ Excel'}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}


      <style jsx>{`
        /* ─── Root ─── */
        .root {
          min-height: 100dvh;
          max-width: 480px;
          margin: 0 auto;
          padding-bottom: 40px;
          display: flex;
          flex-direction: column;
        }

        /* ─── Header ─── */
        .header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px 20px 18px;
          border-bottom: 1px solid var(--border-hairline);
        }
        .logo { border-radius: 10px; flex-shrink: 0; }
        .title {
          font-size: 20px;
          font-weight: 800;
          color: var(--ink-primary);
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .subtitle {
          font-size: 13px;
          color: var(--ink-muted);
          margin: 2px 0 0;
        }

        /* ─── Banners ─── */
        .banner {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 500;
          border-bottom: 1px solid transparent;
        }
        .banner--green {
          background: var(--status-pass-bg);
          color: var(--status-pass);
          border-color: var(--status-pass);
        }
        .banner--amber {
          background: rgba(232,163,61,0.1);
          color: var(--status-warn);
          border-color: var(--status-warn);
        }

        /* ─── Grid ─── */
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          padding: 20px 16px 0;
        }

        /* ─── Cards ─── */
        .card {
          display: flex;
          align-items: center;
          gap: 12px;
          border: none;
          border-radius: 20px;
          padding: 18px 16px;
          cursor: pointer;
          text-align: left;
          transition: transform 0.12s, box-shadow 0.12s;
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }
        .card:active { transform: scale(0.97); }

        /* FP&G — full width, gradient */
        .card--fpg {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #c0392b 0%, #e67e22 100%);
          box-shadow: 0 8px 24px rgba(192,57,43,0.35);
          min-height: 88px;
        }
        .card--fpg .card__title { color: #fff; font-size: 17px; }
        .card--fpg .card__sub   { color: rgba(255,255,255,0.8); }
        .card--fpg .card__icon  { font-size: 30px; }
        .card--fpg .card__arrow { color: rgba(255,255,255,0.7); }

        /* Emergency Light — green */
        .card--emergency {
          background: linear-gradient(135deg, #1e7e34 0%, #28a745 100%);
          box-shadow: 0 6px 18px rgba(40,167,69,0.3);
          min-height: 72px;
          gap: 12px;
        }
        .card--emergency .card__icon  { font-size: 26px; }
        .card--emergency .card__title { color: #fff; font-size: 15px; }
        .card--emergency .card__sub   { color: rgba(255,255,255,0.75); }
        .card--emergency .card__arrow { color: rgba(255,255,255,0.7); margin-left: auto; }

        /* Smoke Detector — blue */
        .card--smoke {
          background: linear-gradient(135deg, #1a4a8a 0%, #2d7dd2 100%);
          box-shadow: 0 6px 18px rgba(45,125,210,0.3);
          min-height: 72px;
          gap: 12px;
        }
        .card--smoke .card__icon  { font-size: 26px; }
        .card--smoke .card__title { color: #fff; font-size: 15px; }
        .card--smoke .card__sub   { color: rgba(255,255,255,0.75); }
        .card--smoke .card__arrow { color: rgba(255,255,255,0.7); margin-left: auto; }

        /* History — dark */
        .card--history {
          grid-column: 1 / -1;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .card--history .card__icon  { font-size: 26px; }
        .card--history .card__title { color: var(--ink-primary); font-size: 16px; }
        .card--history .card__sub   { color: var(--ink-muted); }
        .card--history .card__arrow { color: var(--ink-muted); margin-left: auto; }

        /* Card internals */
        .card__icon { flex-shrink: 0; }
        .card__body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
          min-width: 0;
        }
        .card__title {
          font-weight: 700;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .card__sub { font-size: 12px; }
        .card__arrow {
          font-size: 22px;
          font-weight: 300;
          flex-shrink: 0;
          line-height: 1;
        }
        .card__badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(255,255,255,0.22);
          color: #fff;
          border-radius: 8px;
          padding: 2px 8px;
          letter-spacing: 0.04em;
        }

        /* ─── History Panel ─── */
        .history-panel {
          margin: 14px 16px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .history-empty {
          padding: 10px 16px;
          font-size: 14px;
          color: var(--ink-muted);
          margin: 0;
        }

        /* Group */
        .hist-group {
          background: var(--bg-surface);
          border: 1px solid var(--border-hairline);
          border-radius: 16px;
          overflow: hidden;
        }
        .hist-group-hd {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: var(--bg-surface-raised);
          border: none;
          cursor: pointer;
          text-align: left;
          -webkit-tap-highlight-color: transparent;
        }
        .hist-group-icon { font-size: 18px; flex-shrink: 0; }
        .hist-group-label {
          flex: 1;
          font-size: 14px;
          font-weight: 700;
          color: var(--ink-primary);
        }
        .hist-group-count {
          font-size: 12px;
          font-weight: 600;
          background: var(--border-hairline);
          color: var(--ink-muted);
          border-radius: 20px;
          padding: 2px 8px;
        }
        .hist-group-arrow {
          font-size: 18px;
          color: var(--ink-muted);
          line-height: 1;
          flex-shrink: 0;
        }

        /* Rows */
        .hist-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid var(--border-hairline);
        }
        .hist-row--today { background: rgba(210,87,53,0.05); }
        .hist-info { display: flex; flex-direction: column; gap: 2px; }
        .hist-location {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-primary);
        }
        .hist-date {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-muted);
        }
        .btn-dl {
          background: #1a7a3f;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
        }
        .btn-dl:disabled { opacity: 0.5; }

        /* ─── Coming Soon Modal ─── */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 24px;
        }
        .modal {
          background: var(--bg-surface);
          border-radius: 24px;
          padding: 32px 24px;
          width: 100%;
          max-width: 320px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .modal__icon { font-size: 52px; display: block; margin-bottom: 12px; }
        .modal__title {
          font-size: 20px;
          font-weight: 800;
          color: var(--ink-primary);
          margin: 0 0 8px;
        }
        .modal__msg {
          font-size: 15px;
          color: var(--ink-secondary);
          margin: 0 0 4px;
        }
        .modal__sub {
          font-size: 22px;
          font-weight: 800;
          color: var(--ink-muted);
          letter-spacing: 0.04em;
          margin: 0 0 24px;
        }
        .modal__close {
          width: 100%;
          padding: 13px;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-strong);
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          color: var(--ink-primary);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-muted)' }}>
        กำลังโหลด...
      </div>
    }>
      <HomePageInner />
    </Suspense>
  );
}
