'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function fmtMonth(ym) { // "2026-06" → "มิ.ย. 69"
  const [y, m] = ym.split('-');
  return `${THAI_MONTHS[parseInt(m) - 1]} ${String(parseInt(y) + 543).slice(2)}`;
}

// วันศุกร์ของ ISO week (ช่างจด RAW ทุกเช้าวันศุกร์)
function isoWeekToFriday(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const monday = new Date(simple);
  monday.setUTCDate(dow <= 4 ? simple.getUTCDate() - dow + 1 : simple.getUTCDate() + 8 - dow);
  const fri = new Date(monday);
  fri.setUTCDate(monday.getUTCDate() + 4);
  return fri;
}
// "2026-W26" → { week, y:'2026', m:'06', label:'26 มิ.ย. 2569' }
function weekInfo(week) {
  const [wy, wn] = week.split('-W').map(Number);
  const d = isoWeekToFriday(wy, wn);
  return {
    week,
    y: String(d.getUTCFullYear()),
    m: String(d.getUTCMonth() + 1).padStart(2, '0'),
    label: `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`,
  };
}

const BUILDINGS = [
  'ท.0006','ท.0007','ท.0008','ท.0009','ท.0010',
  'ท.0011','ท.0012','ท.0014','ท.0015','ท.0016',
  'ท.0017','ท.0018','ท.0019','ท.0020','ท.0022',
  'ท.0023','ท.0026','ท.0027','ท.0028','ท.0029',
  'ต.0017','ต.0019','ต.0025','ต.0026','ต.0031','ต.0033',
];
const FREQ_MONTHS = 3; // smoke & emergency: ทุก 3 เดือน

/** คืน { building → lastDate } สำหรับ type ที่ระบุ */
function lastDoneByBuilding(dates, type) {
  const map = {};
  for (const d of (dates || [])) {
    if (d.type !== type || !d.building) continue;
    if (!map[d.building] || d.date > map[d.building]) map[d.building] = d.date;
  }
  return map;
}

/** daysDiff ระหว่าง date string กับวันนี้ */
function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

/** status: 'ok' | 'due' | 'overdue' | 'never' */
function getStatus(lastDate) {
  if (!lastDate) return 'never';
  const days = daysSince(lastDate);
  const limit = FREQ_MONTHS * 30;
  if (days > limit) return 'overdue';
  if (days > limit - 14) return 'due'; // เตือนล่วงหน้า 2 สัปดาห์
  return 'ok';
}

