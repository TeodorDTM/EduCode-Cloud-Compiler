const nodemailer = require('nodemailer');
require('dotenv').config(); 

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

async function sendVerificationEmail(toEmail, code) {
    const mailOptions = {
        from: `"EduCode Cloud" <${process.env.EMAIL_USER}>`, 
        to: toEmail,
        subject: 'Cod de Verificare - Creare Cont EcCC',
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2>Bine ai venit pe EduCode Cloud! 🚀</h2>
                <p>Pentru a-ți activa mediul de lucru, te rugăm să introduci următorul cod de verificare:</p>
                <h1 style="color: #007bff; letter-spacing: 5px;">${code}</h1>
                <p style="color: #777; font-size: 12px;">Acest cod este valabil 15 minute. Dacă nu ai solicitat crearea unui cont, ignoră acest mesaj.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Trimis cu succes către: ${toEmail}`);
    } catch (error) {
        console.error(`[Email Error] Nu s-a putut trimite către ${toEmail}:`, error);
        throw new Error('Eroare la trimiterea email-ului.');
    }
}

module.exports = { sendVerificationEmail };