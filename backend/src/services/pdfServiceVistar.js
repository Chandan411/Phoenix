const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const numberToWords = require('number-to-words');
const CURRENCY_FONT = path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf');
const CURRENCY_FONT_BOLD = path.join(__dirname, 'fonts', 'NotoSans-Bold.ttf');

const PAGE = { size: 'A4', margin: 36, footer: 22 };
const STYLE = { ink: '#202124', line: '#59636e', muted: '#667085', fill: '#f5f7fa', accent: '#163a5f', title: 16, company: 12, body: 8.5, table: 7.2, small: 7 };
const PAD = 5, GAP = 8;
const text = (v) => v === null || v === undefined ? '' : String(v).trim();
const number = (v, fallback = 0) => { const n = typeof v === 'string' && !v.trim() ? NaN : Number(v); return Number.isFinite(n) ? n : fallback; };
const money = (v) => Math.round((number(v) + Number.EPSILON) * 100) / 100;
const safeName = (v) => (text(v || 'customer').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'customer');
const inr = (v) => Number.isFinite(Number(v)) ? '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)) : '-';
const inrSigned = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  const sign = n >= 0 ? '+' : '';
  return sign + '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};
const value = (v) => Number.isFinite(Number(v)) ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)) : '-';
const qty = (v, unit) => {
  const q = Number.isFinite(Number(v)) ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(v)) : '-';
  const u = unit ? ' ' + unit : '';
  return q + u;
};
const rate = (v) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(number(v)) + '%';

function gstState(gstin) { const match = text(gstin).match(/^(\d{2})/); return match ? match[1] : null; }
function determineGstType(invoice = {}, company = {}) {
  const declared = text(invoice.gst_type || invoice.gstType).toUpperCase();
  if (declared === 'IGST' || declared === 'INTERSTATE') return 'IGST';
  if (declared === 'CGST_SGST' || declared === 'CGST+SGST' || declared === 'INTRASTATE') return 'CGST_SGST';
  const supplier = gstState(company.gst || invoice.supplier_gst || invoice.supplierGstin);
  const customer = gstState(invoice.customer_gst || invoice.customerGstin || invoice.bill_to_gstin);
  if (supplier && customer) return supplier === customer ? 'CGST_SGST' : 'IGST';
  return (invoice.items || []).some((i) => number(i.cgst_rate) || number(i.sgst_rate)) ? 'CGST_SGST' : 'IGST';
}
function normaliseItem(item = {}, gstType) {
  const quantity = number(item.quantity), unitPrice = number(item.unit_price ?? item.rate), taxableAmount = money(quantity * unitPrice);
  let cgstRate = number(item.cgst_rate), sgstRate = number(item.sgst_rate), igstRate = number(item.igst_rate);
  if (gstType === 'CGST_SGST') { if (!cgstRate && !sgstRate && igstRate) cgstRate = sgstRate = igstRate / 2; igstRate = 0; }
  else { if (!igstRate) igstRate = cgstRate + sgstRate; cgstRate = sgstRate = 0; }
  const cgstAmount = money(taxableAmount * cgstRate / 100), sgstAmount = money(taxableAmount * sgstRate / 100), igstAmount = money(taxableAmount * igstRate / 100);
  const gstAmount = money(cgstAmount + sgstAmount + igstAmount);
  return { ...item, product_name: text(item.product_name || item.name), description: text(item.description), hsn_sac: text(item.hsn_sac || item.hsn), quantity, unit_price: unitPrice, cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate, taxableAmount, cgstAmount, sgstAmount, igstAmount, gstAmount, lineAmount: money(taxableAmount + gstAmount) };
}
function calculateTotals(items = [], gstType, roundOff = 0) {
  const source = Array.isArray(items) ? items : [], type = gstType || determineGstType({ items: source }), normalisedItems = source.map((item) => normaliseItem(item, type));
  const sum = (key) => money(normalisedItems.reduce((total, item) => total + item[key], 0));
  const subtotal = sum('taxableAmount'), cgstAmount = sum('cgstAmount'), sgstAmount = sum('sgstAmount'), igstAmount = sum('igstAmount'), totalGst = money(cgstAmount + sgstAmount + igstAmount), appliedRoundOff = money(roundOff), grandTotal = money(subtotal + totalGst + appliedRoundOff);
  return { gstType: type, items: normalisedItems, subtotal, cgstAmount, sgstAmount, igstAmount, totalGst, roundOff: appliedRoundOff, grandTotal, total: grandTotal };
}

