const express = require("express");
const router = express.Router();
const db = require("../db/db");
const path = require("path");
const logo = path.join(__dirname, "../services/vistar.jpg");
const {
  generateAndSavePDF,
  calculateTotals,
} = require("../services/pdfServiceVistar");
const dayjs = require("dayjs");

// Generate next invoice number
function nextInvoiceNumber() {
  const txn = db.transaction(() => {
    const row = db
      .prepare("SELECT last_seq FROM invoice_seq WHERE id = 1")
      .get();
    const next = (row && row.last_seq ? row.last_seq : 0) + 1;
    db.prepare("UPDATE invoice_seq SET last_seq = ? WHERE id = 1").run(next);
    return next;
  });
  const seq = txn();
  return `INV-${dayjs().format("YYYYMM")}-${String(seq).padStart(4, "0")}`;
}

function normalizeGstFields(items, gstNumber) {
  const isCgstSgst = (gstNumber || "").startsWith("27");
  return items.map((it) => {
    if (isCgstSgst) {
      // If cgst/sgst missing but igst present, split it
      let cgst =
        it.cgst_rate !== undefined
          ? Number(it.cgst_rate)
          : it.igst_rate
          ? Number(it.igst_rate) / 2
          : 0;
      let sgst =
        it.sgst_rate !== undefined
          ? Number(it.sgst_rate)
          : it.igst_rate
          ? Number(it.igst_rate) / 2
          : 0;
      return { ...it, cgst_rate: cgst, sgst_rate: sgst, igst_rate: 0 };
    } else {
      // If igst missing but cgst/sgst present, sum them
      let igst =
        it.igst_rate !== undefined
          ? Number(it.igst_rate)
          : (Number(it.cgst_rate) || 0) + (Number(it.sgst_rate) || 0);
      return { ...it, igst_rate: igst, cgst_rate: 0, sgst_rate: 0 };
    }
  });
}

