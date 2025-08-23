import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  country: { type: String, required: true },
  email: { type: String, required: true },
  number: { type: String, required: true },
  message: { type: String },
  websiteType: { type: String, required: true },
  pages: { type: String },
  designStyle: { type: String, required: true },
  features: { type: [String] },
  timeline: { type: String, required: true },
  hosting: { type: String, required: true },
  domain: { type: String, required: true },
  currency: { type: String, required: true },
  price: { type: String, required: true },

  // Auto-generated like ObjectId
  quoteNumber: { type: String, unique: true, index: true }
});

// Pre-save hook to auto-generate unique quote number
quoteSchema.pre("save", function (next) {
  if (!this.quoteNumber) {
    const d = new Date();
    const yyyyMMdd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const random4 = Math.floor(1000 + Math.random() * 9000);
    // use part of Mongo ObjectId to ensure uniqueness
    const uniqueId = new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase();

    this.quoteNumber = `BIM-${yyyyMMdd}-${uniqueId}-${random4}`;
  }
  next();
});

export default mongoose.model("QuoteModel", quoteSchema);