function getColumns(gstType) {
  const common = [['sno', 'S.No.', .06, 25, 'center'], ['description', 'Description', gstType === 'IGST' ? .34 : .25, 104, 'left'], ['hsn', 'HSN/SAC', .10, 42, 'center'], ['qty', 'Qty', .07, 31, 'right'], ['unitPrice', 'Unit Price', .12, 51, 'right']];
  const tax = gstType === 'IGST' ? [['igstRate', 'IGST %', .09, 38, 'right'], ['igstAmount', 'IGST Amt', .13, 54, 'right']] : [['cgstRate', 'CGST %', .07, 31, 'right'], ['cgstAmount', 'CGST Amt', .10, 43, 'right'], ['sgstRate', 'SGST %', .07, 31, 'right'], ['sgstAmount', 'SGST Amt', .10, 43, 'right']];
  return [...common, ...tax, ['amount', 'Amount', .15, 58, 'right']].map(([key, label, weight, min, align]) => ({ key, label, weight, min, align }));
}
function columnWidths(columns, total) {
  const min = columns.reduce((s, c) => s + c.min, 0);
  const result = min >= total ? columns.map((c) => Math.floor(c.min * total / min)) : columns.map((c) => Math.floor(c.min + (total - min) * c.weight));
  result[result.length - 1] += total - result.reduce((s, w) => s + w, 0); return result;
}
function page(doc) { const p = doc.page; return { x: p.margins.left, top: p.margins.top, width: p.width - p.margins.left - p.margins.right, bottom: p.height - p.margins.bottom - PAGE.footer }; }
function h(doc, content, width, size = STYLE.body, font = 'Helvetica') { doc.font(font).fontSize(size); return Math.ceil(doc.heightOfString(text(content) || ' ', { width: Math.max(width, 1), lineGap: 1 })); }
function drawBox(doc, x, y, width, height, fill) { doc.save().lineWidth(.55).strokeColor(STYLE.line); if (fill) doc.fillColor(fill).roundedRect(x, y, width, height, 3).fillAndStroke(); else doc.roundedRect(x, y, width, height, 3).stroke(); doc.restore(); }
function drawFooter(doc, note, index) { const p = page(doc), label = ['This is a computer-generated invoice and does not require a physical signature', text(note)].filter(Boolean).join('  |  '); doc.font('Helvetica').fontSize(STYLE.small).fillColor(STYLE.muted).text(label, p.x, p.bottom + 8, { width: p.width, align: 'center' }); }
function drawTitle(doc, y, continued) { const p = page(doc), label = continued ? 'TAX INVOICE - CONTINUED' : 'TAX INVOICE', size = continued ? 11 : STYLE.title; doc.font('Helvetica-Bold').fontSize(size).fillColor(STYLE.accent).text(label, p.x, y, { width: p.width, align: 'center' }); return y + h(doc, label, p.width, size, 'Helvetica-Bold') + GAP; }

