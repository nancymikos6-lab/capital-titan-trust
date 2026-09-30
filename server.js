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

app.post('/apply', upload.any(), async (req, res) => {
  console.log("Form received:", req.body);
  console.log("Files received:", req.files?.length);

  try {
    const { fullName, email, phone, amount, loanType, message } = req.body;
    
    let attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileContent = fs.readFileSync(file.path).toString('base64');
        attachments.push({
          name: file.originalname,
          content: fileContent
        });
      }
    }

    // Delete temp files after reading
    if (req.files) {
      for (const file of req.files) {
        try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e) {}
      }
    }

    const brevoData = {
      sender: { name: "Capital Titan Trust", email: "nancymikos6@gmail.com" },
      to: [{ email: "nancymikos6@gmail.com" }],
      subject: `New Loan Application - ${fullName}`,
      htmlContent: `<h2>New Loan Application</h2>
        <p><b>Name:</b> ${fullName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Amount:</b> ${amount}</p>
        <p><b>Type:</b> ${loanType}</p>
        <p><b>Message:</b> ${message}</p>`,
      attachment: attachments
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(brevoData)
    });

    const result = await response.json();
    console.log("Brevo result:", result);

    if (!response.ok) {
      return res.status(400).json({ error: JSON.stringify(result) });
    }

    console.log("✅ EMAIL SENT VIA BREVO");
    res.json({ success: true });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});