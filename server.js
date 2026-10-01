const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// USE MEMORY - not disk! Fixes Render issue
const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req,res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/apply', upload.any(), async (req, res) => {
  try {
    console.log("Body:", req.body);
    console.log("Files:", req.files?.length);
    const { fullName, email, phone, amount, loanType, message } = req.body;

    let attachments = [];
    if (req.files) {
      for (const f of req.files) {
        attachments.push({
          name: f.originalname,
          content: f.buffer.toString('base64')
        });
      }
    }

    let payload = {
      sender: { name: "Capital Titan Trust", email: "nancymikos6@gmail.com" },
      to: [{ email: "nancymikos6@gmail.com" }],
      subject: `New Loan Application - ${fullName}`,
      htmlContent: `<h3>New Application</h3>
      <p><b>Name:</b> ${fullName}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Amount:</b> ${amount}</p>
      <p><b>Type:</b> ${loanType}</p>
      <p><b>Message:</b> ${message}</p>`
    };

    // Only add attachment if there are files!
    if (attachments.length > 0) {
      payload.attachment = attachments;
    }

    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    console.log("Brevo:", data);
    
    if (!resp.ok) return res.status(400).json({ error: data });
    
    console.log("✅ EMAIL SENT VIA BREVO");
    res.json({ success: true });

  } catch (e) {
    console.error("Error:", e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));