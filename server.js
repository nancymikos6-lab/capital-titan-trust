const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/apply', upload.array('images', 3), async (req, res) => {
  try {
    const { fullName, email, phone, amount, loanType, message } = req.body;
    
    const attachments = [];
    if (req.files) {
  for (const file of req.files) {
    try { if(fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e){}
  }
}

    // BREVO - WORKS ON RENDER FREE PLAN (v6 fixed)
    const brevoData = {
      sender: { name: "Capital Titan Trust", email: "info@capitaltitantrust.com" },
      to: [{ email: "info@capitaltitantrust.com" }],
      subject: `New Loan Application - ${fullName}`,
      htmlContent: `<h2>New Loan Application</h2>
        <p><b>Name:</b> ${fullName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Amount:</b> ${amount}</p>
        <p><b>Loan Type:</b> ${loanType}</p>
        <p><b>Message:</b> ${message}</p>`,
      attachment: attachments
    };

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(brevoData)
    });

    if (!brevoResponse.ok) {
      const errText = await brevoResponse.text();
      throw new Error(errText);
    }

    console.log("✅ EMAIL SENT VIA BREVO");

    if (req.files) {
      for (const file of req.files) fs.unlinkSync(file.path);
    }

    res.status(200).json({ success: true, message: "Application submitted successfully!" });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});