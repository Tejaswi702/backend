import express from "express";
import Razorpay from "razorpay";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key for backend
const supabase = createClient(supabaseUrl, supabaseKey);


const app = express();
app.use(cors());
app.use(express.json());

// Enhanced logging for debugging
console.log("✅ Middleware loaded: CORS, express.json");
console.log("🔑 Environment check:");
console.log("  - RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "SET ✓" : "MISSING ✗");
console.log("  - RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "SET ✓" : "MISSING ✗");

/* ================= ROOT TEST ROUTE ================= */
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* ================= GET RAZORPAY PUBLIC KEY ================= */
app.get("/get-razorpay-key", (req, res) => {
  res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });
});

/* ================= RAZORPAY INSTANCE ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================= CREATE ORDER ================= */
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100, // ₹ → paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.status(200).json(order);
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/* ================= VERIFY PAYMENT ================= */
app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      console.error("❌ RAZORPAY_KEY_SECRET is missing from environment variables");
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(sign)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      console.log("✅ Payment signature verified successfully");
      res.status(200).json({ success: true });
    } else {
      console.error("❌ Payment signature mismatch");
      res.status(400).json({ success: false, error: "Invalid signature" });
    }
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ================= SAVE BOOKING ================= */
app.post("/save-booking", async (req, res) => {
  try {
    const {
      customer,
      services,
      booking,
      totalAmount,
      paymentId,
      userId
    } = req.body;

    console.log("Saving booking for:", customer.email);

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          user_id: userId,
          customer_name: `${customer.firstName} ${customer.lastName}`,
          customer_email: customer.email,
          customer_phone: customer.phone,
          customer_address: customer.address,
          customer_city: customer.city,
          customer_zip: customer.zip,
          customer_message: customer.message,
          services: services,
          booking_date: new Date(booking.year, booking.month, booking.date),
          booking_time: booking.time,
          total_amount: totalAmount,
          payment_id: paymentId,
          payment_status: "paid", // Set to paid after successful verification
        }
      ])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log("Booking saved successfully ✅");
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Save booking error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});


/* ================= START SERVER ================= */
console.log("📋 Registered routes:");
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`  ${Object.keys(r.route.methods).join(", ").toUpperCase()} ${r.route.path}`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📍 Accessible at: http://localhost:${PORT}`);
});
