export interface PreApprovalFormData {
  // Vehicle / budget qualification
  vehicleType: string;
  vehicleBudget: string;
  hasTrade: boolean;
  creditRating: string;

  // Employment / income
  employmentStatus: string;
  incomeType: string;
  employer: string;
  jobTitle: string;
  income: string;
  incomeFrequency: string;

  // Vehicle preference/details
  vehicleMake: string;
  vehicleModel: string;
  downPayment: string;

  // Personal information
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;

  // Address
  address: string;
  city: string;
  province: string;
  postalCode: string;

  // Honeypot
  honeypot?: string;
}

export interface SellCarFormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;

  year: string;
  make: string;
  model: string;
  trim: string;
  mileage: string;
  condition: string;
  ownershipStatus: string;
  vehicleLocation: string;

  notes: string;
  preferredContactMethod: string;

  honeypot?: string;
}

export const CANADIAN_PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;

export const EMPLOYMENT_STATUSES = [
  "Employed",
  "Self-employed",
  "Student",
  "Retired / Pension",
  "Other",
] as const;

export const INCOME_FREQUENCIES = [
  "Annually",
  "Monthly",
  "Bi-weekly",
  "Weekly",
] as const;

export const INCOME_TYPES = [
  "Annual Salary",
  "Hourly Wage",
  "Monthly Income",
  "Other",
] as const;

export const CREDIT_RATINGS = [
  "Poor (300-599)",
  "Fair (600-659)",
  "Good (660-724)",
  "Very Good (725-759)",
  "Excellent (760-900)",
  "No Credit / Unsure",
] as const;

export const VEHICLE_TYPES = [
  "Coupe",
  "Hatchback",
  "Sedan",
  "Minivan",
  "SUV & Crossover",
  "Truck",
] as const;

export const VEHICLE_BUDGETS = [
  "Under $400 / Month",
  "$400 - $499 / Month",
  "$500 - $600 / Month",
  "Over $600 / Month",
] as const;

export const TRADE_IN_OPTIONS = [
  "Yes",
  "No",
  "Unsure",
] as const;

export const VEHICLE_CONDITIONS = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
] as const;

export const OWNERSHIP_STATUSES = [
  "Owned outright",
  "Financed",
  "Leased",
] as const;

export const CONTACT_METHODS = [
  "Phone",
  "Email",
  "Text",
] as const;
