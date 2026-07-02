import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = process.env.GITHUB_REPO_OWNER || 'maleeart';

// GET → รายชื่อสัปดาห์ที่มีใน Energy-Dashboard/forms/*.csv (ใหม่→เก่า)
export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch(`https://api.github.com/repos/${OWNER}/Energy-Dashboard/contents/forms?ref=main`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return NextResponse.json({ weeks: [], error: `HTTP ${res.status}` });
    const list = await res.json();
    const weeks = (Array.isArray(list) ? list : [])
      .filter(f => /^\d{4}-W\d{2}\.csv$/.test(f.name))
      .map(f => f.name.replace(/\.csv$/, ''))
      .sort()
      .reverse();
    return NextResponse.json({ weeks });
  } catch (err) {
    return NextResponse.json({ weeks: [], error: String(err?.message || err) });
  }
}
