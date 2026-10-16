import { describe, it, expect } from "vitest";
import {
  validatePreApprovalForm,
  validateSellCarForm,
  validateEmail,
  validatePhone,
  validatePostalCode,
  validateCurrency,
  sanitizePreApprovalData,
  sanitizeSellCarData,
  type ValidationError,
} from "./validators";
import type { PreApprovalFormData, SellCarFormData } from "./schemas";

describe("Email Validation", () => {
  it("should validate correct email addresses", () => {
    expect(validateEmail("test@example.com")).toBe(true);
    expect(validateEmail("user.name+tag@domain.co.uk")).toBe(true);
  });

  it("should reject invalid email addresses", () => {
    expect(validateEmail("invalid")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user example.com")).toBe(false);
  });
});

describe("Phone Validation", () => {
  it("should validate correct Canadian phone numbers", () => {
    expect(validatePhone("604-555-0123")).toBe(true);
    expect(validatePhone("(604) 555-0123")).toBe(true);
    expect(validatePhone("604 555 0123")).toBe(true);
    expect(validatePhone("+1 604 555 0123")).toBe(true);
    expect(validatePhone("6045550123")).toBe(true);
  });

  it("should reject invalid phone numbers", () => {
    expect(validatePhone("123")).toBe(false);
    expect(validatePhone("abc-def-ghij")).toBe(false);
    expect(validatePhone("")).toBe(false);
  });
});

describe("Postal Code Validation", () => {
  it("should validate correct Canadian postal codes", () => {
    expect(validatePostalCode("V6A 1A1")).toBe(true);
    expect(validatePostalCode("v6a1a1")).toBe(true);
    expect(validatePostalCode("K1A-0B1")).toBe(true);
  });

  it("should reject invalid postal codes", () => {
    expect(validatePostalCode("12345")).toBe(false);
    expect(validatePostalCode("ABCD EF")).toBe(false);
    expect(validatePostalCode("")).toBe(false);
  });
});

describe("Currency Validation", () => {
  it("should validate correct currency amounts", () => {
    expect(validateCurrency("1000")).toBe(true);
    expect(validateCurrency("10,000")).toBe(true);
    expect(validateCurrency("$10,000")).toBe(true);
    expect(validateCurrency("10000.00")).toBe(true);
    expect(validateCurrency("$1,234.56")).toBe(true);
  });

  it("should reject invalid currency amounts", () => {
    expect(validateCurrency("abc")).toBe(false);
    expect(validateCurrency("")).toBe(false);
    expect(validateCurrency("1,00.00")).toBe(false);
  });
});

describe("Pre-Approval Form Validation", () => {
  it("should validate a complete valid form", () => {
    const validData: PreApprovalFormData = {
      vehicleType: "SUV & Crossover",
      vehicleBudget: "$500 - $600 / Month",
      hasTrade: false,
      creditRating: "Good (660-724)",
      employmentStatus: "Employed",
      incomeType: "Annual Salary",
      employer: "Test Company",
      jobTitle: "Manager",
      income: "75000",
      incomeFrequency: "Annually",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      downPayment: "5000",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "604-555-0123",
      address: "123 Main St",
      city: "Vancouver",
      province: "BC",
      postalCode: "V6A 1A1",
    };

    const errors = validatePreApprovalForm(validData);
    expect(errors).toHaveLength(0);
  });

  it("should reject form with missing required fields", () => {
    const invalidData: Partial<PreApprovalFormData> = {
      firstName: "John",
      email: "john@example.com",
    };

    const errors = validatePreApprovalForm(invalidData);
    expect(errors.length).toBeGreaterThan(0);

    const fieldNames = errors.map((e: ValidationError) => e.field);
    expect(fieldNames).toContain("lastName");
    expect(fieldNames).toContain("phone");
    expect(fieldNames).toContain("vehicleType");
  });

  it("should reject invalid email format", () => {
    const invalidData: Partial<PreApprovalFormData> = {
      firstName: "John",
      lastName: "Doe",
      email: "invalid-email",
      phone: "604-555-0123",
      address: "123 Main St",
      city: "Vancouver",
      province: "BC",
      postalCode: "V6A 1A1",
      employmentStatus: "Employed",
      employer: "Test",
      jobTitle: "Manager",
      income: "50000",
      incomeFrequency: "Annually",
      vehicleType: "Sedan",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      vehicleBudget: "$500 - $600 / Month",
      downPayment: "5000",
    };

    const errors = validatePreApprovalForm(invalidData);
    expect(errors.some((e: ValidationError) => e.field === "email")).toBe(true);
  });

  it("should reject invalid postal code", () => {
    const invalidData: Partial<PreApprovalFormData> = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "604-555-0123",
      address: "123 Main St",
      city: "Vancouver",
      province: "BC",
      postalCode: "12345",
      employmentStatus: "Employed",
      employer: "Test",
      jobTitle: "Manager",
      income: "50000",
      incomeFrequency: "Annually",
      vehicleType: "Sedan",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      vehicleBudget: "$500 - $600 / Month",
      downPayment: "5000",
    };

    const errors = validatePreApprovalForm(invalidData);
    expect(errors.some((e: ValidationError) => e.field === "postalCode")).toBe(true);
  });
});

