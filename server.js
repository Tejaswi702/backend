import express from "express";
import Razorpay from "razorpay";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SUPABASE ================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================= RAZORPAY ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Backend running");
});

/* ================= GET RAZORPAY KEY ================= */
app.get("/get-razorpay-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

/* ================= CREATE ORDER ================= */
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.json(order);
  } catch (err) {
    console.error("❌ Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
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

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    console.log("✅ Payment signature verified");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Verify payment error:", err);
    res.status(500).json({ success: false });
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
      userId,
    } = req.body;

    console.log("💾 Saving booking for:", customer.email);

    const { error } = await supabase.from("bookings").insert([
      {
        user_id: userId || null,

        customer_name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,                 // ✅ matches table
        phone_number: customer.phone,          // ✅
        full_address: customer.address,        // ✅

        services: services,                    // jsonb (no stringify needed)

        booking_date: `${booking.year}-${booking.month + 1}-${booking.date}`,
        booking_time: booking.time,

        total_amount: totalAmount,
        payment_status: "paid",
        payment_verified: true,

        razorpay_payment_id: paymentId,
      },
    ]);

    if (error) {
      console.error("❌ SUPABASE INSERT ERROR:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    console.log("✅ Booking saved successfully");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Save booking crash:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