// Create invoice
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    if (
      !body.customer_name ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Missing customer_name or items[]" });
    }
    const invoiceNumber =
      body.invoice_number && typeof body.invoice_number === "string"
        ? body.invoice_number
        : nextInvoiceNumber();
    const normalizedItems = normalizeGstFields(body.items, body.customer_gst);
    const calc = calculateTotals(normalizedItems);
    const invoiceDate = body.invoice_date || dayjs().format("YYYY-MM-DD");
    const createdAt = dayjs().toISOString();

    // Insert invoice
    const result = db
      .prepare(
        `
      INSERT INTO invoices
      (invoice_number, invoice_date, customer_name, customer_address, customer_gst, subtotal, total_gst, total, file_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        invoiceNumber,
        invoiceDate,
        body.customer_name,
        body.customer_address || "",
        body.customer_gst || "",
        calc.subtotal,
        calc.totalGst,
        calc.total,
        null,
        createdAt
      );
    const invoiceId = result.lastInsertRowid;

    // Insert items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items
      (invoice_id, product_name, description, quantity, unit_price, cgst_rate, sgst_rate, igst_rate, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction((items) => {
      for (const it of items) {
        insertItem.run(
          invoiceId,
          it.product_name,
          it.description || "",
          it.quantity,
          it.unit_price,
          Number(it.cgst_rate) || 0,
          Number(it.sgst_rate) || 0,
          Number(it.igst_rate) || 0,
          it.line_total
        );
      }
    })(normalizedItems);

    // Upsert product HSN/SAC for each item
    const upsertProduct = db.prepare(`
      INSERT INTO products (product_name, hsn_sac)
      VALUES (?, ?)
      ON CONFLICT(product_name) DO UPDATE SET hsn_sac=excluded.hsn_sac
    `);
    normalizedItems.forEach((it) => {
      if (it.product_name && it.hsn_sac) {
        upsertProduct.run(it.product_name, it.hsn_sac);
      }
    });

    // Generate PDF
    const invoiceForPdf = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      customer_name: body.customer_name,
      customer_address: body.customer_address || "",
      customer_gst: body.customer_gst || "",
      items: normalizedItems, // <-- use enriched items with correct GST rates
      subtotal: calc.subtotal,
      total_gst: calc.totalGst,
      total: calc.total,
    };
    const pdfPath = await generateAndSavePDF(invoiceForPdf, {
      name: "VISTAR ENTERPRISE",
      address:
        "B-704, 7th floor, Sammishra CHS, P.K. Road, Near Keshav Pada, Mulund (W), Mumbai - 400080",
      mobile: "9326874362",
      gst: "27AHKPR5834N1ZJ",
      email: "vistarenterprises6@gmail.com",
      logoPath: logo,
    });
    db.prepare("UPDATE invoices SET file_path = ? WHERE id = ?").run(
      pdfPath,
      invoiceId
    );

    // Insert or update party
    db.prepare(
      `
      INSERT INTO parties (gst, name, address)
      VALUES (?, ?, ?)
      ON CONFLICT(gst) DO UPDATE SET name=excluded.name, address=excluded.address
    `
    ).run(body.customer_gst, body.customer_name, body.customer_address);

    // Return created invoice
    const invoiceRow = db
      .prepare("SELECT * FROM invoices WHERE id = ?")
      .get(invoiceId);
    return res.status(201).json(invoiceRow);
  } catch (err) {
    console.error("Error in POST /api/invoices:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
});

// Serve PDF
router.get("/:id/pdf", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: "Invalid invoice id" });
    const row = db
      .prepare("SELECT file_path FROM invoices WHERE id = ?")
      .get(id);
    if (!row || !row.file_path)
      return res.status(404).json({ error: "PDF not found for invoice id" });
    return res.sendFile(row.file_path);
  } catch (err) {
    console.error("Error in GET /api/invoices/:id/pdf", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
});

// List all invoices
router.get("/", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM invoices ORDER BY invoice_date DESC, id DESC")
      .all();
    return res.json(rows);
  } catch (err) {
    console.error("Error in GET /api/invoices", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
});

// Get invoice with items
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  try {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    invoice.items = db
      .prepare("SELECT * FROM invoice_items WHERE invoice_id = ?")
      .all(id);
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit invoice
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { invoice_date, customer_name, customer_address, customer_gst, items } =
    req.body;
  try {
    const normalizedItems = normalizeGstFields(
      items,
      customer_gst || body.customer_gst
    );
    const calc = calculateTotals(normalizedItems);
    db.prepare(
      `UPDATE invoices SET invoice_date=?, customer_name=?, customer_address=?, customer_gst=?, subtotal=?, total_gst=?, total=? WHERE id=?`
    ).run(
      invoice_date,
      customer_name,
      customer_address,
      customer_gst,
      calc.subtotal,
      calc.totalGst,
      calc.total,
      id
    );

    // Delete old items
    db.prepare("DELETE FROM invoice_items WHERE invoice_id=?").run(id);

    // Insert updated items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items
      (invoice_id, product_name, description, quantity, unit_price, cgst_rate, sgst_rate, igst_rate, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction((itemsArr) => {
      for (const it of itemsArr) {
        insertItem.run(
          id,
          it.product_name,
          it.description || "",
          it.quantity,
          it.unit_price,
          Number(it.cgst_rate) || 0,
          Number(it.sgst_rate) || 0,
          Number(it.igst_rate) || 0,
          it.line_total
        );
      }
    })(normalizedItems);

    // Regenerate PDF
    const updatedInvoice = db
      .prepare("SELECT * FROM invoices WHERE id=?")
      .get(id);
    const invoiceForPdf = {
      invoice_number: updatedInvoice.invoice_number,
      invoice_date,
      customer_name,
      customer_address,
      customer_gst,
      items: normalizedItems, // <-- use enriched items with correct GST rates
      subtotal: calc.subtotal,
      total_gst: calc.totalGst,
      total: calc.total,
    };
    const pdfPath = await generateAndSavePDF(invoiceForPdf, {
      name: "VISTAR ENTERPRISE",
      address:
        "B-704, 7th floor, Sammishra CHS, P.K. Road, Near Keshav Pada, Mulund (W), Mumbai - 400080",
      mobile: "9326874362",
      gst: "27AHKPR5834N1ZJ",
      email: "vistarenterprises6@gmail.com",
      logoPath: logo,
    });
    db.prepare("UPDATE invoices SET file_path=? WHERE id=?").run(pdfPath, id);

    // Insert or update party
    db.prepare(
      `
      INSERT INTO parties (gst, name, address)
      VALUES (?, ?, ?)
      ON CONFLICT(gst) DO UPDATE SET name=excluded.name, address=excluded.address
    `
    ).run(customer_gst, customer_name, customer_address);

    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/party/:gst", (req, res) => {
  const gst = req.params.gst;
  try {
    const party = db.prepare("SELECT * FROM parties WHERE gst = ?").get(gst);
    if (!party) return res.status(404).json({ error: "Party not found" });
    res.json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/product/:product_name", (req, res) => {
  const product_name = req.params.product_name;
  try {
    const product = db
      .prepare("SELECT * FROM products WHERE product_name = ?")
      .get(product_name);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
