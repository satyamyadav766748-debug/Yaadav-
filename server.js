
const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ORDERS_FILE = path.join(__dirname, "orders.json");

app.use(express.json());
app.use(express.static(__dirname));

const products = {
  cow: { name: "Gaay Ka Doodh", price: 60, unit: "litre" },
  buffalo: { name: "Bhains Ka Doodh", price: 80, unit: "litre" },
  goat: { name: "Bakri Ka Doodh", price: 120, unit: "litre" },
  paneer: { name: "Paneer", price: 350, unit: "kg" }
};

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Yadav Ji Dairy backend is running!" });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, items } = req.body;

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof customerPhone !== "string" ||
      !/^\d{10}$/.test(customerPhone) ||
      typeof customerAddress !== "string" ||
      !customerAddress.trim() ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Naam, 10-digit mobile, address aur products sahi bharein."
      });
    }

    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = products[item.id];
      const quantity = Number(item.quantity);

      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Product ya quantity sahi nahi hai."
        });
      }

      const subtotal = product.price * quantity;
      total += subtotal;

      orderItems.push({
        id: item.id,
        name: product.name,
        quantity,
        unit: product.unit,
        price: product.price,
        subtotal
      });
    }

    const orders = readOrders();

    const order = {
      id: `YD-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone,
      customerAddress: customerAddress.trim(),
      items: orderItems,
      total,
      status: "New",
      createdAt: new Date().toISOString()
    };

    orders.push(order);
    saveOrders(orders);

    // Email notification is optional.
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });

        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: process.env.ORDER_EMAIL || process.env.GMAIL_USER,
          subject: `New Yadav Ji Dairy Order: ${order.id}`,
          text: [
            `Order ID: ${order.id}`,
            `Customer: ${order.customerName}`,
            `Phone: ${order.customerPhone}`,
            `Address: ${order.customerAddress}`,
            `Items: ${orderItems.map(i => `${i.name} x ${i.quantity} ${i.unit}`).join(", ")}`,
            `Total: Rs. ${total}`
          ].join("\n")
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: "Aapka order successfully save ho gaya!",
      orderId: order.id,
      total: order.total
    });
  } catch (error) {
    console.error("Order save error:", error.message);
    res.status(500).json({
      success: false,
      message: "Order save nahi ho saka. Server par error aaya."
    });
  }
});

// Simple admin API; keep ADMIN_KEY secret.
app.get("/api/admin/orders", (req, res) => {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || req.get("x-admin-key") !== adminKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  res.json(readOrders());
});

app.listen(PORT, () => {
  console.log(`Yadav Ji Dairy running at http://localhost:${PORT}`);
});
