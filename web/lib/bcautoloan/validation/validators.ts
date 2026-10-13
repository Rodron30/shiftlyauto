import {
  PreApprovalFormData,
  SellCarFormData,
  CANADIAN_PROVINCES,
  EMPLOYMENT_STATUSES,
  INCOME_FREQUENCIES,
  VEHICLE_TYPES,
  VEHICLE_BUDGETS,
  VEHICLE_CONDITIONS,
  OWNERSHIP_STATUSES,
  CONTACT_METHODS,
} from "./schemas";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Accept common Canadian/North American formats:
  // 604-555-0123, (604) 555-0123, 604 555 0123, +1 604 555 0123
  const phoneRegex = /^(?:\+?1[\s.-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.-]?[2-9]\d{2}[\s.-]?\d{4}$/;
  return phoneRegex.test(phone.trim());
}

export function validatePostalCode(postalCode: string): boolean {
  // Canadian postal code format: A1A 1A1
  const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
  return postalCodeRegex.test(postalCode.toUpperCase());
}

export function validateCurrency(value: string): boolean {
  // Accept 1000, 10000, 10,000, $10,000, and 10000.00.
  const currencyRegex = /^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{2})?$/;
  return currencyRegex.test(value.trim());
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/<[^>]*>/g, "");
}

export function validatePreApprovalForm(data: Partial<PreApprovalFormData>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Step 1: Personal Information
  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.push({ field: "firstName", message: "First name is required" });
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.push({ field: "lastName", message: "Last name is required" });
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  if (!data.phone || !validatePhone(data.phone)) {
    errors.push({ field: "phone", message: "Valid phone number is required" });
  }

  // Step 2: Address
  if (!data.address || data.address.trim().length < 5) {
    errors.push({ field: "address", message: "Address is required" });
  }

  if (!data.city || data.city.trim().length < 2) {
    errors.push({ field: "city", message: "City is required" });
  }

  if (!data.province || !CANADIAN_PROVINCES.includes(data.province as (typeof CANADIAN_PROVINCES)[number])) {
    errors.push({ field: "province", message: "Valid province is required" });
  }

  if (!data.postalCode || !validatePostalCode(data.postalCode)) {
    errors.push({ field: "postalCode", message: "Valid Canadian postal code is required" });
  }

  // Step 3: Employment / Income
  if (!data.employmentStatus || !EMPLOYMENT_STATUSES.includes(data.employmentStatus as (typeof EMPLOYMENT_STATUSES)[number])) {
    errors.push({ field: "employmentStatus", message: "Employment status is required" });
  }

  if (!data.employer || data.employer.trim().length < 2) {
    errors.push({ field: "employer", message: "Employer name is required" });
  }

  if (!data.jobTitle || data.jobTitle.trim().length < 2) {
    errors.push({ field: "jobTitle", message: "Job title is required" });
  }

  if (!data.income || !validateCurrency(data.income)) {
    errors.push({ field: "income", message: "Valid income amount is required" });
  }

  if (!data.incomeFrequency || !INCOME_FREQUENCIES.includes(data.incomeFrequency as (typeof INCOME_FREQUENCIES)[number])) {
    errors.push({ field: "incomeFrequency", message: "Income frequency is required" });
  }

  // Step 4: Vehicle / Financing Interest
  if (!data.vehicleType || !VEHICLE_TYPES.includes(data.vehicleType as (typeof VEHICLE_TYPES)[number])) {
    errors.push({ field: "vehicleType", message: "Vehicle type is required" });
  }

  if (!data.vehicleMake || data.vehicleMake.trim().length < 2) {
    errors.push({ field: "vehicleMake", message: "Vehicle make is required" });
  }

  if (!data.vehicleModel || data.vehicleModel.trim().length < 1) {
    errors.push({ field: "vehicleModel", message: "Vehicle model is required" });
  }

  if (
    !data.vehicleBudget ||
    !VEHICLE_BUDGETS.includes(
      data.vehicleBudget as (typeof VEHICLE_BUDGETS)[number]
    )
  ) {
    errors.push({
      field: "vehicleBudget",
      message: "Please select a valid monthly budget.",
    });
  }

  if (!data.downPayment || !validateCurrency(data.downPayment)) {
    errors.push({ field: "downPayment", message: "Valid down payment amount is required" });
  }

  return errors;
}

