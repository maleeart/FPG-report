const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

// รับ xlsx binary สูงสุด 50MB
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

app.get('/', (_req, res) => res.send('LibreOffice PDF Converter - OK'));

app.post('/convert', async (req, res) => {
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'ไม่ได้รับไฟล์ xlsx' });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-'));
  const xlsxPath = path.join(tmpDir, 'input.xlsx');
  const pdfPath  = path.join(tmpDir, 'input.pdf');

  try {
    fs.writeFileSync(xlsxPath, req.body);

    await new Promise((resolve, reject) => {
      exec(
        `python3 /app/convert.py "${xlsxPath}" "${pdfPath}"`,
        { timeout: 90000 },
        (err, stdout, stderr) => {
          if (stdout) console.log('[convert.py stdout]\n' + stdout);
          if (stderr) console.log('[convert.py stderr]\n' + stderr);
          if (err) reject(new Error(stderr || err.message));
          else resolve();
        }
      );
    });

    if (!fs.existsSync(pdfPath)) {
      throw new Error('convert.py ไม่ได้สร้างไฟล์ PDF');
    }

    const pdf = fs.readFileSync(pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (e) {
    console.error('convert error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LibreOffice service listening on port ${PORT}`));
