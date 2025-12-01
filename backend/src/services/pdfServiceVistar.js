// pdfService.js
// Final production-ready, single-page invoice generator (PDFKit).
// - Clean professional layout
// - Single page only (fits content by scaling/truncation)
// - Bottom box: Bank Details (left) | For <Company Name> + signature (right) — equal split
// - Amount in words inside a boxed, bold area
// - Footer message placed at extreme bottom (outside boxes) in small muted font
// - No duplicate table lines or overlapping boxes

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const numberToWords = require('number-to-words');

function safeName(s) { return (s || 'unknown').replace(/[\/\\:?<>|"]/g, '_').slice(0, 50); }

function calculateTotals(items){
  let subtotal = 0, totalGst = 0;
  const enriched = (items||[]).map(it => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    const gstRate = (Number(it.cgst_rate)||0) + (Number(it.sgst_rate)||0) + (Number(it.igst_rate)||0);
    const line = qty * price;
    const gstAmt = line * (gstRate / 100);
    subtotal += line;
    totalGst += gstAmt;
    return {...it, line_total: +(line + gstAmt)};
  });
  const total = +(subtotal + totalGst);
  return {
    items: enriched,
    subtotal: +subtotal.toFixed(2),
    totalGst: +totalGst.toFixed(2),
    total: +total.toFixed(2)
  };
}

// Page & style constants
const PAGE = { size: 'A4', margin: 36 };
const STYLE = {
  titleSize: 18,
  compNameSize: 12,
  normalSize: 9,
  smallSize: 7,
  minFontSize: 6,
  logoMaxW: 130,
  logoMaxH: 60,
  gap: 8,
  boxRadius: 6,
  subtleLine: 0.25
};

// helpers
function truncateToWidth(doc, text, width, font, size) {
  if (!text) return '';
  doc.font(font).fontSize(size);
  if (doc.widthOfString(text) <= width) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1)/2);
    const s = text.slice(0, mid) + '…';
    if (doc.widthOfString(s) <= width) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

async function generateAndSavePDF(invoiceObj = {}, companyConfig = {}) {
  // output
  const dateStr = invoiceObj.invoice_date || new Date().toISOString().slice(0,10);
  const custSafe = safeName(invoiceObj.customer_name || invoiceObj.customer || 'customer');
  const outdir = path.join(process.cwd(), 'storage', 'invoices', dateStr, custSafe);
  fs.mkdirSync(outdir, { recursive: true });
  const filename = `${invoiceObj.invoice_number || 'invoice'}.pdf`;
  const filepath = path.join(outdir, filename);

  // compute totals/items if missing
  if (!invoiceObj.subtotal || !invoiceObj.total || !invoiceObj.total_gst) {
    const calc = calculateTotals(invoiceObj.items || []);
    invoiceObj.subtotal = calc.subtotal;
    invoiceObj.total_gst = calc.totalGst;
    invoiceObj.total = calc.total;
    invoiceObj.items = calc.items;
  }

  const doc = new PDFDocument({ size: PAGE.size, margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  const page = doc.page;
  const contentW = page.width - page.margins.left - page.margins.right;
  let cursorY = page.margins.top;

  const F_REG = 'Helvetica', F_BOLD = 'Helvetica-Bold', F_ITALIC = 'Helvetica-Oblique';

  // Title centered
  doc.font(F_BOLD).fontSize(STYLE.titleSize);
  const titleH = doc.heightOfString('TAX INVOICE', { width: contentW });
  doc.text('TAX INVOICE', page.margins.left, cursorY, { width: contentW, align: 'center' });
  cursorY += titleH + STYLE.gap * 1.2;

  // Company box (full width) - clean and minimal
  const compBoxH = 86;
  const compX = page.margins.left, compW = contentW, compY = cursorY;
  doc.roundedRect(compX, compY, compW, compBoxH, STYLE.boxRadius).lineWidth(0.7).stroke();

  // Logo area (left)
  const logoX = compX + 12, logoY = compY + 12;
  const logoW = Math.min(STYLE.logoMaxW, Math.floor(compW * 0.16));
  const logoH = Math.min(STYLE.logoMaxH, compBoxH - 24);
  // Render logo image if provided (kept optional). If no image provided, leave blank.
  try {
    if (companyConfig.logoPath && fs.existsSync(companyConfig.logoPath)) {
      // draw image fitted into reserved area
      try {
        doc.image(companyConfig.logoPath, logoX, logoY, { fit: [logoW, logoH], align: 'left', valign: 'top' });
      } catch (e) {
        // If image fails to load, draw an empty placeholder border so layout stays consistent
        doc.rect(logoX, logoY, logoW, logoH).lineWidth(0.4).stroke();
      }
    } else {
      // no logo file, draw an empty placeholder rectangle to preserve spacing
      doc.rect(logoX, logoY, logoW, logoH).lineWidth(0.4).stroke();
    }
  } catch (e) {
    // ignore filesystem errors and continue without logo
  }

  // Company text (right of logo) - aligned left, neat spacing
  const compTextX = logoX + logoW + 5;
  const compTextW = compX + compW - compTextX - 12;
  doc.font(F_BOLD).fontSize(STYLE.compNameSize).text(companyConfig.name || invoiceObj.supplier_name || '', compTextX, compY + 12, { width: compTextW, align: 'left' });
  doc.font(F_REG).fontSize(STYLE.normalSize).text(companyConfig.address || invoiceObj.supplier_address || '', compTextX, compY + 30, { width: compTextW, align: 'left' });
  doc.font(F_REG).fontSize(STYLE.normalSize).text('Email: ' + companyConfig.email || '', compTextX, compY + 42, { width: compTextW, align: 'left' });
  doc.font(F_REG).fontSize(STYLE.normalSize).text('Mobile: ' + companyConfig.mobile, compTextX, compY + 54);
  doc.font(F_BOLD).fontSize(STYLE.compNameSize - 2).text(`GSTIN: ${companyConfig.gst || invoiceObj.supplier_gst || ''}`, compTextX, compY + compBoxH - 15, { width: compTextW, align: 'left' });

  cursorY += compBoxH + STYLE.gap;

  // Bill To & Invoice Details (side by side)
  const rowH = 74;
  const rowX = page.margins.left, rowW = contentW;
  const leftW = Math.floor(rowW * 0.55), rightW = rowW - leftW - 12;
  const leftX = rowX, rightX = rowX + leftW + 12;
  const rowY = cursorY;

  // Left box
  doc.roundedRect(leftX, rowY, leftW, rowH, STYLE.boxRadius).lineWidth(0.5).stroke();
  doc.font(F_BOLD).fontSize(STYLE.normalSize+1).text('Bill To:', leftX + 10, rowY + 8);
  // Name
  doc.font(F_BOLD).fontSize(STYLE.normalSize).text('Name: ' + (invoiceObj.customer_name || invoiceObj.bill_to || ''), leftX + 10, rowY + 26, { width: leftW - 20 });
  // Address (handle long address by wrapping and reducing font size)
  let billToY = rowY + 26 + 18;
  doc.font(F_BOLD).fontSize(STYLE.normalSize).text('Address:', leftX + 10, billToY, { width: 60 });
  let billToAddress = invoiceObj.customer_address || invoiceObj.bill_to_address || '';
  let billToAddressFontSize = STYLE.normalSize;
  let billToAddressBoxW = leftW - 72;
  doc.font(F_REG).fontSize(billToAddressFontSize);
  while (doc.heightOfString(billToAddress, { width: billToAddressBoxW }) > 18 && billToAddressFontSize > STYLE.minFontSize) {
    billToAddressFontSize--;
    doc.fontSize(billToAddressFontSize);
  }
  doc.text(billToAddress, leftX + 10 + 42, billToY, { width: billToAddressBoxW });
  // Gap after address
  billToY += 18;
  // GSTIN (bold)
  doc.font(F_BOLD).fontSize(STYLE.normalSize).text('GSTIN: ' + (invoiceObj.customer_gst || invoiceObj.bill_to_gstin || ''), leftX + 10, billToY, { width: leftW - 20 });

  // Challan No. logic
  let challanNo = '';
  if (invoiceObj.invoice_number) {
    const invNumStr = String(invoiceObj.invoice_number);
    challanNo = 'CH' + invNumStr.slice(-4);
  }

  // Right box
  doc.roundedRect(rightX, rowY, rightW, rowH, STYLE.boxRadius).lineWidth(0.5).stroke();
  doc.font(F_BOLD).fontSize(STYLE.normalSize+1).text('Invoice Details:', rightX + 10, rowY + 8);
  doc.font(F_REG).fontSize(STYLE.normalSize);
  doc.text(`Invoice No: ${invoiceObj.invoice_number || ''}`, rightX + 10, rowY + 26, { width: rightW - 20 });
  doc.text(`Date: ${invoiceObj.invoice_date || ''}`, rightX + 10, rowY + 44, { width: rightW - 20 });
  doc.text(`Challan No: ${challanNo}`, rightX + 10, rowY + 62, { width: rightW - 20 });

  cursorY += rowH + STYLE.gap;

  // Items table area - compute available height allocating space for totals + bottom box + footer message
  const footerReserved = 30; // footer message height
  const bottomAreaReserved = 200; // totals + bottom bank/sign box
  const tableTop = cursorY;
  const tableBottomLimit = page.height - page.margins.bottom - bottomAreaReserved - footerReserved;
  const tableH = Math.max(80, tableBottomLimit - tableTop);
  const tableX = page.margins.left, tableW = contentW, tableY = tableTop;

  // Table outer rect
  doc.rect(tableX, tableY, tableW, tableH).lineWidth(0.5).stroke();

  // Column widths
  const items = invoiceObj.items || [];
  let gstType = 'IGST';
  if (items.length > 0) {
    const first = items[0];
    if ((Number(first.cgst_rate) || 0) > 0 || (Number(first.sgst_rate) || 0) > 0) {
      gstType = 'CGST_SGST';
    }
  }
  let headers, colPercents;
  if (gstType === 'CGST_SGST') {
    // Insert HSN/SAC column after Description
    headers = ['SNo','Description','HSN/SAC','Qty','Unit Price','CGST %','SGST %','Amount'];
    colPercents = [6, 32, 12, 6, 12, 9, 9, 14];
  } else {
    headers = ['SNo','Description','HSN/SAC','Qty','Unit Price','IGST %','Amount'];
    colPercents = [6, 34, 12, 6, 12, 10, 20];
  }
  const colWidths = colPercents.map(p => Math.floor((p/100) * tableW));

  // Header
  const headerH = 20;
  doc.font(F_BOLD).fontSize(STYLE.normalSize);
  let tx = tableX;
  for (let i = 0; i < headers.length; i++) {
    // Center align all headers, keep '%' on same line by removing space before %
    let headerText = headers[i];
    if (headerText.endsWith(' %')) headerText = headerText.replace(' %', '%');
    doc.text(headerText, tx + 6, tableY + 6, {
      width: colWidths[i] - 12,
      align: 'center',
      lineBreak: false
    });
    // Draw vertical separators only between columns, not after last column
    const xNext = tx + colWidths[i];
    if (i < headers.length - 1) {
      doc.moveTo(xNext, tableY).lineTo(xNext, tableY + tableH).lineWidth(STYLE.subtleLine).stroke();
    }
    tx += colWidths[i];
  }
  doc.moveTo(tableX, tableY + headerH).lineTo(tableX + tableW, tableY + headerH).lineWidth(0.5).stroke();

  // Rows fitting logic (single page)
  const minRowH = 10, maxRowH = 18;
  const baseFont = STYLE.normalSize;
  const rowAreaH = tableH - headerH - 8;
  const rowCount = Math.max(0, items.length);

  // compute row height & font once
  let rowHVal = rowCount > 0 ? Math.floor(rowAreaH / rowCount) : maxRowH;
  if (rowHVal > maxRowH) rowHVal = maxRowH;
  if (rowHVal < minRowH) rowHVal = minRowH;
  let fontSizeVal = Math.max(STYLE.minFontSize, Math.floor(baseFont * (rowHVal / maxRowH)));
  if (fontSizeVal < STYLE.minFontSize) fontSizeVal = STYLE.minFontSize;

  doc.font(F_REG).fontSize(fontSizeVal);
  let currentRowY = tableY + headerH + 6;

  if (rowCount === 0) {
    doc.font(F_ITALIC).fontSize(STYLE.normalSize).text('No items', tableX + 8, tableY + headerH + 8);
  } else {
    for (let i = 0; i < rowCount; i++) {
      const it = items[i] || {};
      let cx = tableX;

      // SNo
      doc.text(String(i+1), cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[0] - 12, align: 'center' });
      cx += colWidths[0];

      // Description (truncate if too tall)
      const descW = colWidths[1] - 12;
      const rawDesc = `${it.product_name || ''}${it.description ? ' - ' + it.description : ''}`.trim();
      let desc = rawDesc;
      const estH = doc.heightOfString(desc, { width: descW });
      if (estH > rowHVal) desc = truncateToWidth(doc, desc, descW, F_REG, fontSizeVal);
      doc.text(desc, cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: descW, align: 'left' });
      cx += colWidths[1];

      // HSN/SAC (after description)
      const hsnVal = it.hsn_sac || '';
      doc.text(hsnVal, cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[2] - 12, align: 'center' });
      cx += colWidths[2];

      // Qty
      const qtyStr = it.quantity !== undefined && it.quantity !== null ? String(it.quantity) : '';
      doc.text(qtyStr, cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[3] - 12, align: 'right' });
      cx += colWidths[3];

      // Unit Price
      const up = (it.unit_price !== undefined && it.unit_price !== '') ? Number(it.unit_price).toFixed(2) : '';
      doc.text(up, cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[4] - 12, align: 'right' });
      cx += colWidths[4];

      if (gstType === 'CGST_SGST') {
        // CGST %
        doc.text((Number(it.cgst_rate) || 0).toFixed(2), cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[5] - 12, align: 'right' });
        cx += colWidths[5];
        // SGST %
        doc.text((Number(it.sgst_rate) || 0).toFixed(2), cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[6] - 12, align: 'right' });
        cx += colWidths[6];
      } else {
        // IGST %
        doc.text((Number(it.igst_rate) || 0).toFixed(2), cx + 6, currentRowY + (rowHVal - fontSizeVal)/2, { width: colWidths[5] - 12, align: 'right' });
        cx += colWidths[5];
      }

      // Amount
      // Center align and ensure value fits inside cell, shrink font if needed
      const gst = (Number(it.cgst_rate)||0) + (Number(it.sgst_rate)||0) + (Number(it.igst_rate)||0);
      const line = (Number(it.quantity)||0) * (Number(it.unit_price)||0);
      const gstAmt = line * (gst / 100);
      const total = line + gstAmt;
      let amountStr = Number(total).toFixed(2);
      let amountFontSize = fontSizeVal;
      // If value too wide, shrink font
      doc.font(F_REG).fontSize(amountFontSize);
      while (doc.widthOfString(amountStr) > colWidths[colWidths.length-1] - 12 && amountFontSize > STYLE.minFontSize) {
        amountFontSize--;
        doc.fontSize(amountFontSize);
      }
      doc.text(amountStr, cx + 6, currentRowY + (rowHVal - amountFontSize)/2, {
        width: colWidths[colWidths.length-1] - 12,
        align: 'right',
        ellipsis: true
      });

      currentRowY += rowHVal;
    }
  }

  // Move cursor below table
  cursorY = tableY + tableH + STYLE.gap;

  // Totals box (top-right)
  const totW = Math.floor(contentW * 0.36), totH = 76;
  const totX = page.margins.left + contentW - totW, totY = cursorY;
  // Adjusted box position and width for better alignment
  doc.roundedRect(totX, totY, totW, totH, STYLE.boxRadius).lineWidth(0.6).stroke();

  // Calculate round off and rounded total
  let roundOff = 0, roundedTotal = 0;
  if (invoiceObj.total !== undefined && invoiceObj.total !== null) {
    roundedTotal = Math.round(invoiceObj.total);
    roundOff = +(roundedTotal - invoiceObj.total).toFixed(2);
  }

  // Format numbers in INR currency style
  const formatINR = v => v !== undefined && v !== null ? parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  doc.text('Subtotal', totX + 10, totY + 10, { width: totW - 20, align: 'left' });
  doc.text(formatINR(invoiceObj.subtotal), totX + 10, totY + 10, { width: totW - 20, align: 'right' });
  doc.text('Total GST', totX + 10, totY + 28, { width: totW - 20, align: 'left' });
  doc.text(formatINR(invoiceObj.total_gst), totX + 10, totY + 28, { width: totW - 20, align: 'right' });
  doc.text('Round Off', totX + 10, totY + 46, { width: totW - 20, align: 'left' });
  doc.text((roundOff >= 0 ? '+' : '') + formatINR(roundOff), totX + 10, totY + 46, { width: totW - 20, align: 'right' });
  doc.font(F_BOLD).text('Grand Total', totX + 10, totY + 64, { width: totW - 20, align: 'left' });
  doc.text(formatINR(roundedTotal), totX + 10, totY + 64, { width: totW - 20, align: 'right' });

  // Amount in words boxed (left of totals) — bold and boxed
  const amountWords = invoiceObj.total ? (numberToWords.toWords(invoiceObj.total).toUpperCase() + ' RUPEES ONLY') : '';
  const wordsBoxX = page.margins.left, wordsBoxY = totY;
  const wordsBoxW = contentW - totW - 16, wordsBoxH = 56; // Adjusted width for alignment
  doc.roundedRect(wordsBoxX, wordsBoxY, wordsBoxW, wordsBoxH, 6).lineWidth(0.6).stroke();
  doc.font(F_BOLD).fontSize(STYLE.normalSize).text('Amount (in words):', wordsBoxX + 12, wordsBoxY + 12, { width: wordsBoxW - 24, align: 'left' });
  doc.font(F_BOLD).fontSize(STYLE.normalSize).text(amountWords, wordsBoxX + 12, wordsBoxY + 28, { width: wordsBoxW - 24, align: 'left' });

  cursorY = totY + Math.max(totH, wordsBoxH) + STYLE.gap;

  // Bottom box (Bank Details | For Company & Signature) - equal split
  const bottomBoxH = 100;
  const bottomBoxY = cursorY;
  const bottomBoxX = page.margins.left, bottomBoxW = contentW;
  doc.roundedRect(bottomBoxX, bottomBoxY, bottomBoxW, bottomBoxH, STYLE.boxRadius).lineWidth(0.7).stroke();

  // equal split
  const innerPad = 12;
  const halfW = Math.floor((bottomBoxW - innerPad*2 - 1) / 2); // -1 for divider
  const leftBoxX = bottomBoxX + innerPad, rightBoxX = bottomBoxX + innerPad + halfW + 1;
  const innerY = bottomBoxY + 12;

  // vertical divider (single thin line)
  const dividerX = bottomBoxX + innerPad + halfW;
  doc.moveTo(dividerX, bottomBoxY + 2).lineTo(dividerX, bottomBoxY + bottomBoxH - 2).lineWidth(0.8).stroke();

  // Left: Bank Details title + lines
  doc.font(F_BOLD).fontSize(STYLE.normalSize+0.5).text('Bank Details:', leftBoxX, innerY);
  doc.font(F_REG).fontSize(STYLE.smallSize);
  // Hardcoded static bank details
  const bankLines = [
    'Bank Name: BANK OF BARODA',
    'A/C No: 38350200000607',
    'IFSC: BARB0MULWES',
    'Branch: Mulund West',
    'Beneficiary: VISTAR ENTERPRISES'
  ];
  bankLines.forEach((ln, idx) => {
    doc.text(ln, leftBoxX, innerY + 18 + idx*14, { width: halfW - 8 });
  });

  // Right: For Company & signature (clean)
  doc.font(F_BOLD).fontSize(STYLE.normalSize+1).text(`For ${companyConfig.name || invoiceObj.supplier_name || ''}`, rightBoxX + 18, innerY); // Added left padding
  // signature line (clean)
  const sigY = innerY + 54;
  doc.moveTo(rightBoxX + 24, sigY).lineTo(rightBoxX + halfW - 6, sigY).lineWidth(0.7).stroke(); // Added left padding to line
  // 'Authorised Signatory' aligned to bottom right of the box
  doc.font(F_REG).fontSize(STYLE.normalSize).text('Authorised Signatory', rightBoxX, bottomBoxY + bottomBoxH - 22, {
    width: halfW - 8,
    align: 'right'
  });

  // Footer message at extreme bottom (outside boxed areas) - muted small text
  const footerMsg = companyConfig.footerNote || invoiceObj.footer_note || 'This is a computer-generated invoice and does not require a physical signature.';
  const footerY = page.height - page.margins.bottom - 12;
  doc.font(F_REG).fontSize(STYLE.smallSize).fillColor('#666666').text(footerMsg, page.margins.left, footerY, { width: contentW, align: 'center' });
  doc.fillColor('black');

  // finish
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

module.exports = { calculateTotals, generateAndSavePDF };
