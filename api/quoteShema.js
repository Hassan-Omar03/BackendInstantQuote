// quoteShema.js
import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    // Basic lead info (required for the "Next" save)
    name: { type: String, required: true },
    companyName: { type: String, default: "" },
    country: { type: String, required: true },

    // Contact (optional on basic save; can be filled later)
    email: { type: String, default: "" },
    number: { type: String, default: "" },

    // Optional descriptive fields (filled during later steps)
    message: { type: String, default: "" },
    websiteType: { type: String, default: "" },
    products: { type: String, default: "" }, // for ecommerce
    insertProducts: { type: String, default: "" }, // for ecommerce
    pages: { type: String, default: "" },
    designStyle: { type: String, default: "" },
    features: { type: [String], default: [] },
    timeline: { type: String, default: "" },
    hosting: { type: String, default: "" },
    domain: { type: String, default: "" },

    // Pricing
    currency: { type: String, default: "MUR" },
    price: { type: Number, default: 0 },

    // Quote metadata
    quoteNumber: { type: String, unique: true, index: true, sparse: true }, // generated when finalizing
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Pre-save hook to auto-generate unique quote number when not present
quoteSchema.pre("save", function (next) {
  if (!this.quoteNumber) {
    try {
      const d = new Date();
      const yyyyMMdd = d.toISOString().slice(0, 10).replace(/-/g, "");
      // small random part + last 6 of ObjectId gives uniqueness
      const random4 = Math.floor(1000 + Math.random() * 9000);
      const uniqueId = new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase();
      this.quoteNumber = `BIM-${yyyyMMdd}-${uniqueId}-${random4}`;
    } catch (err) {
      // fallback simple generator
      this.quoteNumber = `BIM-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
  }
  next();
});

export default mongoose.model("QuoteModel", quoteSchema);