function drawCompany(doc, y, invoice, company) {
  const p = page(doc), hasLogo = company.logoPath && fs.existsSync(company.logoPath), logoWidth = hasLogo ? 92 : 0, x = p.x + (logoWidth ? logoWidth + 14 : PAD), width = p.x + p.width - PAD - x;
  const name = text(company.name || invoice.supplier_name), lines = [text(company.address || invoice.supplier_address), text(company.email) && 'Email: ' + text(company.email), text(company.mobile) && 'Mobile: ' + text(company.mobile), text(company.gst || invoice.supplier_gst) && 'GSTIN: ' + text(company.gst || invoice.supplier_gst)].filter(Boolean);
  const height = Math.max(hasLogo ? 70 : 0, PAD * 2 + h(doc, name, width, STYLE.company, 'Helvetica-Bold') + 2 + lines.reduce((s, line) => s + h(doc, line, width), 0));
  drawBox(doc, p.x, y, p.width, height);
  if (hasLogo) try { doc.image(company.logoPath, p.x + PAD, y + PAD, { fit: [logoWidth - 10, height - PAD * 2] }); } catch (_) { /* optional image */ }
  let lineY = y + PAD; doc.font('Helvetica-Bold').fontSize(STYLE.company).fillColor(STYLE.ink).text(name, x, lineY, { width }); lineY += h(doc, name, width, STYLE.company, 'Helvetica-Bold') + 2;
  lines.forEach((line) => { const lineHeight = h(doc, line, width); doc.font('Helvetica').fontSize(STYLE.body).text(line, x, lineY, { width, lineGap: 1 }); lineY += lineHeight; });
  return y + height + GAP;
}
function labelHeight(doc, label, content, width) { doc.font('Helvetica-Bold').fontSize(STYLE.body); const labelWidth = Math.min(66, Math.max(38, doc.widthOfString(label) + 4)); return Math.max(h(doc, label, labelWidth, STYLE.body, 'Helvetica-Bold'), h(doc, content, width - labelWidth)) + 2; }
function label(doc, x, y, width, title, content) { doc.font('Helvetica-Bold').fontSize(STYLE.body); const labelWidth = Math.min(66, Math.max(38, doc.widthOfString(title) + 4)), height = labelHeight(doc, title, content, width); doc.text(title, x, y, { width: labelWidth }); doc.font('Helvetica').text(text(content), x + labelWidth, y, { width: width - labelWidth, lineGap: 1 }); return height; }
function drawParty(doc, y, invoice) {
  const p = page(doc), gap = 8, left = Math.floor((p.width - gap) * .58), right = p.width - gap - left;
  const bill = [['Bill To', ''], ['Name:', text(invoice.customer_name || invoice.bill_to)], ['Address:', text(invoice.customer_address || invoice.bill_to_address)], ...(text(invoice.customer_gst) ? [['GSTIN:', text(invoice.customer_gst)]] : [])];
  const details = [['Invoice Details', ''], ['Invoice No:', text(invoice.invoice_number)], ['Date:', text(invoice.invoice_date)], ...(text(invoice.challan_no) ? [['Challan No:', text(invoice.challan_no)]] : [])];
  const panelHeight = (rows, width) => PAD * 2 + rows.reduce((sum, row, i) => sum + (i ? labelHeight(doc, row[0], row[1], width - PAD * 2) : h(doc, row[0], width - PAD * 2, STYLE.body + 1, 'Helvetica-Bold') + 3), 0);
  const height = Math.max(panelHeight(bill, left), panelHeight(details, right)); drawBox(doc, p.x, y, left, height); drawBox(doc, p.x + left + gap, y, right, height);
  const render = (x, width, rows) => { let rowY = y + PAD; rows.forEach((row, i) => { if (!i) { doc.font('Helvetica-Bold').fontSize(STYLE.body + 1).fillColor(STYLE.accent).text(row[0], x + PAD, rowY, { width: width - PAD * 2 }); rowY += h(doc, row[0], width - PAD * 2, STYLE.body + 1, 'Helvetica-Bold') + 3; } else rowY += label(doc, x + PAD, rowY, width - PAD * 2, row[0], row[1]); }); };
  render(p.x, left, bill); render(p.x + left + gap, right, details); return y + height + GAP;
}

