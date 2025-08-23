import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import quoteShema from './quoteShema.js';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.log('❌ MongoDB Error:', error);
    }
};
connectDB();


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

app.post("/save", async (req, res) => {
  const {
    name, country, email, number, message,
    websiteType, pages, designStyle, features,
    timeline, hosting, domain, currency, price
  } = req.body;

  try {
    const newQuote = new quoteShema({
      name, country, email, number, message,
      websiteType, pages, designStyle, features,
      timeline, hosting, domain, currency, price
    });

    await newQuote.save();
    const qNumber = newQuote.quoteNumber;

   
    const mapOption = {
      client: "Client to Provide",
      bim: "Bim Africa to Provide"
    };

    const hostingText = mapOption[hosting] || hosting;
    const domainText = mapOption[domain] || domain;

   
    const featuresText = features.length > 0
      ? features.map(f => capitalize(f)).join(", ")
      : "None";
    const clientEmail = {
      from: `"BIM AFRICA" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your Website Quotation - ${qNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://bim.africa/images/logos/logo.png" alt="BIM Africa Logo" style="max-width: 200px; height: auto;" />
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Quote Number: ${qNumber}</h2>
            <p style="color: #666; font-size: 16px;">Hi ${name},</p>
            <p style="color: #666; font-size: 16px;">Thank you for using our instant quotation tool. Here is your quote summary:</p>
          </div>
          <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #ff6f61; margin-top: 0; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Quote Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Country:</td><td style="text-align: right;">${country}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Website Type:</td><td style="text-align: right; text-transform: capitalize;">${websiteType}</td></tr>
              ${websiteType.toLowerCase() !== "ecommerce" && pages ? `
                <tr><td style="padding: 8px 0; font-weight: bold;">Pages:</td><td style="text-align: right;">${pages}</td></tr>
              ` : ''}
              <tr><td style="padding: 8px 0; font-weight: bold;">Design Style:</td><td style="text-align: right; text-transform: capitalize;">${designStyle}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Features:</td><td style="text-align: right;">${featuresText}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Timeline:</td><td style="text-align: right;">${timeline}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Hosting:</td><td style="text-align: right; text-transform: capitalize;">${hostingText}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Domain:</td><td style="text-align: right; text-transform: capitalize;">${domainText}</td></tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px;">Final Price:</td>
                <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px; text-align: right;">
                  ${currency} ${Math.round(price).toLocaleString()}
                </td>
              </tr>
            </table>
          </div>
          <div style="background-color: #ff6f61; color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 16px;">We will contact you shortly to discuss further details.</p>
            <p style="margin: 10px 0 0 0; font-weight: bold;">Best Regards,<br/>Sales Team - BIM Africa</p>
            <a href="https://bim.africa/" style="color: white; text-decoration: underline;" target="_blank">www.bim.africa</a>
            
          </div>
        </div>
      `
    };

   
    const adminEmail = {
      from: `"BIM Africa Website" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `New Quote Request - ${qNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://bim.africa/images/logos/logo.png" style="max-width: 200px; height: auto;" />
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">New Website Quotation Request</h2>
            <h3 style="color: #ff6f61;">Quote Number: ${qNumber}</h3>
          </div>
          <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
            <h3 style="color: #ff6f61; margin-top: 0; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Client Information</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Name:</td><td style="text-align: right;">${name}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td style="text-align: right;">${email}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Phone:</td><td style="text-align: right;">${number}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Country:</td><td style="text-align: right;">${country}</td></tr>
            </table>
            <h3 style="color: #ff6f61; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Project Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Website Type:</td><td style="text-align: right; text-transform: capitalize;">${websiteType}</td></tr>
              ${websiteType.toLowerCase() !== "ecommerce" && pages ? `
                <tr><td style="padding: 8px 0; font-weight: bold;">Pages:</td><td style="text-align: right;">${pages}</td></tr>
              ` : ''}
              <tr><td style="padding: 8px 0; font-weight: bold;">Design Style:</td><td style="text-align: right; text-transform: capitalize;">${designStyle}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Features:</td><td style="text-align: right;">${featuresText}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Timeline:</td><td style="text-align: right;">${timeline}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Hosting:</td><td style="text-align: right; text-transform: capitalize;">${hostingText}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Domain:</td><td style="text-align: right; text-transform: capitalize;">${domainText}</td></tr>
              <tr style="background-color: #f8f9fa;">
                <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px;">Final Price:</td>
                <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px; text-align: right;">
                  ${currency} ${Math.round(price).toLocaleString()}
                </td>
              </tr>
            </table>
          </div>
        </div>
      `
    };

    await transporter.sendMail(clientEmail);
    await transporter.sendMail(adminEmail);

    res.json({ success: true, quoteNumber: qNumber });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/",(req,res)=>{
  //api working show in /
  res.send("api working");

})
const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})
export default app


