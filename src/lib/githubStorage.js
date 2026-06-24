/**
 * githubStorage.js v3
 *
 * โครงสร้างไฟล์ใน GitHub branch "data":
 *   data/inspections/<type>_<YYYY-MM-DD>.json
 *   เช่น fpg_2026-06-24.json, emergency_2026-06-24.json
 *
 * รูปแบบ JSON:
 * {
 *   "date": "2026-06-24",
 *   "type": "fpg",
 *   "records": { "fire-pump-1": {...}, ... }
 * }
 *
 * branch "data" แยกจาก "main" (โค้ด) — สร้างอัตโนมัติถ้ายังไม่มี
 */

const BASE = 'https://api.github.com';
const DATA_BRANCH = 'data'; // hardcode — ไม่ใช้ env var เพื่อป้องกัน override โดยไม่ตั้งใจ

const TYPE_LABELS = {
  fpg:       'Fire Pump & Generator',
  emergency: 'Emergency Light',
  smoke:     'Smoke Detector',
};

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo  = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) throw new Error('ตั้งค่า GitHub ENV ไม่ครบ');
  return { token, owner, repo, branch: DATA_BRANCH };
}

async function ghReq(path, opts = {}) {
  const { token } = cfg();
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
}

/** สร้าง branch data ถ้ายังไม่มี (branch off จาก main/master) */
async function ensureDataBranch() {
  const { owner, repo } = cfg();
  const check = await ghReq(`/repos/${owner}/${repo}/git/ref/heads/${DATA_BRANCH}`);
  if (check.status === 200) return;

  let sha;
  for (const ref of ['main', 'master']) {
    const r = await ghReq(`/repos/${owner}/${repo}/git/ref/heads/${ref}`);
    if (r.status === 200) { sha = (await r.json()).object.sha; break; }
  }
  if (!sha) throw new Error('ไม่พบ branch ต้นทางสำหรับสร้าง data branch');

  const res = await ghReq(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${DATA_BRANCH}`, sha }),
  });
  if (!res.ok && res.status !== 422) throw new Error(`สร้าง branch ไม่สำเร็จ HTTP ${res.status}`);
}

function datePath(date, type = 'fpg') {
  const safeDate = String(date).replace(/[^0-9-]/g, '');
  const safeType = String(type).replace(/[^a-z]/g, '');
  if (!safeDate || !safeType) throw new Error('date หรือ type ไม่ถูกต้อง');
  return `data/inspections/${safeType}_${safeDate}.json`;
}

/** โหลดข้อมูลวันที่ระบุ */
async function loadSessionByDate(date, type = 'fpg') {
  const { owner, repo, branch } = cfg();
  const path = datePath(date, type);
  const res = await ghReq(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`โหลดไม่สำเร็จ HTTP ${res.status}`);
  const json = await res.json();
  return JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'));
}

/** บันทึก session ลงไฟล์ */
async function saveSessionByDate(date, dayData, type = 'fpg') {
  const { owner, repo, branch } = cfg();
  await ensureDataBranch();
  const path = datePath(date, type);
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;

  let sha;
  const existing = await ghReq(`${apiPath}?ref=${branch}`);
  if (existing.status === 200) {
    sha = (await existing.json()).sha;
  } else if (existing.status !== 404) {
    throw new Error(`ตรวจสอบไฟล์เดิมไม่สำเร็จ HTTP ${existing.status}`);
  }

  const content = Buffer.from(JSON.stringify(dayData, null, 2), 'utf-8').toString('base64');
  const put = await ghReq(apiPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `บันทึกผลตรวจสอบ [${type}] วันที่ ${date}`,
      content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    const txt = await put.text();
    throw new Error(`บันทึกลง GitHub ไม่สำเร็จ HTTP ${put.status}: ${txt}`);
  }
  return { path };
}

/** บันทึกข้อมูลเครื่องเดียว (merge เข้ากับ records ที่มีอยู่) */
async function saveInspectionRecord(machineId, date, machineData, type = 'fpg') {
  const existing = await loadSessionByDate(date, type).catch(() => null);
  const dayData = existing || { date, type, records: {} };
  if (machineId === '__session__') {
    return saveSessionByDate(date, { ...machineData, type }, type);
  }
  dayData.records[machineId] = machineData;
  return saveSessionByDate(date, dayData, type);
}

/**
 * รายการวันที่ทั้งหมดที่มีข้อมูล
 * คืน [{ date, type, label }] เรียงใหม่→เก่า
 */
async function listInspectionDates() {
  const { owner, repo, branch } = cfg();
  const res = await ghReq(`/repos/${owner}/${repo}/contents/data/inspections?ref=${branch}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`ดึงรายการไม่สำเร็จ HTTP ${res.status}`);
  const items = await res.json();
  return items
    .filter(i => i.type === 'file' && i.name.endsWith('.json'))
    .map(i => {
      const name = i.name.replace(/\.json$/, '');       // "fpg_2026-06-24"
      const sep  = name.indexOf('_');
      const type = sep >= 0 ? name.slice(0, sep) : 'fpg';
      const date = sep >= 0 ? name.slice(sep + 1) : name;
      return { date, type, label: TYPE_LABELS[type] || type.toUpperCase() };
    })
    .sort((a, b) => b.date.localeCompare(a.date));      // เรียงใหม่→เก่า
}

/** ดึงข้อมูลวันที่ระบุ (alias) */
async function loadInspectionByDate(date, type = 'fpg') {
  return loadSessionByDate(date, type);
}

module.exports = {
  saveInspectionRecord,
  saveSessionByDate,
  loadSessionByDate,
  loadInspectionByDate,
  listInspectionDates,
};
