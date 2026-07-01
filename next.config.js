/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs ใช้ Node APIs (fs, stream) — ต้อง externalize ไม่ให้ webpack พยายาม bundle เข้า
  // client bundle ตอน build (ป้องกัน error "Module not found: Can't resolve 'fs'")
  serverExternalPackages: ['exceljs'],
};

module.exports = nextConfig;
