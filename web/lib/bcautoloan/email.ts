import { Resend } from "resend";



type PreApprovalNotification = {
  applicationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleBudget: string;
};

type SellCarNotification = {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  year: string;
  make: string;
  model: string;
  mileage: string;
  condition: string;
};

export async function sendPreApprovalNotification(
  data: PreApprovalNotification
) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.BCAUTOLOAN_FROM_EMAIL;
  const notificationEmail = process.env.BCAUTOLOAN_NOTIFICATION_EMAIL;

  if (!apiKey || !fromEmail || !notificationEmail) {
    console.warn("BCAutoLoan email notification configuration is missing - email notification skipped");
    return { success: false, error: "Email configuration missing" };
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: `BCAutoLoan <${fromEmail}>`,
      to: [notificationEmail],
      subject: `New BCAutoLoan Pre-Approval Application — ${data.applicationNumber}`,
      text: [
        "A new BCAutoLoan pre-approval application has been received.",
        "",
        `Application: ${data.applicationNumber}`,
        `Customer: ${data.firstName} ${data.lastName}`,
        `Email: ${data.email}`,
        `Phone: ${data.phone}`,
        `Vehicle: ${data.vehicleType} ${data.vehicleMake} ${data.vehicleModel}`,
        `Budget: ${data.vehicleBudget}`,
        "",
        "Please open Shiftly CRM to view the complete application.",
      ].join("\n"),
    });

    if (result.error) {
      // Log detailed error for debugging without exposing sensitive data
      console.error("Pre-approval notification email failed:", {
        statusCode: result.error.statusCode,
        message: result.error.message,
        name: result.error.name,
      });
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error("Pre-approval notification email error:", error instanceof Error ? error.message : "Unknown email error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}

export async function sendSellCarNotification(
  data: SellCarNotification
) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.BCAUTOLOAN_FROM_EMAIL;
  const notificationEmail = process.env.BCAUTOLOAN_NOTIFICATION_EMAIL;

  if (!apiKey || !fromEmail || !notificationEmail) {
    console.warn("BCAutoLoan email notification configuration is missing - email notification skipped");
    return { success: false, error: "Email configuration missing" };
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: `BCAutoLoan <${fromEmail}>`,
      to: [notificationEmail],
      subject: `New BCAutoLoan Sell Your Car Inquiry — ${data.referenceNumber}`,
      text: [
        "A new BCAutoLoan Sell Your Car inquiry has been received.",
        "",
        `Reference: ${data.referenceNumber}`,
        `Customer: ${data.firstName} ${data.lastName}`,
        `Email: ${data.email}`,
        `Phone: ${data.phone}`,
        "",
        "Vehicle",
        `Year: ${data.year}`,
        `Make: ${data.make}`,
        `Model: ${data.model}`,
        `Mileage: ${data.mileage}`,
        `Condition: ${data.condition}`,
        "",
        "Please open Shiftly CRM to view the complete inquiry.",
      ].join("\n"),
    });

    if (result.error) {
      // Log detailed error for debugging without exposing sensitive data
      console.error("Sell Your Car notification email failed:", {
        statusCode: result.error.statusCode,
        message: result.error.message,
        name: result.error.name,
      });
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error("Sell Your Car notification email error:", error instanceof Error ? error.message : "Unknown email error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}