const STATUS_BADGE = { overdue: '🔴', due: '🟡', never: '⚫', ok: '🟢' };
const STATUS_LABEL = { overdue: 'เกินกำหนด', due: 'ใกล้ครบ', never: 'ยังไม่เคยบันทึก', ok: 'ปกติ' };

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dates, setDates] = useState(null);
  const [weeks, setWeeks] = useState([]); // Meter อาคาร: สัปดาห์จาก Energy-Dashboard/forms
  const [githubOk, setGithubOk] = useState(null);
  const [githubError, setGithubError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [openGroups, setOpenGroups] = useState(new Set());
  const [selectedYear, setSelectedYear] = useState(null);     // "2026" | null = ยังไม่ตั้งค่า
  const [selectedMonth, setSelectedMonth] = useState('');     // "01".."12" | '' = ทั้งปี
  const [selectedBuilding, setSelectedBuilding] = useState(''); // '' = ทั้งหมด
  const { data: session } = useSession();
  const role = session?.user?.role || 'visitor';
  const isAdmin = role === 'admin';
  const [deleting, setDeleting] = useState(null); // filename key ที่กำลังลบ
  const [confirmDelete, setConfirmDelete] = useState(null); // { date, type, filename, building, floor }

  const toggleGroup = type => setOpenGroups(prev => {
    const next = new Set(prev);
    next.has(type) ? next.delete(type) : next.add(type);
    return next;
  });
  const today = new Date().toISOString().slice(0, 10);
  const SESSION_KEY = `session:${today}`;

  // building-meter weeks → ข้อมูลวันที่ (คำนวณจาก ISO week ไม่ต้องโหลด CSV)
  const weekRows = useMemo(() => weeks.map(weekInfo), [weeks]);

  // ปีที่มีข้อมูล (รวมทั้ง inspections และ building-meter)
  const availableYears = useMemo(() => {
    const s = new Set();
    (dates || []).forEach(d => s.add(d.date.slice(0, 4)));
    weekRows.forEach(w => s.add(w.y));
    return [...s].filter(Boolean).sort().reverse();
  }, [dates, weekRows]);

  const availableBuildings = useMemo(() => {
    const s = new Set((dates || []).map(d => d.building).filter(Boolean));
    return [...s].sort();
  }, [dates]);

  // filtered inspections (ปี + เดือน + อาคาร)
  const filteredDates = useMemo(() => {
    return (dates || []).filter(d => {
      const yOk = !selectedYear   || d.date.slice(0, 4) === selectedYear;
      const mOk = !selectedMonth  || d.date.slice(5, 7) === selectedMonth;
      const bOk = !selectedBuilding || d.building === selectedBuilding;
      return yOk && mOk && bOk;
    });
  }, [dates, selectedYear, selectedMonth, selectedBuilding]);

  // filtered building-meter weeks (ปี + เดือน)
  const filteredWeeks = useMemo(() => {
    return weekRows.filter(w =>
      (!selectedYear || w.y === selectedYear) && (!selectedMonth || w.m === selectedMonth)
    );
  }, [weekRows, selectedYear, selectedMonth]);

  const statusRows = useMemo(() => {
    if (!dates) return [];
    const smokeMap = lastDoneByBuilding(dates, 'smoke');
    const emerMap  = lastDoneByBuilding(dates, 'emergency');
    return BUILDINGS.map(b => ({
      b,
      smoke: getStatus(smokeMap[b]),
      emer:  getStatus(emerMap[b]),
      smokeDate: smokeMap[b],
      emerDate:  emerMap[b],
    })).filter(r => r.smoke !== 'ok' || r.emer !== 'ok');
  }, [dates]);

  // default selectedYear = ปีล่าสุดที่มีข้อมูล (ตั้งค่าครั้งเดียวหลังโหลด)
  useEffect(() => {
    if (availableYears.length > 0 && selectedYear === null) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  useEffect(() => {
    try { if (localStorage.getItem(SESSION_KEY)) setHasDraft(true); } catch {}
    if (searchParams.get('saved')) setJustSaved(true);
    // prefetch all main routes so navigation feels instant
    router.prefetch(`/session?date=${today}`);
    router.prefetch('/form/emergency');
    router.prefetch('/form/smoke');
    router.prefetch('/meter');
    router.prefetch('/building-meter');
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

  useEffect(() => {
    fetch('/api/building-meter-weeks').then(r => r.json()).then(d => setWeeks(d.weeks || [])).catch(() => {});
  }, []);

  // ── admin ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { date, type, filename, building, floor } = confirmDelete;
    const key = filename || date;
    setDeleting(key);
    setConfirmDelete(null);
    try {
      const res = await fetch('/api/delete-inspection', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, filename, building, floor }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'ลบไม่สำเร็จ'); return; }
      setDates(prev => prev.filter(d => (d.filename || d.date) !== key));
    } catch (err) { alert('เกิดข้อผิดพลาด: ' + err.message); }
    finally { setDeleting(null); }
  };

  // ── download Excel ───────────────────────────────────────────────────────
  const handleDownload = (date, type = 'fpg', filename = null, building = '', floor = '') => {
    const isList = type === 'emergency' || type === 'smoke';
    if (isList) {
      // GET endpoint — works on mobile (browser handles download natively)
      const params = new URLSearchParams({ type, date });
      if (filename) params.set('filename', filename);
      if (building) params.set('building', building);
      if (floor)    params.set('floor', floor);
      window.location.href = `/api/export-list?${params}`;
      return;
    }
    // FPG → GET endpoint (mobile-compatible, same pattern as emergency/smoke)
    window.location.href = `/api/export-combined?date=${date}`;
  };

  // ── download PDF (xlsx → LibreOffice service → pdf) ──────────────────────
  const handleDownloadPdf = async (date, type = 'fpg', filename = null) => {
    const dlKey = `pdf_${filename || date}`;
    setDownloading(dlKey);
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, filename }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'ดาวน์โหลด PDF ไม่สำเร็จ');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FPG_report_${date}.pdf`;
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
        <div style={{flex:1}}>
          <h1 className="title">Facility Inspection</h1>
          <p className="subtitle">ระบบบันทึกการตรวจสอบ</p>
        </div>
        <div className="user-box">
          <span className={`role-chip role-chip--${role}`}>
            {isAdmin ? '🔓 admin' : role === 'user' ? '✎ ผู้ใช้งาน' : '👁 ผู้เยี่ยมชม'}
          </span>
          {isAdmin && (
            <button className="icon-btn" title="จัดการผู้ใช้" onClick={() => router.push('/admin')}>⚙️</button>
          )}
          <button className="logout-btn" onClick={() => signOut({ callbackUrl: '/login' })}>ออกจากระบบ</button>
        </div>
      </header>

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <span className="modal__icon">🗑️</span>
            <h2 className="modal__title">ยืนยันการลบ</h2>
            <p className="modal__msg">ลบรายงาน <strong>{confirmDelete.type.toUpperCase()}</strong></p>
            <p className="modal__msg" style={{fontFamily:'var(--font-mono)',fontSize:13}}>{confirmDelete.date}{confirmDelete.building ? ` · ${confirmDelete.building}` : ''}</p>
            <p style={{color:'var(--status-fail)',fontSize:13,margin:'8px 0 16px'}}>⚠ ลบแล้วไม่สามารถกู้คืนได้</p>
            <div style={{display:'flex',gap:8}}>
              <button className="modal__close" style={{flex:1}} onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
              <button className="modal__close" style={{flex:1,background:'var(--status-fail)',color:'#fff',border:'none'}} onClick={handleDelete}>ลบ</button>
            </div>
          </div>
        </div>
      )}

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

        {/* Card 4 — Meter กฟน. */}
        <button
          className="card card--meter"
          onClick={() => router.push('/meter')}>
          <span className="card__icon">⚡</span>
          <div className="card__body">
            <span className="card__title">Meter กฟน.</span>
            <span className="card__sub">บันทึกค่ามิเตอร์ไฟฟ้า</span>
          </div>
          <span className="card__arrow">›</span>
        </button>

        {/* Card 4b — Meter อาคาร (เปิดฟอร์มบันทึกของช่างบน GitHub Pages) */}
        <button
          className="card card--bmeter"
          onClick={() => router.push('/building-meter')}>
          <span className="card__icon">🏢</span>
          <div className="card__body">
            <span className="card__title">Meter อาคาร</span>
            <span className="card__sub">บันทึกค่ามิเตอร์รายอาคาร</span>
          </div>
          <span className="card__arrow">›</span>
        </button>

        {/* Card 5 — History */}
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

        {/* Card 6 — PM Status Summary (ยุบไว้ กดเปิดถึงเห็น) */}
        {statusRows.length > 0 && (
          <button
            className="card card--status"
            onClick={() => setShowStatus(v => !v)}>
            <span className="card__icon">⚠</span>
            <div className="card__body">
              <span className="card__title">สรุปสถานะรายการ PM</span>
              <span className="card__sub">{statusRows.length} อาคารต้องดำเนินการ</span>
            </div>
            <span className="card__arrow">{showStatus ? '⌄' : '›'}</span>
          </button>
        )}

      </main>

      {/* ── Building Status Panel ── */}
      {showStatus && statusRows.length > 0 && (
        <section className="status-panel">
          <h3 className="status-title">⚠ ต้องดำเนินการ</h3>
          <div className="status-header-row">
            <span className="status-col-b"></span>
            <span className="status-col">💡 Emer</span>
            <span className="status-col">🚨 Smoke</span>
          </div>
          {statusRows.map(({ b, smoke, emer, smokeDate, emerDate }) => (
            <div key={b} className="status-row">
              <span className="status-col-b">{b}</span>
              <span className="status-col" title={`${STATUS_LABEL[emer]}${emerDate ? ' · ' + emerDate : ''}`}>
                {STATUS_BADGE[emer]}
              </span>
              <span className="status-col" title={`${STATUS_LABEL[smoke]}${smokeDate ? ' · ' + smokeDate : ''}`}>
                {STATUS_BADGE[smoke]}
              </span>
            </div>
          ))}
          <p className="status-legend">🟢 ปกติ · 🟡 ใกล้ครบ · 🔴 เกินกำหนด · ⚫ ยังไม่บันทึก</p>
        </section>
      )}

      {/* ── History panel ── */}
      {showHistory && (
        <section className="history-panel">
          {githubOk === false && <p className="history-empty">⚠ ต้องตั้งค่า GitHub token ก่อน</p>}
          {dates?.length === 0 && weekRows.length === 0 && <p className="history-empty">ยังไม่มีประวัติ</p>}

          {(dates?.length > 0 || weekRows.length > 0) && (
            <>
              <div className="filter-row">
                <div className="filter-col">
                  <label className="filter-label">ปี</label>
                  <select className="filter-select"
                    value={selectedYear || ''}
                    onChange={e => setSelectedYear(e.target.value || null)}>
                    <option value="">ทั้งหมด</option>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{parseInt(y) + 543}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-col">
                  <label className="filter-label">เดือน</label>
                  <select className="filter-select"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}>
                    <option value="">ทั้งปี</option>
                    {THAI_MONTHS.map((mo, i) => (
                      <option key={i} value={String(i + 1).padStart(2, '0')}>{mo}</option>
                    ))}
                  </select>
                </div>
                {availableBuildings.length > 0 && (
                  <div className="filter-col">
                    <label className="filter-label">อาคาร</label>
                    <select className="filter-select"
                      value={selectedBuilding}
                      onChange={e => setSelectedBuilding(e.target.value)}>
                      <option value="">ทั้งหมด</option>
                      {availableBuildings.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <p className="filter-result">
                พบ {filteredDates.length + filteredWeeks.length} รายการ
                {selectedYear ? ` · ปี ${parseInt(selectedYear) + 543}` : ''}
                {selectedMonth ? ` · ${THAI_MONTHS[parseInt(selectedMonth) - 1]}` : ''}
                {selectedBuilding ? ` · ${selectedBuilding}` : ''}
              </p>
            </>
          )}

          {/* ── Grouped list ── */}
          {[
            { type: 'fpg',       icon: '🚒⚡', label: 'Fire Pump & Generator', accent: '#2563eb' },
            { type: 'emergency', icon: '💡',   label: 'Emergency Light',        accent: '#16a34a' },
            { type: 'smoke',     icon: '🚨',   label: 'Smoke Detector',         accent: '#0e7490' },
          ].map(({ type, icon, label, accent }) => {
            const group = filteredDates.filter(d => d.type === type);
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
                      <div className="hist-actions">
                        {type === 'fpg' ? (
                          <button className="btn-dl btn-dl--pdf"
                            disabled={!!downloading}
                            onClick={() => handleDownloadPdf(date, type, filename)}>
                            {downloading === `pdf_${dlKey}` ? '⏳' : '📄 PDF'}
                          </button>
                        ) : (
                          <button className="btn-dl btn-dl--pdf"
                            onClick={() => router.push(`/report/${encodeURIComponent(filename || `${type}_${date}`)}`)}>
                            📄 PDF
                          </button>
                        )}
                        <button className="btn-dl" disabled={!!downloading}
                          onClick={() => handleDownload(date, type, filename, building, floor)}>
                          {downloading === dlKey ? '⏳' : '⬇︎ Excel'}
                        </button>
                        {isAdmin && (
                          <button className="btn-del"
                            disabled={deleting === dlKey}
                            onClick={() => setConfirmDelete({ date, type, filename, building, floor })}>
                            {deleting === dlKey ? '⏳' : '🗑'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Meter อาคาร — รายสัปดาห์จาก Energy-Dashboard (แสดงวันที่จด = วันศุกร์ของสัปดาห์) */}
          {filteredWeeks.length > 0 && (
            <div className="hist-group">
              <button className="hist-group-hd" onClick={() => toggleGroup('building-meter')}
                style={{ borderLeft: '4px solid #6366f1' }}>
                <span className="hist-group-icon">🏢</span>
                <span className="hist-group-label">Meter อาคาร</span>
                <span className="hist-group-count">{filteredWeeks.length}</span>
                <span className="hist-group-arrow">{openGroups.has('building-meter') ? '⌄' : '›'}</span>
              </button>
              {openGroups.has('building-meter') && filteredWeeks.map(({ week, label }) => (
                <div key={week} className="hist-row">
                  <div className="hist-info">
                    <span className="hist-location">{label}</span>
                    <span className="hist-date">{week}</span>
                  </div>
                  <div className="hist-actions">
                    <button className="btn-dl" onClick={() => { window.location.href = `/api/export-building-meter?week=${week}`; }}>
                      ⬇︎ Excel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        /* FP&G — full width, Royal Blue gradient */
        .card--fpg {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          box-shadow: 0 8px 24px rgba(37,99,235,0.40);
          min-height: 88px;
        }
        .card--fpg .card__title { color: #fff; font-size: 17px; }
        .card--fpg .card__sub   { color: rgba(255,255,255,0.8); }
        .card--fpg .card__icon  { font-size: 30px; }
        .card--fpg .card__arrow { color: rgba(255,255,255,0.7); }

        /* Emergency Light — green (Veri accent) */
        .card--emergency {
          background: linear-gradient(135deg, #14532d 0%, #16a34a 100%);
          box-shadow: 0 6px 18px rgba(22,163,74,0.35);
          min-height: 72px;
          gap: 12px;
        }
        .card--emergency .card__icon  { font-size: 26px; }
        .card--emergency .card__title { color: #fff; font-size: 15px; }
        .card--emergency .card__sub   { color: rgba(255,255,255,0.75); }
        .card--emergency .card__arrow { color: rgba(255,255,255,0.7); margin-left: auto; }

        /* Smoke Detector — teal */
        .card--smoke {
          background: linear-gradient(135deg, #164e63 0%, #0e7490 100%);
          box-shadow: 0 6px 18px rgba(14,116,144,0.35);
          min-height: 72px;
          gap: 12px;
        }
        .card--smoke .card__icon  { font-size: 26px; }
        .card--smoke .card__title { color: #fff; font-size: 15px; }
        .card--smoke .card__sub   { color: rgba(255,255,255,0.75); }
        .card--smoke .card__arrow { color: rgba(255,255,255,0.7); margin-left: auto; }

        /* Meter กฟน. — amber */
        .card--meter {
          background: linear-gradient(135deg, #78350f 0%, #d97706 100%);
          box-shadow: 0 6px 18px rgba(217,119,6,0.35);
          min-height: 72px;
          gap: 12px;
        }
        .card--meter .card__icon  { font-size: 26px; }
        .card--meter .card__title { color: #fff; font-size: 15px; }
        .card--meter .card__sub   { color: rgba(255,255,255,0.75); }
        .card--meter .card__arrow { color: rgba(255,255,255,0.7); margin-left: auto; }

        /* Meter อาคาร — indigo */
        .card--bmeter {
          background: linear-gradient(135deg, #3730a3 0%, #6366f1 100%);
          box-shadow: 0 6px 18px rgba(99,102,241,0.35);
          min-height: 72px;
          gap: 12px;
        }
        .card--bmeter .card__icon  { font-size: 26px; }
        .card--bmeter .card__title { color: #fff; font-size: 15px; }
        .card--bmeter .card__sub   { color: rgba(255,255,255,0.75); }
        .card--bmeter .card__arrow { color: rgba(255,255,255,0.7); margin-left: auto; }

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

        /* PM Status Summary — dark, same shell as History */
        .card--status {
          grid-column: 1 / -1;
          background: var(--bg-surface-raised);
          border: 1px solid var(--border-hairline);
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .card--status .card__icon  { font-size: 24px; color: var(--status-warn); }
        .card--status .card__title { color: var(--ink-primary); font-size: 16px; }
        .card--status .card__sub   { color: var(--ink-muted); }
        .card--status .card__arrow { color: var(--ink-muted); margin-left: auto; }

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

        /* ─── Building Status Panel ─── */
        .status-panel {
          margin: 14px 16px 0;
          background: var(--bg-surface);
          border: 1px solid var(--border-hairline);
          border-radius: 16px;
          overflow: hidden;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .status-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--status-warn);
          margin: 0 0 8px;
        }
        .status-header-row, .status-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 0;
        }
        .status-header-row {
          border-bottom: 1px solid var(--border-hairline);
          padding-bottom: 6px;
          margin-bottom: 2px;
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-muted);
        }
        .status-col-b { flex: 1; font-size: 13px; font-weight: 700; color: var(--ink-primary); }
        .status-col { width: 72px; text-align: center; font-size: 13px; }
        .status-legend { font-size: 11px; color: var(--ink-muted); margin: 6px 0 0; }

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

        /* ─── Filter bar ─── */
        .filter-row {
          display: flex;
          gap: 10px;
        }
        .filter-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .filter-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .filter-select {
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1.5px solid var(--border-strong);
          background: var(--bg-surface-raised);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-primary);
          appearance: auto;
        }
        .filter-result {
          font-size: 12px;
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
        .hist-row--today { background: rgba(37,99,235,0.07); }
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
        .hist-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .btn-dl {
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .btn-dl--pdf {
          background: #b91c1c;
        }
        .btn-dl:disabled { opacity: 0.5; }
        .btn-del {
          background: var(--status-fail-bg);
          color: var(--status-fail);
          border: 1px solid var(--status-fail);
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 13px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .btn-del:disabled { opacity: 0.5; }

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
        .user-box { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .role-chip { font-size: 11px; font-weight: 700; border-radius: 8px; padding: 4px 8px; white-space: nowrap; }
        .role-chip--admin   { background: rgba(240,70,70,0.12);  color: var(--status-fail); border: 1px solid var(--status-fail); }
        .role-chip--user    { background: var(--status-pass-bg);  color: var(--status-pass); border: 1px solid var(--status-pass); }
        .role-chip--visitor { background: var(--bg-surface-raised); color: var(--ink-muted); border: 1px solid var(--border-strong); }
        .icon-btn { background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px 6px; border-radius: 8px; color: var(--ink-muted); }
        .logout-btn { background: var(--bg-surface-raised); border: 1px solid var(--border-strong); color: var(--ink-secondary); border-radius: 10px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .admin-badge {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 8px;
          color: var(--ink-muted);
          flex-shrink: 0;
        }
        .admin-badge--on {
          background: rgba(240,70,70,0.12);
          color: var(--status-fail);
          font-size: 13px;
          font-weight: 700;
          border: 1px solid var(--status-fail);
          padding: 4px 10px;
        }
        .admin-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--border-strong);
          background: var(--bg-input);
          color: var(--ink-primary);
          font-size: 16px;
          outline: none;
        }
        .admin-input:focus { border-color: var(--accent); }
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