function headerHeight(doc, columns, widths) { return Math.max(...columns.map((c, i) => h(doc, c.label, widths[i] - PAD * 2, STYLE.table, 'Helvetica-Bold'))) + PAD * 2; }
function drawHeader(doc, x, y, columns, widths) {
  const height = headerHeight(doc, columns, widths), total = widths.reduce((s, w) => s + w, 0); doc.save().fillColor(STYLE.fill).rect(x, y, total, height).fill().restore(); let cellX = x;
  columns.forEach((column, i) => { doc.font('Helvetica-Bold').fontSize(STYLE.table).fillColor(STYLE.ink).text(column.label, cellX + PAD, y + PAD, { width: widths[i] - PAD * 2, align: 'center', lineGap: 1 }); doc.save().lineWidth(.35).strokeColor(STYLE.line).moveTo(cellX, y).lineTo(cellX, y + height).stroke().restore(); cellX += widths[i]; });
  doc.save().lineWidth(.55).strokeColor(STYLE.line).rect(x, y, total, height).stroke().restore(); return height;
}
function cell(key, item, index) {
  if (item._continuation && key !== 'description') return '';
  const description = item._descriptionText === undefined ? [item.product_name, item.description].filter(Boolean).join(item.product_name && item.description ? '\n' : '') : item._descriptionText;
  return text({ sno: index + 1, description, hsn: item.hsn_sac, qty: qty(item.quantity, item.quantity_unit), unitPrice: value(item.unit_price), cgstRate: rate(item.cgst_rate), cgstAmount: value(item.cgstAmount), sgstRate: rate(item.sgst_rate), sgstAmount: value(item.sgstAmount), igstRate: rate(item.igst_rate), igstAmount: value(item.igstAmount), amount: value(item.lineAmount) }[key]);
}
function rowHeight(doc, item, index, columns, widths) { return Math.max(...columns.map((column, i) => h(doc, cell(column.key, item, index), widths[i] - PAD * 2, STYLE.table))) + PAD * 2; }
function drawRow(doc, x, y, height, item, index, columns, widths) {
  let cellX = x; const total = widths.reduce((s, w) => s + w, 0);
  columns.forEach((column, i) => {
    const content = cell(column.key, item, index), width = widths[i] - PAD * 2;
    // Numeric cells must not wrap into a second line.  They shrink only when a
    // legitimately large Indian-formatted amount needs the extra room.
    let size = STYLE.table;
    if (column.align === 'right') {
      doc.font('Helvetica').fontSize(size);
      while (size > 5.5 && doc.widthOfString(content) > width) { size -= .25; doc.fontSize(size); }
    }
    doc.font('Helvetica').fontSize(size).fillColor(STYLE.ink).text(content, cellX + PAD, y + PAD, { width, align: column.align, lineGap: 1, lineBreak: column.align === 'left' || column.align === 'center' });
    doc.save().lineWidth(.35).strokeColor(STYLE.line).moveTo(cellX, y).lineTo(cellX, y + height).stroke().restore(); cellX += widths[i];
  });
  doc.save().lineWidth(.55).strokeColor(STYLE.line).rect(x, y, total, height).stroke().restore();
}
function splitLongRow(doc, item, index, columns, widths, maxHeight) {
  const description = cell('description', item, index);
  if (rowHeight(doc, item, index, columns, widths) <= maxHeight || !description) return [item];
  const words = description.split(/\s+/), parts = []; let current = '';
  words.forEach((word) => {
    const candidate = current ? current + ' ' + word : word;
    const candidateItem = { ...item, _descriptionText: candidate };
    if (current && rowHeight(doc, candidateItem, index, columns, widths) > maxHeight) {
      parts.push({ ...item, _descriptionText: current, _continuation: parts.length > 0 }); current = word;
    } else current = candidate;
  });
  if (current) parts.push({ ...item, _descriptionText: current, _continuation: parts.length > 0 });
  return parts;
}

