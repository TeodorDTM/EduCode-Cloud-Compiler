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
        subject: 'Cod de Verificare — Activare Cont EduCode',
        html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #09090b; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ffffff26;">
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 32px; text-align: center; border-bottom: 1px solid #ffffff26;">
                <span style="font-size: 22px; font-weight: 700;">~$ Edu<span style="color: #38bdf8;">Code</span></span>
            </div>
            <div style="padding: 32px; text-align: center;">
                <h2 style="margin: 0 0 12px; font-size: 20px;">Bine ai venit pe EduCode Cloud! 🚀</h2>
                <p style="color: #a1a1aa; margin: 0 0 28px; line-height: 1.6;">Introdu codul de mai jos pentru a-ți activa contul și mediul de lucru dedicat.</p>
                <div style="background: #1e293b; border: 1px solid #38bdf8; border-radius: 12px; padding: 20px; letter-spacing: 14px; font-size: 32px; font-weight: 700; color: #38bdf8; font-family: monospace;">${code}</div>
                <p style="color: #52525b; font-size: 12px; margin: 24px 0 0;">Codul este valabil 15 minute. Dacă nu ai solicitat crearea unui cont, ignoră acest mesaj.</p>
            </div>
        </div>`
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Verificare trimis → ${toEmail}`);
    } catch (error) {
        console.error(`[Email Error] Nu s-a putut trimite:`, error);
        throw new Error('Eroare la trimiterea email-ului de verificare.');
    }
}

async function sendPasswordResetEmail(toEmail, code) {
    const mailOptions = {
        from: `"EduCode Cloud" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Resetare Parolă — EduCode Cloud',
        html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #09090b; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #ffffff26;">
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 32px; text-align: center; border-bottom: 1px solid #ffffff26;">
                <span style="font-size: 22px; font-weight: 700;">~$ Edu<span style="color: #38bdf8;">Code</span></span>
            </div>
            <div style="padding: 32px; text-align: center;">
                <h2 style="margin: 0 0 12px; font-size: 20px;">Resetare Parolă 🔑</h2>
                <p style="color: #a1a1aa; margin: 0 0 28px; line-height: 1.6;">Ai solicitat resetarea parolei contului tău. Folosește codul de mai jos:</p>
                <div style="background: #1e293b; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; letter-spacing: 14px; font-size: 32px; font-weight: 700; color: #f59e0b; font-family: monospace;">${code}</div>
                <p style="color: #52525b; font-size: 12px; margin: 24px 0 0;">Codul expiră în 15 minute. Dacă nu ai solicitat resetarea, ignoră acest mesaj și parola rămâne neschimbată.</p>
            </div>
        </div>`
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Reset trimis → ${toEmail}`);
    } catch (error) {
        console.error(`[Email Error] Reset eșuat:`, error);
        throw new Error('Eroare la trimiterea email-ului de resetare.');
    }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
