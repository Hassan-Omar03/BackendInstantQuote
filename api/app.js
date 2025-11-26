import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import quoteShema from './quoteShema.js'; // keep as-is
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------------
   MongoDB connection
   ------------------------- */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.log('❌ MongoDB Error:', error);
  }
};
connectDB();

/* -------------------------
   BasicLead model (inline)
   ------------------------- */
const BasicLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    companyName: { type: String, default: '' },
    country: { type: String, default: '' },
    email: { type: String, default: '' },
    number: { type: String, default: '' },

    // Quote fields that may be added later when finalizing
    websiteType: { type: String },
    pages: { type: String },
    designStyle: { type: String },
    features: { type: [String], default: [] },
    timeline: { type: String },
    hosting: { type: String },
    domain: { type: String },
    currency: { type: String },
    price: { type: Number },
    products: { type: String },
    insertProducts: { type: String },
    message: { type: String, default: '' },
    quoteNumber: { type: String, default: null }, // will be set when finalized
  },
  { timestamps: true }
);

const BasicLead = mongoose.models.BasicLead || mongoose.model('BasicLead', BasicLeadSchema);

/* -------------------------
   Nodemailer transporter
   ------------------------- */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/* -------------------------
   Helpers
   ------------------------- */
const capitalize = (str = "") => String(str).charAt(0).toUpperCase() + String(str).slice(1).toLowerCase();

