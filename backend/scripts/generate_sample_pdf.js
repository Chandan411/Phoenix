const path = require('path');
const { generateAndSavePDF } = require('../src/services/pdfServiceVistar');

const invoice = {
  invoice_number: 'TEST-1234',
  invoice_date: '2026-07-17',
  customer_name: 'Test Customer',
  customer_address: '1234 Long Address Road, Some City, Some State, Some Country, PIN 560001',
  customer_gst: '29AAAAA0000A1Z5',
  items: [
    {
      product_name: 'Very Long Product Name That Should Wrap Correctly In The Description Column',
      description: 'This is a long description with details that should wrap across multiple lines to test the PDF rendering logic. It includes measurements, specifications, and extra notes to force wrapping in the invoice table cell.',
      quantity: 123456789,
      unit_price: 9.99,
      cgst_rate: 9,
      sgst_rate: 9,
      hsn_sac: '998877'
    },
    {
      product_name: 'Short Item',
      description: 'Short desc',
      quantity: 2,
      unit_price: 150.00,
      cgst_rate: 9,
      sgst_rate: 9,
      hsn_sac: '998877'
    }
  ]
};

const company = {
  name: 'Vistar Enterprises (Test)',
  address: 'Company Address Line 1\nCompany Address Line 2',
  gst: '27AAAAA0000A1Z5',
  email: 'hello@example.com',
  mobile: '9999999999',
  logoPath: ''
};

(async () => {
  try {
    const p = await generateAndSavePDF(invoice, company);
    console.log('Generated PDF:', p);
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
})();
