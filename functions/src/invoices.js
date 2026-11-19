const express = require('express');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { db, bucket } = require('./firestore');
const { generateAndSavePDF, calculateTotals } = require('./pdfServiceVistar');

const router = express.Router();
const logo = path.join(__dirname, 'vistar.jpg');

const COMPANY = {
  name: 'VISTAR ENTERPRISE',
  address: 'B-704, 7th floor, Sammishra CHS, P.K. Road, Near Keshav Pada, Mulund (W), Mumbai - 400080',
  mobile: '9326874362',
  gst: '27AHKPR5834N1ZJ',
  email: 'vistarenterprises6@gmail.com',
  logoPath: logo,
  bankDetails: {
    bankName: 'BANK OF BARODA',
    accountNumber: '38350200000607',
    ifsc: 'BARB0MULWES',
    branch: 'Mulund West',
    beneficiary: 'VISTAR ENTERPRISES',
  },
};

const QUANTITY_UNITS = ['Pieces', 'Packet', 'Kg'];
const money = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

const invoices = db.collection('invoices');
const parties = db.collection('parties');
const products = db.collection('products');
const productId = (name) => encodeURIComponent(String(name).trim());

const serialize = (doc) => ({ id: doc.id, ...doc.data() });

function normalizeQuantityUnit(unit) {
  if (!unit) return 'Pieces';
  const n = unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
  return QUANTITY_UNITS.includes(n) ? n : 'Pieces';
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Missing items[]';
  for (const it of items) {
    if (it.quantity_unit && !QUANTITY_UNITS.includes(it.quantity_unit)) {
      return `Invalid quantity unit: ${it.quantity_unit}. Allowed: ${QUANTITY_UNITS.join(', ')}`;
    }
  }
  return null;
}

function normalizeGstFields(items, gstNumber) {
  const isCgstSgst = (gstNumber || '').startsWith('27');
  return items.map((it) => {
    if (isCgstSgst) {
      const cgst =
        it.cgst_rate !== undefined ? Number(it.cgst_rate) : it.igst_rate ? Number(it.igst_rate) / 2 : 0;
      const sgst =
        it.sgst_rate !== undefined ? Number(it.sgst_rate) : it.igst_rate ? Number(it.igst_rate) / 2 : 0;
      return { ...it, cgst_rate: cgst, sgst_rate: sgst, igst_rate: 0 };
    }
    const igst =
      it.igst_rate !== undefined
        ? Number(it.igst_rate)
        : (Number(it.cgst_rate) || 0) + (Number(it.sgst_rate) || 0);
    return { ...it, igst_rate: igst, cgst_rate: 0, sgst_rate: 0 };
  });
}