const generateQuoteNumber = () => {
  // Example: Q-KJ2LX5Z-374  (readable, collision extremely unlikely)
  return `Q-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
};

const mapOption = {
  client: "Client to Provide",
  "bim africa to provide": "BIM Africa to Provide",
};

/* -------------------------
   Endpoint: save-basic
   Stores only the minimal lead fields and returns id
   ------------------------- */
app.post('/save-basic', async (req, res) => {
  try {
    // if (mongoose.connection.readyState !== 1) {
    //   return res.status(503).json({ error: 'Database not connected' });
    // }

    const { name, companyName, country, email, number } = req.body;

    if (!name || !country) {
      return res.status(400).json({ error: 'Name and country are required' });
    }

    const basic = new BasicLead({
      name,
      companyName: companyName || '',
      country: country || '',
      email: email || '',
      number: number || '',
    });

    // Save with 8s timeout
    const saved = await Promise.race([
      basic.save(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Save operation timed out')), 12000))
    ]);

    // Build admin email HTML (same style as /save admin email)
    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://bim.africa/logo.png" style="max-width: 200px; height: auto;" alt="BIM Africa Logo" />
        </div>
        <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h2 style="color: #333; margin: 0;">New Basic Lead Received</h2>
          <h3 style="color: #ff6f61; margin-top: 8px;">Lead ID: ${saved._id}</h3>
        </div>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px;">
          <h3 style="color: #ff6f61; margin-top: 0; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Client Information</h3>
          <table style="width:100%; border-collapse: collapse; margin-bottom: 10px;">
            <tr><td style="padding:8px 0; font-weight:bold;">Name:</td><td style="text-align:right;">${saved.name || ''}</td></tr>
            <tr><td style="padding:8px 0; font-weight:bold;">Company:</td><td style="text-align:right;">${saved.companyName || ''}</td></tr>
            <tr><td style="padding:8px 0; font-weight:bold;">Email:</td><td style="text-align:right;">${saved.email || ''}</td></tr>
            <tr><td style="padding:8px 0; font-weight:bold;">Phone:</td><td style="text-align:right;">${saved.number || ''}</td></tr>
            <tr><td style="padding:8px 0; font-weight:bold;">Country:</td><td style="text-align:right;">${saved.country || ''}</td></tr>
          </table>
        </div>
        <div style="background-color:#ff6f61; color:white; padding:12px; border-radius:8px; text-align:center; margin-top:12px;">
          <p style="margin:0; font-weight:bold;">Please follow up with the client as needed.</p>
        </div>
      </div>
    `;

    const adminEmail = {
      from: `"BIM Africa Website" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `New Basic Lead - ${saved.name || saved._id}`,
      html: adminHtml
    };

    // Send admin email but don't fail the endpoint if email fails (10s timeout)
    try {
      await Promise.race([
        transporter.sendMail(adminEmail),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Admin email timeout')), 10000))
      ]);
    } catch (emailErr) {
      console.error('Admin email send error (non-fatal):', emailErr);
    }

    return res.json({ success: true, id: saved._id });
  } catch (error) {
    console.error('❌ /save-basic error:', error);
    if (error.message && error.message.includes('timed out')) {
      return res.status(503).json({ error: 'Save timed out' });
    }
    return res.status(500).json({ error: 'Failed to save basic lead', details: error.message });
  }
});


/* -------------------------
   Endpoint: save
   - If body.id provided -> update BasicLead and finalize (generate quoteNumber)
   - Else -> create a new quote using your existing quoteShema
   ------------------------- */
app.post("/save", async (req, res) => {
  const {
    id, // optional BasicLead id
    name, country, email, number, message,
    websiteType, pages, designStyle, features,
    timeline, hosting, domain, currency, price,
    products, insertProducts
  } = req.body;

  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection not ready');
    }

    // If an id was provided, update that BasicLead doc and finalize it
    if (id) {
      const basic = await BasicLead.findById(id);
      if (!basic) {
        return res.status(404).json({ error: 'Basic lead not found' });
      }

      // Merge/overwrite fields
      basic.name = name || basic.name;
      basic.companyName = req.body.companyName || basic.companyName;
      basic.country = country || basic.country;
      basic.email = email || basic.email;
      basic.number = number || basic.number;
      basic.message = message || basic.message;
      basic.websiteType = websiteType || basic.websiteType;
      basic.pages = pages || basic.pages;
      basic.designStyle = designStyle || basic.designStyle;
      basic.features = features || basic.features || [];
      basic.timeline = timeline || basic.timeline;
      basic.hosting = hosting || basic.hosting;
      basic.domain = domain || basic.domain;
      basic.currency = currency || basic.currency;
      basic.price = price || basic.price;
      basic.products = products || basic.products;
      basic.insertProducts = insertProducts || basic.insertProducts;

      // Generate a quote number if not present
      if (!basic.quoteNumber) basic.quoteNumber = generateQuoteNumber();

      const savedBasic = await Promise.race([
        basic.save(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Save operation timed out')), 8000))
      ]);

      const qNumber = savedBasic.quoteNumber;

      // prepare mapped text
      const hostingText = mapOption[(hosting || basic.hosting || '').toLowerCase()] || hosting || basic.hosting || 'Not specified';
      const domainText = mapOption[(domain || basic.domain || '').toLowerCase()] || domain || basic.domain || 'Not specified';
      const featuresText = (features && features.length > 0)
        ? features.map(f => capitalize(f.replace(/-/g, ' '))).join(", ")
        : (basic.features && basic.features.length > 0 ? basic.features.map(f => capitalize(f.replace(/-/g, ' '))).join(", ") : "None");

      /* Client email */
      const clientEmail = {
        from: `"BIM AFRICA" <${process.env.SMTP_USER}>`,
        to: savedBasic.email || email,
        subject: `Your Website Quotation - ${qNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://bim.africa/logo.png" alt="BIM Africa Logo" style="max-width: 200px; height: auto;" />
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-top: 0;">Quote Number: ${qNumber}</h2>
              <p style="color: #666; font-size: 16px;">Hi ${savedBasic.name},</p>
              <p style="color: #666; font-size: 16px;">Thank you for using our instant quotation tool. Here is your quote summary:</p>
            </div>
            <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #ff6f61; margin-top: 0; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Quote Details</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Country:</td><td style="text-align: right;">${savedBasic.country}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Website Type:</td><td style="text-align: right; text-transform: capitalize;">${savedBasic.websiteType || websiteType || ''}</td></tr>
                ${ ( (savedBasic.websiteType || websiteType || '').toLowerCase() === "ecommerce" && (products || savedBasic.products) ) ? `
                  <tr><td style="padding: 8px 0; font-weight: bold;">Products:</td><td style="text-align: right;">${products || savedBasic.products}</td></tr>
                  ${insertProducts || savedBasic.insertProducts ? `<tr><td style="padding: 8px 0; font-weight: bold;">Insert Products:</td><td style="text-align: right; text-transform: capitalize;">${(insertProducts || savedBasic.insertProducts || '').replace(/-/g, ' ')}</td></tr>` : ''}
                ` : '' }
                ${ ( (savedBasic.websiteType || websiteType || '').toLowerCase() !== "landing" && (savedBasic.websiteType || websiteType || '').toLowerCase() !== "ecommerce" && (pages || savedBasic.pages) ) ? `
                  <tr><td style="padding: 8px 0; font-weight: bold;">Pages:</td><td style="text-align: right;">${pages || savedBasic.pages}</td></tr>
                ` : '' }
                <tr><td style="padding: 8px 0; font-weight: bold;">Design Style:</td><td style="text-align: right; text-transform: capitalize;">${(savedBasic.designStyle || designStyle || '').replace(/-/g, ' ')}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Features:</td><td style="text-align: right;">${featuresText}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Timeline:</td><td style="text-align: right;">${(savedBasic.timeline || timeline || '').replace(/-/g, ' ')}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Hosting:</td><td style="text-align: right;">${hostingText}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Domain:</td><td style="text-align: right;">${domainText}</td></tr>
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px;">Final Price:</td>
                  <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px; text-align: right;">
                    ${currency || savedBasic.currency || ''} ${Math.round(price || savedBasic.price || 0).toLocaleString()}
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

      /* Admin email */
      const adminEmail = {
        from: `"BIM Africa Website" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        subject: `New Quote Request - ${qNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://bim.africa/logo.png" style="max-width: 200px; height: auto;" />
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-top: 0;">New Website Quotation Request</h2>
              <h3 style="color: #ff6f61;">Quote Number: ${qNumber}</h3>
            </div>
            <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
              <h3 style="color: #ff6f61; margin-top: 0; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Client Information</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Name:</td><td style="text-align: right;">${savedBasic.name}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td style="text-align: right;">${savedBasic.email}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Phone:</td><td style="text-align: right;">${savedBasic.number}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Country:</td><td style="text-align: right;">${savedBasic.country}</td></tr>
              </table>
              <h3 style="color: #ff6f61; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Project Details</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; font-weight: bold;">Website Type:</td><td style="text-align: right; text-transform: capitalize;">${savedBasic.websiteType || websiteType || ''}</td></tr>
                ${ ( (savedBasic.websiteType || websiteType || '').toLowerCase() === "ecommerce" && (products || savedBasic.products) ) ? `
                  <tr><td style="padding: 8px 0; font-weight: bold;">Products:</td><td style="text-align: right;">${products || savedBasic.products}</td></tr>
                  ${insertProducts || savedBasic.insertProducts ? `<tr><td style="padding: 8px 0; font-weight: bold;">Insert Products:</td><td style="text-align: right; text-transform: capitalize;">${(insertProducts || savedBasic.insertProducts || '').replace(/-/g, ' ')}</td></tr>` : ''}
                ` : '' }
                ${ ( (savedBasic.websiteType || websiteType || '').toLowerCase() !== "landing" && (savedBasic.websiteType || websiteType || '').toLowerCase() !== "ecommerce" && (pages || savedBasic.pages) ) ? `
                  <tr><td style="padding: 8px 0; font-weight: bold;">Pages:</td><td style="text-align: right;">${pages || savedBasic.pages}</td></tr>
                ` : '' }
                <tr><td style="padding: 8px 0; font-weight: bold;">Design Style:</td><td style="text-align: right; text-transform: capitalize;">${(savedBasic.designStyle || designStyle || '').replace(/-/g, ' ')}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Features:</td><td style="text-align: right;">${featuresText}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Timeline:</td><td style="text-align: right;">${(savedBasic.timeline || timeline || '').replace(/-/g, ' ')}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Hosting:</td><td style="text-align: right;">${hostingText}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold;">Domain:</td><td style="text-align: right;">${domainText}</td></tr>
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px;">Final Price:</td>
                  <td style="padding: 12px 0; font-weight: bold; color: #ff6f61; font-size: 18px; text-align: right;">
                    ${currency || savedBasic.currency || ''} ${Math.round(price || savedBasic.price || 0).toLocaleString()}
                  </td>
                </tr>
              </table>
              ${message || savedBasic.message ? `
                <h3 style="color: #ff6f61; border-bottom: 2px solid #ff6f61; padding-bottom: 10px;">Additional Comments</h3>
                <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 0;">${message || savedBasic.message || ''}</p>
              ` : ''}
            </div>
          </div>
        `
      };

      // Send emails in parallel with timeouts
      try {
        await Promise.all([
          Promise.race([transporter.sendMail(clientEmail), new Promise((_, reject) => setTimeout(() => reject(new Error('Client email timeout')), 10000))]),
          Promise.race([transporter.sendMail(adminEmail), new Promise((_, reject) => setTimeout(() => reject(new Error('Admin email timeout')), 10000))])
        ]);
      } catch (emailError) {
        console.error('Email sending error (non-fatal):', emailError);
      }

      return res.json({ success: true, quoteNumber: qNumber, id: savedBasic._id });
    }

    // No id provided -> fallback to original behavior using quoteShema
    // (creates a new Quote document using your existing quoteShema)
    const newQuote = new quoteShema({
      name,
      country,
      email,
      number,
      message: message || '',
      websiteType,
      pages,
      designStyle,
      features: features || [],
      timeline,
      hosting,
      domain,
      currency,
      price,
      products,
      insertProducts
    });

    const savedQuote = await Promise.race([
      newQuote.save(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Save operation timed out')), 8000))
    ]);

    const qNumber = savedQuote.quoteNumber;

    // prepare display texts
    const hostingText = mapOption[hosting?.toLowerCase()] || hosting || 'Not specified';
    const domainText = mapOption[domain?.toLowerCase()] || domain || 'Not specified';
    const featuresText = features && features.length > 0 ? features.map(f => capitalize(f.replace(/-/g, ' '))).join(", ") : "None";

    // client & admin emails (same templates you had)
    const clientEmail = {
      from: `"BIM AFRICA" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your Website Quotation - ${qNumber}`,
      html: `...` // (kept short here - you can reuse the full template above or keep the original one)
    };

    const adminEmail = {
      from: `"BIM Africa Website" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `New Quote Request - ${qNumber}`,
      html: `...`
    };

    // try to send emails but do not fail the request if email sending fails
    try {
      await Promise.all([
        Promise.race([transporter.sendMail(clientEmail), new Promise((_, reject) => setTimeout(() => reject(new Error('Client email timeout')), 10000))]),
        Promise.race([transporter.sendMail(adminEmail), new Promise((_, reject) => setTimeout(() => reject(new Error('Admin email timeout')), 10000))])
      ]);
    } catch (emailError) {
      console.error('Email sending error (non-fatal):', emailError);
    }

    return res.json({ success: true, quoteNumber: qNumber, id: savedQuote._id });

  } catch (error) {
    console.error("❌ /save error:", error);

    if (error.message && (error.message.includes('timeout') || error.message.includes('buffering'))) {
      return res.status(503).json({
        error: "Service temporarily unavailable. Please try again in a moment.",
        details: "Database connection issue"
      });
    } else if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: "Invalid data provided. Please check your form and try again.",
        details: error.message
      });
    } else {
      return res.status(500).json({
        error: "An error occurred while processing your request. Please try again.",
        details: error.message
      });
    }
  }
});

/* status & graceful shutdown */
app.get("/", (req, res) => {
  res.json({
    status: "API is working",
    // mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    // timestamp: new Date().toISOString()
  });
});

// process.on('SIGINT', async () => {
//   console.log('🔄 Shutting down gracefully...');
//   await mongoose.connection.close();
//   console.log('✅ MongoDB connection closed');
//   process.exit(0);
// });

// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   console.log(`🚀 Server is running on port ${port}`);
// });

export default app;