export function validateSellCarForm(data: Partial<SellCarFormData>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Customer Information
  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.push({ field: "firstName", message: "First name is required" });
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.push({ field: "lastName", message: "Last name is required" });
  }

  if (!data.phone || !validatePhone(data.phone)) {
    errors.push({ field: "phone", message: "Valid phone number is required" });
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.push({ field: "email", message: "Valid email is required" });
  }

  // Vehicle Information
  if (!data.year || data.year.trim().length < 4) {
    errors.push({ field: "year", message: "Vehicle year is required" });
  }

  if (!data.make || data.make.trim().length < 2) {
    errors.push({ field: "make", message: "Vehicle make is required" });
  }

  if (!data.model || data.model.trim().length < 1) {
    errors.push({ field: "model", message: "Vehicle model is required" });
  }

  if (!data.mileage || data.mileage.trim().length < 1) {
    errors.push({ field: "mileage", message: "Vehicle mileage is required" });
  }

  if (!data.condition || !VEHICLE_CONDITIONS.includes(data.condition as (typeof VEHICLE_CONDITIONS)[number])) {
    errors.push({ field: "condition", message: "Vehicle condition is required" });
  }

  if (!data.ownershipStatus || !OWNERSHIP_STATUSES.includes(data.ownershipStatus as (typeof OWNERSHIP_STATUSES)[number])) {
    errors.push({ field: "ownershipStatus", message: "Ownership status is required" });
  }

  if (!data.vehicleLocation || data.vehicleLocation.trim().length < 2) {
    errors.push({ field: "vehicleLocation", message: "Vehicle location is required" });
  }

  if (!data.preferredContactMethod || !CONTACT_METHODS.includes(data.preferredContactMethod as (typeof CONTACT_METHODS)[number])) {
    errors.push({ field: "preferredContactMethod", message: "Preferred contact method is required" });
  }

  return errors;
}

export function sanitizePreApprovalData(data: PreApprovalFormData): PreApprovalFormData {
  return {
    firstName: sanitizeString(data.firstName),
    lastName: sanitizeString(data.lastName),
    email: sanitizeString(data.email).toLowerCase(),
    phone: sanitizeString(data.phone),
    address: sanitizeString(data.address),
    city: sanitizeString(data.city),
    province: sanitizeString(data.province).toUpperCase(),
    postalCode: sanitizeString(data.postalCode).toUpperCase(),
    employmentStatus: sanitizeString(data.employmentStatus),
    creditRating: sanitizeString(data.creditRating),
    incomeType: sanitizeString(data.incomeType),
    employer: sanitizeString(data.employer),
    jobTitle: sanitizeString(data.jobTitle),
    income: sanitizeString(data.income),
    incomeFrequency: sanitizeString(data.incomeFrequency),
    vehicleType: sanitizeString(data.vehicleType),
    vehicleMake: sanitizeString(data.vehicleMake),
    vehicleModel: sanitizeString(data.vehicleModel),
    vehicleBudget: sanitizeString(data.vehicleBudget),
    downPayment: sanitizeString(data.downPayment),
    hasTrade: data.hasTrade,
  };
}
export function sanitizeSellCarData(data: SellCarFormData): SellCarFormData {
  return {
    firstName: sanitizeString(data.firstName),
    lastName: sanitizeString(data.lastName),
    phone: sanitizeString(data.phone),
    email: sanitizeString(data.email).toLowerCase(),
    year: sanitizeString(data.year),
    make: sanitizeString(data.make),
    model: sanitizeString(data.model),
    trim: sanitizeString(data.trim),
    mileage: sanitizeString(data.mileage),
    condition: sanitizeString(data.condition),
    ownershipStatus: sanitizeString(data.ownershipStatus),
    vehicleLocation: sanitizeString(data.vehicleLocation),
    notes: sanitizeString(data.notes),
    preferredContactMethod: sanitizeString(data.preferredContactMethod),
  };
}


