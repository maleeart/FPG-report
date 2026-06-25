const express = require('express');
const puppeteer = require('puppeteer');
const os = require('os');

const app = express();

app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => res.send('PDF Service (puppeteer) - OK'));

app.post('/convert-html', async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'ไม่ได้รับ html' });

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuf);
  } catch (e) {
    console.error('puppeteer error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PDF service listening on port ${PORT}`));
