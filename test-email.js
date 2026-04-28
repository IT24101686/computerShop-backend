import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.INVENTORY_EMAIL,
        pass: process.env.INVENTORY_PASS
    }
});

const mailOptions = {
    from: process.env.INVENTORY_EMAIL,
    to: process.env.INVENTORY_EMAIL, // Send to self
    subject: "Test Email from Backend",
    text: "If you receive this, Nodemailer is working perfectly!"
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("❌ Email Test Failed:");
        console.error(error);
    } else {
        console.log("✅ Email Test Successful! Message sent: " + info.response);
    }
});