function wordsBelowThousand(value) { return numberToWords.toWords(value).replace(/-/g, ' ').toUpperCase(); }
function amountWords(total) {
  let remaining = Math.max(0, Math.round(number(total)));
  if (!remaining) return 'ZERO RUPEES ONLY';
  const parts = [];
  [[10000000, 'CRORE'], [100000, 'LAKH'], [1000, 'THOUSAND']].forEach(([unit, label]) => {
    const count = Math.floor(remaining / unit);
    if (count) { parts.push(wordsBelowThousand(count) + ' ' + label); remaining %= unit; }
  });
  if (remaining) parts.push(wordsBelowThousand(remaining));
  return parts.join(' ') + ' RUPEES ONLY';
}
function totalRows(totals) { 
  const rows = [['Subtotal', inr(totals.subtotal)], ...(totals.gstType === 'IGST' && totals.igstAmount ? [['IGST', inr(totals.igstAmount)]] : []), ...(totals.gstType === 'CGST_SGST' && totals.cgstAmount ? [['CGST', inr(totals.cgstAmount)], ['SGST', inr(totals.sgstAmount)]] : [])];
  if (totals.roundOff !== undefined && totals.roundOff !== null && totals.roundOff !== 0) {
    rows.push(['Round Off', inrSigned(totals.roundOff)]);
  }
  rows.push(['Grand Total', inr(totals.grandTotal)]);
  return rows;
}
function totalsHeight(doc, totals, words, wordWidth) { return Math.max(totalRows(totals).length * 17 + PAD * 2, h(doc, words, wordWidth - PAD * 2) + 28); }
function drawTotals(doc, y, totals) {
  const p = page(doc), gap = 8, wordsWidth = Math.floor((p.width - gap) * .56), totalsWidth = p.width - gap - wordsWidth, words = amountWords(totals.grandTotal), height = totalsHeight(doc, totals, words, wordsWidth); drawBox(doc, p.x, y, wordsWidth, height); drawBox(doc, p.x + wordsWidth + gap, y, totalsWidth, height);
  doc.font('Helvetica-Bold').fontSize(STYLE.body).fillColor(STYLE.accent).text('Amount (in words)', p.x + PAD, y + PAD, { width: wordsWidth - PAD * 2 }); doc.font('Helvetica').fontSize(STYLE.body).fillColor(STYLE.ink).text(words, p.x + PAD, y + 20, { width: wordsWidth - PAD * 2, lineGap: 1 });
  let rowY = y + PAD, totalsX = p.x + wordsWidth + gap; totalRows(totals).forEach((row, i, rows) => { const bold = i === rows.length - 1, color = bold ? STYLE.accent : STYLE.ink; doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(STYLE.body).fillColor(color); doc.text(row[0], totalsX + PAD, rowY, { width: totalsWidth * .48 }); doc.font(bold ? 'InvoiceCurrencyBold' : 'InvoiceCurrency').text(row[1], totalsX + totalsWidth * .48, rowY, { width: totalsWidth * .52 - PAD, align: 'right' }); rowY += 17; });
  return y + height + GAP;
}
function bankLines(bank = {}) { return [['Beneficiary', bank.beneficiary], ['Bank', bank.bankName], ['A/C No.', bank.accountNumber], ['IFSC', bank.ifsc], ['Branch', bank.branch]].filter(([, v]) => text(v)).map(([label, v]) => label + ': ' + text(v)); }
function bankHeight(doc, company, width) { const lines = bankLines(company.bankDetails), bank = lines.length ? 22 + lines.reduce((s, line) => s + h(doc, line, width / 2 - PAD * 2, STYLE.small), 0) : 22; return Math.max(70, bank + PAD * 2, h(doc, 'For ' + text(company.name), width / 2 - PAD * 2, STYLE.body, 'Helvetica-Bold') + 55); }
function drawBank(doc, y, company) {
  const p = page(doc), height = bankHeight(doc, company, p.width), half = p.width / 2, lines = bankLines(company.bankDetails); drawBox(doc, p.x, y, p.width, height); doc.save().lineWidth(.45).strokeColor(STYLE.line).moveTo(p.x + half, y).lineTo(p.x + half, y + height).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(STYLE.body).fillColor(STYLE.accent).text('Bank Details', p.x + PAD, y + PAD, { width: half - PAD * 2 }); let lineY = y + 21; lines.forEach((line) => { const lineHeight = h(doc, line, half - PAD * 2, STYLE.small); doc.font('Helvetica').fontSize(STYLE.small).fillColor(STYLE.ink).text(line, p.x + PAD, lineY, { width: half - PAD * 2, lineGap: 1 }); lineY += lineHeight; });
  const right = p.x + half; doc.font('Helvetica-Bold').fontSize(STYLE.body).text('For ' + text(company.name), right + PAD, y + PAD, { width: half - PAD * 2, align: 'center' }); const signatureY = y + height - 28; doc.save().lineWidth(.6).strokeColor(STYLE.line).moveTo(right + 42, signatureY).lineTo(right + half - 42, signatureY).stroke().restore(); doc.font('Helvetica').fontSize(STYLE.small).text('Authorised Signatory', right + PAD, signatureY + 4, { width: half - PAD * 2, align: 'center' }); return y + height + GAP;
}