describe("Sell Car Form Validation", () => {
  it("should validate a complete valid form", () => {
    const validData: SellCarFormData = {
      firstName: "John",
      lastName: "Doe",
      phone: "604-555-0123",
      email: "john@example.com",
      year: "2020",
      make: "Toyota",
      model: "Camry",
      trim: "LE",
      mileage: "50000",
      condition: "Good",
      ownershipStatus: "Owned outright",
      vehicleLocation: "Vancouver",
      notes: "Test notes",
      preferredContactMethod: "Phone",
    };

    const errors = validateSellCarForm(validData);
    expect(errors).toHaveLength(0);
  });

  it("should reject form with missing required fields", () => {
    const invalidData: Partial<SellCarFormData> = {
      firstName: "John",
      email: "john@example.com",
    };

    const errors = validateSellCarForm(invalidData);
    expect(errors.length).toBeGreaterThan(0);

    const fieldNames = errors.map((e: ValidationError) => e.field);
    expect(fieldNames).toContain("lastName");
    expect(fieldNames).toContain("phone");
    expect(fieldNames).toContain("year");
  });
});

describe("Data Sanitization", () => {
  it("should sanitize pre-approval data", () => {
    const dirtyData: PreApprovalFormData = {
      vehicleType: "SUV & Crossover",
      vehicleBudget: "$500 - $600 / Month",
      hasTrade: false,
      creditRating: "Good (660-724)",
      employmentStatus: "Employed",
      incomeType: "Annual Salary",
      employer: "  Test Company  ",
      jobTitle: "Manager",
      income: "75000",
      incomeFrequency: "Annually",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      downPayment: "5000",
      firstName: "  John  ",
      lastName: "  Doe  ",
      email: "  JOHN@EXAMPLE.COM  ",
      phone: "  604-555-0123  ",
      address: "  123 Main St  ",
      city: "  Vancouver  ",
      province: "  bc  ",
      postalCode: "  v6a1a1  ",
    };

    const sanitized = sanitizePreApprovalData(dirtyData);

    expect(sanitized.firstName).toBe("John");
    expect(sanitized.lastName).toBe("Doe");
    expect(sanitized.email).toBe("john@example.com");
    expect(sanitized.province).toBe("BC");
    expect(sanitized.postalCode).toBe("V6A1A1");
    expect(sanitized.employer).toBe("Test Company");
  });

  it("should sanitize sell car data", () => {
    const dirtyData: SellCarFormData = {
      firstName: "  John  ",
      lastName: "  Doe  ",
      phone: "  604-555-0123  ",
      email: "  JOHN@EXAMPLE.COM  ",
      year: "2020",
      make: "Toyota",
      model: "Camry",
      trim: "LE",
      mileage: "50000",
      condition: "Good",
      ownershipStatus: "Owned outright",
      vehicleLocation: "Vancouver",
      notes: "Test notes",
      preferredContactMethod: "Phone",
    };

    const sanitized = sanitizeSellCarData(dirtyData);

    expect(sanitized.firstName).toBe("John");
    expect(sanitized.lastName).toBe("Doe");
    expect(sanitized.email).toBe("john@example.com");
  });

  it("should remove HTML tags from input", () => {
    const dirtyData: PreApprovalFormData = {
      vehicleType: "SUV & Crossover",
      vehicleBudget: "$500 - $600 / Month",
      hasTrade: false,
      creditRating: "Good (660-724)",
      employmentStatus: "Employed",
      incomeType: "Annual Salary",
      employer: "<b>Test Company</b>",
      jobTitle: "Manager",
      income: "75000",
      incomeFrequency: "Annually",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      downPayment: "5000",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "604-555-0123",
      address: "123 Main St",
      city: "Vancouver",
      province: "BC",
      postalCode: "V6A 1A1",
    };

    const sanitized = sanitizePreApprovalData(dirtyData);
    expect(sanitized.employer).not.toContain("<b>");
    expect(sanitized.employer).not.toContain("</b>");
    expect(sanitized.employer).toBe("Test Company");
  });
});
