const nodemailer = require('nodemailer');

async function test() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'mikecoy27@gmail.com',
      pass: 'bupeghqwmkktzwtg'
    }
  });

  try {
    let info = await transporter.sendMail({
      from: 'mikecoy27@gmail.com',
      to: 'mikecoy27@gmail.com',
      subject: 'TEST WORKING - Text Result',
      text: 'Full name, phone, loan amount test!',
      html: '<h1>TEST OK</h1><p>Name: Test User<br>Phone: 123456<br>Loan: $5000</p>'
    });
    console.log('✅ SENT SUCCESS:', info.response);
  } catch (err) {
    console.log('❌ FAILED:', err.message);
  }
}
test();