async function generateAndSavePDF(invoiceObj = {}, companyConfig = {}) {
  const invoice = { ...invoiceObj, items: Array.isArray(invoiceObj.items) ? invoiceObj.items.map((item) => ({ ...item })) : [] };
  const gstType = determineGstType(invoice, companyConfig);
  
  // Use passed totals if provided (for precision matching frontend), else calculate
  const hasPassedTotals = invoice.subtotal !== undefined && invoice.total_gst !== undefined && invoice.total !== undefined;
  const totals = hasPassedTotals
    ? {
        gstType,
        items: invoice.items.map((item, idx) => {
          // Normalize items for PDF rendering
          const quantity = number(item.quantity);
          const unitPrice = number(item.unit_price ?? item.rate);
          const taxableAmount = money(quantity * unitPrice);
          let cgstRate = number(item.cgst_rate);
          let sgstRate = number(item.sgst_rate);
          let igstRate = number(item.igst_rate);
          if (gstType === 'CGST_SGST') {
            if (!cgstRate && !sgstRate && igstRate) cgstRate = sgstRate = igstRate / 2;
            igstRate = 0;
          } else {
            if (!igstRate) igstRate = cgstRate + sgstRate;
            cgstRate = sgstRate = 0;
          }
          const cgstAmount = money(taxableAmount * cgstRate / 100);
          const sgstAmount = money(taxableAmount * sgstRate / 100);
          const igstAmount = money(taxableAmount * igstRate / 100);
          const gstAmount = money(cgstAmount + sgstAmount + igstAmount);
          return { ...item, product_name: text(item.product_name || item.name), description: text(item.description), hsn_sac: text(item.hsn_sac || item.hsn), quantity, unit_price: unitPrice, cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate, taxableAmount, cgstAmount, sgstAmount, igstAmount, gstAmount, lineAmount: money(taxableAmount + gstAmount) };
        }),
        subtotal: invoice.subtotal,
        cgstAmount: invoice.gstType === 'IGST' ? 0 : invoice.total_gst / 2,
        sgstAmount: invoice.gstType === 'IGST' ? 0 : invoice.total_gst / 2,
        igstAmount: invoice.gstType === 'IGST' ? invoice.total_gst : 0,
        totalGst: invoice.total_gst,
        roundOff: invoice.round_off || 0,
        grandTotal: invoice.total,
        total: invoice.total,
      }
    : calculateTotals(invoice.items, gstType, invoice.round_off);
  
  const columns = getColumns(gstType);
  const date = text(invoice.invoice_date).slice(0, 10) || new Date().toISOString().slice(0, 10), directory = path.join(process.cwd(), 'storage', 'invoices', date, safeName(invoice.customer_name || invoice.customer));
  fs.mkdirSync(directory, { recursive: true }); const filePath = path.join(directory, safeName(invoice.invoice_number || 'invoice') + '.pdf');
  const doc = new PDFDocument({ size: PAGE.size, margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin }, info: { Title: 'Invoice ' + text(invoice.invoice_number) } }), stream = fs.createWriteStream(filePath); doc.registerFont('InvoiceCurrency', CURRENCY_FONT); doc.registerFont('InvoiceCurrencyBold', CURRENCY_FONT_BOLD); doc.pipe(stream);
  const note = text(companyConfig.footer || invoice.footer_note); let pageIndex = 1, y = drawTitle(doc, page(doc).top); y = drawCompany(doc, y, invoice, companyConfig); y = drawParty(doc, y, invoice);
  const p = page(doc), widths = columnWidths(columns, p.width); let tableHeight = drawHeader(doc, p.x, y, columns, widths); y += tableHeight;
  const nextTablePage = () => { drawFooter(doc, note, pageIndex); doc.addPage(); pageIndex += 1; y = drawTitle(doc, page(doc).top, true); doc.font('Helvetica').fontSize(STYLE.small).fillColor(STYLE.muted).text('Invoice No: ' + text(invoice.invoice_number) + '    Date: ' + text(invoice.invoice_date), page(doc).x, y, { width: page(doc).width, align: 'center' }); y += 15; tableHeight = drawHeader(doc, page(doc).x, y, columns, widths); y += tableHeight; };
  totals.items.forEach((item, index) => {
    const maxRowHeight = page(doc).bottom - page(doc).top - 50;
    splitLongRow(doc, item, index, columns, widths, maxRowHeight).forEach((part) => {
      const height = rowHeight(doc, part, index, columns, widths);
      if (y + height > page(doc).bottom && y > page(doc).top + tableHeight + 1) nextTablePage();
      drawRow(doc, page(doc).x, y, height, part, index, columns, widths); y += height;
    });
  });
  const finalHeight = () => totalsHeight(doc, totals, amountWords(totals.grandTotal), Math.ceil(page(doc).width * .56)) + GAP + bankHeight(doc, companyConfig, page(doc).width);
  if (y + finalHeight() > page(doc).bottom) { drawFooter(doc, note, pageIndex); doc.addPage(); pageIndex += 1; y = drawTitle(doc, page(doc).top, true); }
  // Keep the financial summary visually tied to payment/signature information.
  // Any remaining space belongs between the item table and these final blocks.
  y = Math.max(y + GAP, page(doc).bottom - finalHeight());
  y = drawTotals(doc, y, totals); drawBank(doc, y, companyConfig); drawFooter(doc, note, pageIndex); doc.end();
  await new Promise((resolve, reject) => stream.on('finish', resolve).on('error', reject)); return filePath;
}
module.exports = { calculateTotals, generateAndSavePDF, determineGstType };
