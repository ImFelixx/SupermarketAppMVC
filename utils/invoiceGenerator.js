const PDFDocument = require("pdfkit");

/**
 * Stream a simple order invoice PDF to the response.
 * @param {object} res Express response
 * @param {object} params Order/invoice data
 */
function generateInvoicePDF(res, { order, items, customer }) {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${order.id}.pdf`);

    doc.pipe(res);

    doc
        .fontSize(20)
        .text("Supermarket Invoice", { align: "center" })
        .moveDown();

    doc.fontSize(12);
    doc.text(`Invoice #: ${order.id}`);
    doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.text(`Customer: ${customer?.name || "N/A"}`);
    if (customer?.email) doc.text(`Email: ${customer.email}`);
    doc.moveDown();

    doc.text("Items:");
    doc.moveDown(0.5);

    const tableHeaderY = doc.y;
    doc.text("Product", 50, tableHeaderY);
    doc.text("Qty", 250, tableHeaderY);
    doc.text("Price", 300, tableHeaderY);
    doc.text("Subtotal", 370, tableHeaderY);

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(520, doc.y).stroke();
    doc.moveDown(0.5);

    items.forEach((item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const subtotal = price * quantity;

        const y = doc.y;
        doc.text(item.productName, 50, y);
        doc.text(quantity.toString(), 250, y);
        doc.text(`$${price.toFixed(2)}`, 300, y);
        doc.text(`$${subtotal.toFixed(2)}`, 370, y);
        doc.moveDown();
    });

    const deliveryFee = Number(order.delivery_fee) || 0;
    const total = Number(order.total) || 0;
    const itemsTotal = items.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
    );

    doc.moveDown();
    doc.text(`Items Total: $${itemsTotal.toFixed(2)}`);
    doc.text(`Delivery Fee: $${deliveryFee.toFixed(2)}`);
    doc.fontSize(14).text(`Grand Total: $${total.toFixed(2)}`);

    doc.end();
}

module.exports = { generateInvoicePDF };
