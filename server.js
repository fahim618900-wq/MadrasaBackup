// server.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Twilio } = require('twilio');

const app = express();
app.use(cors());
app.use(bodyParser.json({limit:'20mb'}));
app.use('/tmp', express.static(path.join(__dirname,'tmp')));

// Twilio WhatsApp Setup
const accountSid = 'TWILIO_ACCOUNT_SID';
const authToken  = 'TWILIO_AUTH_TOKEN';
const client = new Twilio(accountSid, authToken);
const myWhatsappNumber = 'whatsapp:+8801728517544';

// API to receive edited student profile
app.post('/submit-student', async(req,res)=>{
    const {student_id,name,father,address,cls,mobile,imageBase64} = req.body;

    // 1️⃣ Create TXT file
    const content = `
====================
ID: ${student_id}
Name: ${name}
Father: ${father}
Address: ${address}
Class: ${cls}
Mobile: ${mobile}
====================
`;
    const txtFileName = `tmp/${student_id}_${name}.txt`;
    fs.writeFileSync(txtFileName, content);

    // 2️⃣ Send WhatsApp (Text)
    try {
        await client.messages.create({
            from: 'whatsapp:+14155238886', // Twilio sandbox
            to: myWhatsappNumber,
            body: content
        });
    } catch(e){
        console.log("WhatsApp Text Error:",e.message);
    }

    // 3️⃣ Send Image if exists
    if(imageBase64){
        try {
            const imgBuffer = Buffer.from(imageBase64,'base64');
            const imgFile = `tmp/${student_id}.jpg`;
            fs.writeFileSync(imgFile,imgBuffer);

            // WhatsApp media requires public URL, for local testing ngrok ব্যবহার করতে হবে
            // Example: mediaUrl: ['https://xxxx.ngrok.io/tmp/123.jpg']
        } catch(e){
            console.log("Image Save Error:",e.message);
        }
    }

    res.send({status:'ok', txtFile:txtFileName});
});

app.listen(3000,()=>console.log("Server running on port 3000"));
