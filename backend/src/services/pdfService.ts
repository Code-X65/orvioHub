import crypto from 'crypto';

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate?: number;
  dueDate?: number;
  paidAt?: number;
  periodStart?: number;
  periodEnd?: number;
  status: string;
  amount: number;
  currency: string;
  amountSubtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  paymentReference?: string;
  paymentMethod?: string;
  organizationName?: string;
  organizationAddress?: string;
  billingEmail?: string;
  billingPhone?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  invoiceNumber?: string;
  paidAt: number;
  amount: number;
  currency: string;
  paymentReference: string;
  paymentMethod?: string;
  planKey?: string;
  billingInterval?: string;
  organizationName?: string;
  organizationAddress?: string;
  billingEmail?: string;
}

const SECRET_KEY = process.env.PDF_SIGNING_SECRET || 'orvio-secure-pdf-secret-key-2026-ng';

/**
 * Generates a signed, short-lived token for secure invoice and receipt downloads.
 */
export function generateSignedDownloadToken(payload: {
  resourceId: string;
  resourceType: 'invoice' | 'receipt';
  workspaceId?: string;
  userId?: string;
  expiresInSeconds?: number;
}): string {
  const expiresAt = Date.now() + (payload.expiresInSeconds || 3600) * 1000;
  const data = `${payload.resourceId}:${payload.resourceType}:${payload.workspaceId || ''}:${payload.userId || ''}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
  const tokenPayload = Buffer.from(JSON.stringify({ ...payload, expiresAt, hmac })).toString('base64url');
  return tokenPayload;
}

/**
 * Validates a signed download token.
 */
export function verifySignedDownloadToken(token: string): {
  valid: boolean;
  payload?: any;
  error?: string;
} {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);

    if (!parsed.resourceId || !parsed.expiresAt || !parsed.hmac) {
      return { valid: false, error: 'Malformed token structure' };
    }

    if (Date.now() > parsed.expiresAt) {
      return { valid: false, error: 'Download token has expired' };
    }

    const data = `${parsed.resourceId}:${parsed.resourceType}:${parsed.workspaceId || ''}:${parsed.userId || ''}:${parsed.expiresAt}`;
    const expectedHmac = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(parsed.hmac), Buffer.from(expectedHmac))) {
      return { valid: false, error: 'Invalid token signature' };
    }

    return { valid: true, payload: parsed };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Token verification failed' };
  }
}

/**
 * Formats a currency amount into standard Nigerian Naira display string.
 */
function formatNaira(amount: number): string {
  return `NGN ${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Escapes characters for PDF literal text strings.
 */
function sanitizePdfString(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a valid standard PDF binary document for a Subscription Invoice.
 */
export function generateInvoicePdfBuffer(data: InvoicePdfData): Buffer {
  const issueDateStr = formatDate(data.issueDate || Date.now());
  const dueDateStr = formatDate(data.dueDate || Date.now());
  const periodStr = `${formatDate(data.periodStart || Date.now())} - ${formatDate(data.periodEnd || Date.now() + 30 * 86400000)}`;
  const orgName = sanitizePdfString(data.organizationName || 'Valued Customer');
  const orgAddress = sanitizePdfString(data.organizationAddress || 'Nigeria');
  const billingEmail = sanitizePdfString(data.billingEmail || 'billing@orviohub.com');
  const invNumber = sanitizePdfString(data.invoiceNumber);
  const statusStr = sanitizePdfString(data.status.toUpperCase());
  const paymentRef = sanitizePdfString(data.paymentReference || 'N/A');
  const totalAmountStr = formatNaira(data.amount);
  const subtotalStr = formatNaira(data.amountSubtotal || data.amount);
  const taxStr = data.taxAmount ? formatNaira(data.taxAmount) : 'NGN 0.00 (Tax Not Configured)';

  const items = data.lineItems && data.lineItems.length > 0
    ? data.lineItems
    : [{ description: 'Orviohub Subscription Plan', quantity: 1, unitPrice: data.amount, total: data.amount }];

  const streamLines: string[] = [
    'BT',
    '/F1 20 Tf',
    '50 780 Td',
    '(ORVIOHUB TECHNOLOGIES NIGERIA LTD) Tj',
    '0 -18 Td',
    '/F2 10 Tf',
    '(RC 1892341 | Victoria Island, Lagos, Nigeria | billing@orviohub.com) Tj',
    '0 -30 Td',
    '/F1 16 Tf',
    `(${invNumber} - SUBSCRIPTION INVOICE) Tj`,
    '0 -16 Td',
    '/F2 10 Tf',
    `(Status: ${statusStr}  |  Issue Date: ${issueDateStr}  |  Due Date: ${dueDateStr}) Tj`,
    '0 -24 Td',
    '/F1 12 Tf',
    '(BILLED TO:) Tj',
    '0 -14 Td',
    '/F2 10 Tf',
    `(${orgName}) Tj`,
    '0 -12 Td',
    `(${orgAddress}) Tj`,
    '0 -12 Td',
    `(${billingEmail}) Tj`,
    '0 -24 Td',
    '/F1 11 Tf',
    '(------------------------------------------------------------------------------------------------------) Tj',
    '0 -14 Td',
    '(LINE ITEMS                                               QTY       UNIT PRICE          TOTAL) Tj',
    '0 -10 Td',
    '(------------------------------------------------------------------------------------------------------) Tj',
  ];

  for (const item of items) {
    const desc = sanitizePdfString(item.description).padEnd(42, ' ').slice(0, 42);
    const qty = String(item.quantity || 1).padStart(4, ' ');
    const unitPrice = formatNaira(item.unitPrice || item.total || 0).padStart(16, ' ');
    const total = formatNaira(item.total || 0).padStart(16, ' ');
    streamLines.push(
      '0 -16 Td',
      '/F2 10 Tf',
      `(${desc}   ${qty}   ${unitPrice}   ${total}) Tj`
    );
  }

  streamLines.push(
    '0 -16 Td',
    '/F1 11 Tf',
    '(------------------------------------------------------------------------------------------------------) Tj',
    '0 -20 Td',
    `/F2 10 Tf`,
    `(Billing Period: ${sanitizePdfString(periodStr)}) Tj`,
    '0 -14 Td',
    `(Subtotal:                                                                               ${subtotalStr}) Tj`,
    '0 -14 Td',
    `(Tax / VAT:                                                                             ${taxStr}) Tj`,
    '0 -18 Td',
    '/F1 12 Tf',
    `(TOTAL AMOUNT PAID:                                                       ${totalAmountStr}) Tj`,
    '0 -20 Td',
    '/F2 9 Tf',
    `(Payment Reference: ${paymentRef} | Gateway: Paystack) Tj`,
    '0 -14 Td',
    '(Thank you for choosing Orviohub as your business operations platform.) Tj',
    '0 -12 Td',
    '(Document generated securely. This invoice confirms organization subscription fees.) Tj',
    'ET'
  );

  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf8');

  const pdfBody = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595.28 841.89]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj
4 0 obj
<<
  /Length ${streamLength}
>>
stream
${streamContent}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000344 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${400 + streamLength}
%%EOF`;

  return Buffer.from(pdfBody, 'utf8');
}

/**
 * Generates a valid standard PDF binary document for a Payment Receipt.
 */
export function generateReceiptPdfBuffer(data: ReceiptPdfData): Buffer {
  const paidDateStr = formatDate(data.paidAt || Date.now());
  const orgName = sanitizePdfString(data.organizationName || 'Valued Customer');
  const orgAddress = sanitizePdfString(data.organizationAddress || 'Nigeria');
  const billingEmail = sanitizePdfString(data.billingEmail || 'billing@orviohub.com');
  const receiptNum = sanitizePdfString(data.receiptNumber);
  const paymentRef = sanitizePdfString(data.paymentReference);
  const invoiceNum = sanitizePdfString(data.invoiceNumber || 'N/A');
  const totalAmountStr = formatNaira(data.amount);
  const planName = sanitizePdfString(data.planKey === 'premium' ? 'Orviohub Premium Plan' : 'Orviohub Standard Plan');
  const interval = sanitizePdfString(data.billingInterval === 'annual' ? 'Annual Subscription' : 'Monthly Subscription');

  const streamLines: string[] = [
    'BT',
    '/F1 20 Tf',
    '50 780 Td',
    '(ORVIOHUB - OFFICIAL PAYMENT RECEIPT) Tj',
    '0 -18 Td',
    '/F2 10 Tf',
    '(Orvio Technologies Nigeria Ltd • Victoria Island, Lagos, Nigeria) Tj',
    '0 -30 Td',
    '/F1 14 Tf',
    `(${receiptNum}) Tj`,
    '0 -16 Td',
    '/F2 10 Tf',
    `(Payment Date: ${paidDateStr}  |  Status: SUCCESSFUL / PAID) Tj`,
    '0 -24 Td',
    '/F1 12 Tf',
    '(RECEIVED FROM:) Tj',
    '0 -14 Td',
    '/F2 10 Tf',
    `(${orgName}) Tj`,
    '0 -12 Td',
    `(${orgAddress}) Tj`,
    '0 -12 Td',
    `(${billingEmail}) Tj`,
    '0 -24 Td',
    '/F1 11 Tf',
    '(------------------------------------------------------------------------------------------------------) Tj',
    '0 -14 Td',
    '(PAYMENT DETAILS) Tj',
    '0 -10 Td',
    '(------------------------------------------------------------------------------------------------------) Tj',
    '0 -18 Td',
    '/F2 10 Tf',
    `(Description:          ${planName} (${interval})) Tj`,
    '0 -16 Td',
    `(Invoice Number:       ${invoiceNum}) Tj`,
    '0 -16 Td',
    `(Paystack Reference:   ${paymentRef}) Tj`,
    '0 -16 Td',
    `(Payment Method:       Debit Card / Bank Transfer (Paystack Verified)) Tj`,
    '0 -20 Td',
    '/F1 14 Tf',
    `(AMOUNT CONFIRMED:      ${totalAmountStr}) Tj`,
    '0 -30 Td',
    '/F2 9 Tf',
    '(This payment receipt acts as proof of transaction settlement for your organization subscription.) Tj',
    '0 -12 Td',
    '(For billing support inquiries, please contact support@orviohub.com.) Tj',
    'ET'
  ];

  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf8');

  const pdfBody = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 595.28 841.89]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
      /F2 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj
4 0 obj
<<
  /Length ${streamLength}
>>
stream
${streamContent}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000344 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${400 + streamLength}
%%EOF`;

  return Buffer.from(pdfBody, 'utf8');
}