// Financial-year numbering (resets each 1 April), done in a transaction
async function nextInvoiceNumber(invoiceDate) {
  const d = dayjs(invoiceDate);
  const fyStart = d.month() >= 3 ? d.year() : d.year() - 1;
  const fy = `${fyStart}-${fyStart + 1}`;
  const ref = db.collection('counters').doc(fy);
  const seq = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const next = (snap.exists ? snap.data().last_seq : 0) + 1;
    t.set(ref, { last_seq: next });
    return next;
  });
  return `INV-${fyStart}-${String(d.month() + 1).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;
}

async function invoiceNumberTaken(number, exceptId) {
  const snap = await invoices.where('invoice_number', '==', number).limit(2).get();
  return snap.docs.some((d) => d.id !== exceptId);
}

function cleanManualNumber(raw) {
  if (!raw || typeof raw !== 'string') return null;
  return raw.trim().toUpperCase() || null;
}

// Build the PDF locally (/tmp), upload to Storage, return the storage path
async function buildAndUploadPdf(invoiceForPdf) {
  const localPath = await generateAndSavePDF(invoiceForPdf, COMPANY);
  const dest = `invoices/${invoiceForPdf.invoice_date}/${path.basename(path.dirname(localPath))}/${path.basename(localPath)}`;
  await bucket.upload(localPath, { destination: dest, contentType: 'application/pdf' });
  fs.unlink(localPath, () => {});
  return dest;
}

async function saveLookups(items, customer_gst, customer_name, customer_address) {
  const batch = db.batch();
  items.forEach((it) => {
    if (it.product_name && it.hsn_sac) {
      batch.set(
        products.doc(productId(it.product_name)),
        { product_name: it.product_name, hsn_sac: it.hsn_sac },
        { merge: true }
      );
    }
  });
  if (customer_gst) {
    batch.set(
      parties.doc(customer_gst),
      { gst: customer_gst, name: customer_name, address: customer_address || '' },
      { merge: true }
    );
  }
  await batch.commit();
}

function buildRecord(body, invoiceNumber, invoiceDate) {
  const items = normalizeGstFields(body.items, body.customer_gst);
  const roundOff = Number(body.round_off) || 0;
  const calc = calculateTotals(items, undefined, roundOff);
  // Prefer the frontend's subtotal / GST so the PDF matches what the user saw
  const subtotal = Number(body.subtotal) || calc.subtotal;
  const totalGst = Number(body.total_gst) || calc.totalGst;
  const total = money(subtotal + totalGst + roundOff);

  const record = {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    customer_name: body.customer_name,
    customer_address: body.customer_address || '',
    customer_gst: body.customer_gst || '',
    po_no: typeof body.po_no === 'string' ? body.po_no.trim() || null : null,
    challan_no: body.challan_no || null,
    subtotal,
    total_gst: totalGst,
    round_off: roundOff,
    total,
    items: calc.items.map((it) => ({
      product_name: it.product_name,
      hsn_sac: it.hsn_sac || '',
      description: it.description || '',
      quantity: it.quantity,
      quantity_unit: normalizeQuantityUnit(it.quantity_unit),
      unit_price: it.unit_price,
      cgst_rate: Number(it.cgst_rate) || 0,
      sgst_rate: Number(it.sgst_rate) || 0,
      igst_rate: Number(it.igst_rate) || 0,
      line_total: it.lineAmount,
    })),
  };
  return { record, calc };
}

const pdfPayload = (record, calc) => ({
  ...record,
  challan_no: record.challan_no || undefined,
  items: calc.items,
  gst_type: calc.gstType,
});

// ---------- Create ----------
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.customer_name) return res.status(400).json({ error: 'Missing customer_name' });
    const itemsError = validateItems(body.items);
    if (itemsError) return res.status(400).json({ error: itemsError });

    const invoiceDate = body.invoice_date || dayjs().format('YYYY-MM-DD');
    let invoiceNumber = cleanManualNumber(body.invoice_number);
    if (invoiceNumber) {
      if (!/^[A-Z0-9\-_]+$/.test(invoiceNumber)) {
        return res
          .status(400)
          .json({ error: 'Invoice number can only contain letters, numbers, hyphens, and underscores' });
      }
      if (await invoiceNumberTaken(invoiceNumber)) {
        return res.status(400).json({ error: `Invoice number "${invoiceNumber}" already exists` });
      }
    } else {
      invoiceNumber = await nextInvoiceNumber(invoiceDate);
    }

    const { record, calc } = buildRecord(body, invoiceNumber, invoiceDate);
    record.pdf_path = await buildAndUploadPdf(pdfPayload(record, calc));
    record.created_at = dayjs().toISOString();
    record.updated_at = record.created_at;
    record.created_by = req.user.uid;

    const ref = await invoices.add(record);
    await saveLookups(record.items, record.customer_gst, record.customer_name, record.customer_address);
    return res.status(201).json({ id: ref.id, ...record });
  } catch (err) {
    console.error('POST /api/invoices', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ---------- List ----------
router.get('/', async (req, res) => {
  try {
    const snap = await invoices.get();
    // Sorted in code (newest first) to avoid needing a composite index
    const rows = snap.docs
      .map(serialize)
      .sort(
        (a, b) =>
          (b.invoice_date || '').localeCompare(a.invoice_date || '') ||
          (b.created_at || '').localeCompare(a.created_at || '')
      );
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/invoices', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ---------- Lookups (must be declared before /:id) ----------
router.get('/products', async (req, res) => {
  try {
    const snap = await products.get();
    return res.json(snap.docs.map((d) => d.data()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/party/:gst', async (req, res) => {
  try {
    const doc = await parties.doc(req.params.gst).get();
    if (!doc.exists) return res.status(404).json({ error: 'Party not found' });
    return res.json(doc.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/product/:name', async (req, res) => {
  try {
    const doc = await products.doc(productId(req.params.name)).get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });
    return res.json(doc.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------- PDF stream ----------
router.get('/:id/pdf', async (req, res) => {
  try {
    const doc = await invoices.doc(req.params.id).get();
    if (!doc.exists || !doc.data().pdf_path) return res.status(404).json({ error: 'PDF not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.data().invoice_number}.pdf"`);
    bucket
      .file(doc.data().pdf_path)
      .createReadStream()
      .on('error', () => res.status(404).end())
      .pipe(res);
  } catch (err) {
    console.error('GET /:id/pdf', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ---------- Get one ----------
router.get('/:id', async (req, res) => {
  try {
    const doc = await invoices.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Invoice not found' });
    return res.json(serialize(doc));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------- Update ----------
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const ref = invoices.doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Invoice not found' });
    const old = existing.data();

    if (!body.customer_name) return res.status(400).json({ error: 'Missing customer_name' });
    const itemsError = validateItems(body.items);
    if (itemsError) return res.status(400).json({ error: itemsError });

    let invoiceNumber = old.invoice_number;
    const manual = cleanManualNumber(body.invoice_number);
    if (manual && manual !== old.invoice_number) {
      if (!/^[A-Z0-9\-_]+$/.test(manual)) {
        return res
          .status(400)
          .json({ error: 'Invoice number can only contain letters, numbers, hyphens, and underscores' });
      }
      if (await invoiceNumberTaken(manual, ref.id)) {
        return res.status(400).json({ error: `Invoice number "${manual}" already exists` });
      }
      invoiceNumber = manual;
    }

    const invoiceDate = body.invoice_date || old.invoice_date;
    const { record, calc } = buildRecord(body, invoiceNumber, invoiceDate);
    record.challan_no = body.challan_no || old.challan_no || null;
    if (body.po_no === undefined) {
      if (old.po_no !== undefined) record.po_no = old.po_no;
      else delete record.po_no;
    }
    record.pdf_path = await buildAndUploadPdf(pdfPayload(record, calc));
    record.updated_at = dayjs().toISOString();

    await ref.update(record);
    if (old.pdf_path && old.pdf_path !== record.pdf_path) {
      bucket.file(old.pdf_path).delete().catch(() => {});
    }
    await saveLookups(record.items, record.customer_gst, record.customer_name, record.customer_address);
    return res.json({ id: ref.id });
  } catch (err) {
    console.error('PUT /:id', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;