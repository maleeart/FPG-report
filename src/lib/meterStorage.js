const BASE = 'https://api.github.com';
const DATA_BRANCH = 'data';

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo  = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) throw new Error('ตั้งค่า GitHub ENV ไม่ครบ');
  return { token, owner, repo };
}

async function ghReq(path, opts = {}) {
  const { token } = cfg();
  return fetch(`${BASE}${path}`, {
    ...opts,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
}

async function ensureDataBranch() {
  const { owner, repo } = cfg();
  const check = await ghReq(`/repos/${owner}/${repo}/git/ref/heads/${DATA_BRANCH}`);
  if (check.status === 200) return;
  let sha;
  for (const ref of ['main', 'master']) {
    const r = await ghReq(`/repos/${owner}/${repo}/git/ref/heads/${ref}`);
    if (r.status === 200) { sha = (await r.json()).object.sha; break; }
  }
  if (!sha) throw new Error('ไม่พบ branch ต้นทาง');
  const res = await ghReq(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${DATA_BRANCH}`, sha }),
  });
  if (!res.ok && res.status !== 422) throw new Error(`สร้าง branch ไม่สำเร็จ HTTP ${res.status}`);
}

function meterPath(yearMonth) {
  const [yyyy] = yearMonth.split('-');
  return `data/meter/${yyyy}/meter_${yearMonth}.json`;
}

async function loadMeterMonth(yearMonth) {
  const { owner, repo } = cfg();
  const path = meterPath(yearMonth);
  const res = await ghReq(`/repos/${owner}/${repo}/contents/${path}?ref=${DATA_BRANCH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`โหลดไม่สำเร็จ HTTP ${res.status}`);
  const json = await res.json();
  return JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'));
}

async function saveMeterMonth(yearMonth, data) {
  const { owner, repo } = cfg();
  await ensureDataBranch();
  const path = meterPath(yearMonth);
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;

  let sha;
  const existing = await ghReq(`${apiPath}?ref=${DATA_BRANCH}`);
  if (existing.status === 200) {
    sha = (await existing.json()).sha;
  } else if (existing.status !== 404) {
    throw new Error(`ตรวจสอบไฟล์เดิมไม่สำเร็จ HTTP ${existing.status}`);
  }

  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  const put = await ghReq(apiPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `บันทึกค่ามิเตอร์ ${yearMonth}`,
      content,
      branch: DATA_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    const txt = await put.text();
    throw new Error(`บันทึกลง GitHub ไม่สำเร็จ HTTP ${put.status}: ${txt}`);
  }
  return { path };
}

async function listMeterMonths(year) {
  const { owner, repo } = cfg();
  const refRes = await ghReq(`/repos/${owner}/${repo}/git/ref/heads/${DATA_BRANCH}`);
  if (refRes.status === 404) return [];
  if (!refRes.ok) throw new Error(`ดึง ref ไม่สำเร็จ HTTP ${refRes.status}`);
  const { object: { sha: treeSha } } = await refRes.json();

  const treeRes = await ghReq(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  if (!treeRes.ok) throw new Error(`ดึง tree ไม่สำเร็จ HTTP ${treeRes.status}`);
  const { tree } = await treeRes.json();

  const prefix = `data/meter/${year}/meter_`;
  return tree
    .filter(item => item.type === 'blob' && item.path.startsWith(prefix) && item.path.endsWith('.json'))
    .map(item => item.path.split('/').pop().replace(/^meter_/, '').replace(/\.json$/, ''))
    .sort();
}

module.exports = { loadMeterMonth, saveMeterMonth, listMeterMonths };
