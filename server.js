// server.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Twilio } = require('twilio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({limit:'20mb'})); // large image support
app.use('/tmp', express.static(path.join(__dirname, 'tmp')));

const accountSid = 'TWILIO_ACCOUNT_SID'; // তোমার Twilio SID
const authToken  = 'TWILIO_AUTH_TOKEN';  // তোমার Twilio Token
const client     = new Twilio(accountSid, authToken);
const myWhatsappNumber = 'whatsapp:+8801728517544'; // তোমার WhatsApp

app.post('/submit-correction', async(req,res)=>{
  const {student_id,name,father,address,cls,mobile,imageBase64} = req.body;

  // 1️⃣ Prepare Text Message
  const message = `
====================
ID: ${student_id}
Name: ${name}
Father: ${father}
Address: ${address}
Class: ${cls}
Mobile: ${mobile}
====================
`;

  // 2️⃣ Send Text
  try{
    await client.messages.create({
      from: 'whatsapp:+14155238886', // Twilio sandbox number
      to: myWhatsappNumber,
      body: message
    });
  }catch(e){ console.log("Text Message Error:",e); }

  // 3️⃣ Send Image if exists
  if(imageBase64){
    try{
      const tmpFile = `tmp/${student_id}.jpg`;
      const imageBuffer = Buffer.from(imageBase64,'base64');
      fs.writeFileSync(tmpFile,imageBuffer);

      await client.messages.create({
        from:'whatsapp:+14155238886',
        to: myWhatsappNumber,
        body:`ID Card Photo: ${name}`,
        mediaUrl:[`https://your-server.com/tmp/${student_id}.jpg`] // public URL
      });
    }catch(e){ console.log("Image Send Error:",e); }
  }

  res.send({status:'ok'});
});

app.listen(3000,()=>console.log("Server running on 3000"));
