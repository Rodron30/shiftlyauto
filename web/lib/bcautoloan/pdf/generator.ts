import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface PreApprovalPDFData {
  applicationNumber: string;
  submissionDate: Date;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  employmentStatus: string;
  employer: string;
  jobTitle: string;
  income: string;
  incomeFrequency: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleBudget: string;
  downPayment: string;
  hasTrade: boolean;
}

export async function generatePreApprovalPDF(
  data: PreApprovalPDFData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let y = height - 50;

  // Header
  page.drawText("BCAutoLoan", {
    x: 50,
    y,
    size: 24,
    font: fontBold,
    color: rgb(0.09, 0.46, 0.82),
  });
  y -= 30;

  page.drawText("Pre-Approval Application", {
    x: 50,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 40;

  // Application Details
  page.drawText("Application Details", {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  page.drawText(`Application Number: ${data.applicationNumber}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(
    `Submission Date: ${data.submissionDate.toLocaleDateString()} ${data.submissionDate.toLocaleTimeString()}`,
    {
      x: 50,
      y,
      size: 11,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    }
  );
  y -= 15;

  page.drawText(`Status: SUBMITTED`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  // Personal Information
  page.drawText("Personal Information", {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  page.drawText(`Name: ${data.firstName} ${data.lastName}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Email: ${data.email}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Phone: ${data.phone}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  // Address Information
  page.drawText("Address Information", {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  page.drawText(`Address: ${data.address}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`City: ${data.city}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Province: ${data.province}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Postal Code: ${data.postalCode}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  // Employment Information
  page.drawText("Employment Information", {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  page.drawText(`Employment Status: ${data.employmentStatus}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Employer: ${data.employer}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Job Title: ${data.jobTitle}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Income: ${data.income} (${data.incomeFrequency})`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  // Vehicle Information
  page.drawText("Vehicle Information", {
    x: 50,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  page.drawText(`Vehicle Type: ${data.vehicleType}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Make: ${data.vehicleMake}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Model: ${data.vehicleModel}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Budget: ${data.vehicleBudget}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Down Payment: ${data.downPayment}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Trade-in: ${data.hasTrade ? "Yes" : "No"}`, {
    x: 50,
    y,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 30;

  // Footer
  page.drawText("Source: BCAutoLoan Public Website", {
    x: 50,
    y,
    size: 10,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();

  return pdfBytes;
}
