# BCAutoLoan Implementation

## Overview

BCAutoLoan is a customer-facing lead-generation and application funnel for vehicle financing pre-approval and car selling. It is integrated with the existing Shiftly Auto CRM system but maintains its own independent branding and user experience.

## Project Structure

```
web/
├── app/
│   └── bcautoloan/
│       ├── page.tsx                    # Homepage
│       ├── pre-approved/
│       │   └── page.tsx                # Pre-Approval form page
│       ├── sell-your-car/
│       │   └── page.tsx                # Sell Your Car form page
│       ├── how-it-works/
│       │   └── page.tsx                # How It Works page
│       ├── about/
│       │   └── page.tsx                # About page
│       ├── contact/
│       │   └── page.tsx                # Contact page
│       ├── privacy/
│       │   └── page.tsx                # Privacy Policy page
│       ├── terms/
│       │   └── page.tsx                # Terms of Service page
│       ├── api/
│       │   └── bcautoloan/
│       │       ├── pre-approval/
│       │       │   └── route.ts        # Pre-Approval API endpoint
│       │       └── sell-car/
│       │           └── route.ts        # Sell Car API endpoint
│       ├── globals.css                 # BCAutoLoan design system
│       ├── layout.tsx                  # Root layout with metadata
│       ├── sitemap.ts                  # Dynamic sitemap
│       ├── robots.txt                  # Robots configuration
│       └── favicon-bcautoloan.svg     # Favicon
├── components/
│   └── bcautoloan/
│       ├── Header.tsx                  # Navigation header
│       ├── Footer.tsx                  # Footer with links
│       ├── Hero.tsx                    # Homepage hero section
│       ├── PartnerSection.tsx          # Partner banks section
│       ├── HowItWorks.tsx              # How It Works section
│       ├── WhyBCAutoLoan.tsx           # Benefits section
│       ├── FAQ.tsx                     # FAQ accordion
│       ├── FormProgress.tsx            # Multi-step form progress indicator
│       ├── PreApprovalForm.tsx         # Pre-Approval multi-step form
│       └── SellCarForm.tsx             # Sell Your Car form
└── lib/
    └── bcautoloan/
        ├── validation/
        │   ├── schemas.ts              # TypeScript interfaces and enums
        │   └── validators.ts           # Validation and sanitization functions
        ├── pdf/
        │   ├── generator.ts            # PDF generation using pdf-lib
        │   └── storage.ts              # PDF storage in Supabase Storage
        ├── integrations/
        │   ├── crm.ts                  # CRM integration functions
        │   └── financing.ts            # Financing handoff (disabled)
        └── rateLimit.ts                # Rate limiting implementation
```

## Database Migrations

BCAutoLoan requires the following database migrations:

1. `0045_bcautoloan_pre_approval_applications.sql` - Pre-approval applications table
2. `0046_bcautoloan_storage_bucket.sql` - Supabase Storage bucket for PDFs
3. `0047_bcautoloan_rate_limiting.sql` - Rate limiting table
4. `0048_bcautoloan_security_and_rate_limit_hardening.sql` - Security hardening

### Execution Instructions

From the repository root:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node database/run_migration.js 0045_bcautoloan_pre_approval_applications.sql
```

Repeat for each migration in order (0045, 0046, 0047, 0048).

**IMPORTANT:** Verify remote migration state before executing, especially for migration number 0032 which is duplicated. See `database/README.md` for detailed instructions.

### Migration Documentation

See `database/README.md` for:
- Complete migration execution order
- Duplicate migration 0032 handling strategy
- Troubleshooting guide
- Manual execution fallback

## Environment Variables

Add the following to your `.env.local` file:

```env
# BCAutoLoan Configuration (REQUIRED for CRM integration)
BCAUTOLOAN_DEALERSHIP_ID=<uuid>
BCAUTOLOAN_CREATED_BY_USER_ID=<uuid>

# Optional: Production domain for canonical URLs
NEXT_PUBLIC_BCAUTOLOAN_DOMAIN=https://your-production-domain.com

# Optional: Financing handoff (disabled by default)
BCAUTOLOAN_FINANCING_ENABLED=false
```

## API Endpoints

### POST /api/bcautoloan/pre-approval

Accepts pre-approval application data, validates it, stores it in the database, generates a PDF, stores the PDF in Supabase Storage, and integrates with the CRM.

**Request Body:**
```typescript
{
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
```

**Response:**
```typescript
{
  success: true;
  applicationNumber: string;
  message: string;
}
```

### POST /api/bcautoloan/sell-car

Accepts sell car submission data, validates it, and integrates with the CRM.

**Request Body:**
```typescript
{
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
}
```

**Response:**
```typescript
{
  success: true;
  referenceNumber: string;
  message: string;
}
```

## Security Features

1. **Server-side only operations**: All database operations use the Supabase admin client (service-role key) which is never exposed to the browser.

2. **Input validation**: All inputs are validated and sanitized before processing.

3. **Payload size limits**: API endpoints reject payloads larger than 10KB.

4. **No privileged ID injection**: Users cannot supply dealership_id, created_by, or other privileged identifiers - these are determined server-side from environment variables.

5. **CRM isolation**: CRM integration respects dealership isolation through RLS policies.

6. **Rate limiting**: Atomic PostgreSQL-based rate limiting with fail-closed behavior.

7. **Honeypot protection**: Hidden field to detect spam submissions.

8. **Cryptographic randomness**: Application and reference numbers use Node crypto.randomBytes instead of Math.random.

## Design System

BCAutoLoan uses its own design system with:
- Dark theme (slate/navy background)
- Blue primary colors (#2563EB)
- Responsive mobile-first design
- Custom CSS variables for consistent theming
- No dependency on Shiftly's existing design system

## Pages

1. **Homepage** (`/bcautoloan`) - Hero, partner section, how it works, CTAs, FAQ
2. **Pre-Approval** (`/bcautoloan/pre-approved`) - 6-step multi-step form
3. **Sell Your Car** (`/bcautoloan/sell-your-car`) - Single-page form (NO license plate)
4. **How It Works** (`/bcautoloan/how-it-works`) - Process explanation
5. **About** (`/bcautoloan/about`) - Company information
6. **Contact** (`/bcautoloan/contact`) - Contact information
7. **Privacy** (`/bcautoloan/privacy`) - Privacy policy
8. **Terms** (`/bcautoloan/terms`) - Terms of service

## CRM Integration

Both Pre-Approval and Sell Car submissions integrate with the existing Shiftly CRM:

1. **Configuration validation**: Requires BCAUTOLOAN_DEALERSHIP_ID and BCAUTOLOAN_CREATED_BY_USER_ID
2. **User verification**: Verifies the created_by user exists and belongs to the configured dealership
3. **Customer matching**: Attempts to find existing customers by email or phone
4. **Customer creation**: Creates new customer if no match found with proper created_by
5. **Lead creation**: Creates a lead with appropriate interest_note, notes, and financing preference
6. **Submission types**: PRE_APPROVAL vs SELL_CAR have distinct semantics and notes
7. **Error propagation**: CRM failures return 500 to the API, not swallowed

## PDF Generation and Storage

Pre-Approval applications automatically generate a PDF using `pdf-lib` with:
- BCAutoLoan branding
- Application number and submission date
- All customer information
- Employment and income details
- Vehicle preferences
- Professional formatting

The PDF is stored in Supabase Storage:
- Bucket: `bcautoloan-applications`
- Path: `{applicationNumber}/bcautoloan-application-{applicationNumber}.pdf`
- Server-side only via service-role key
- Storage path recorded in database

## Testing the Build

To test the production build:

```bash
cd web
npm run build
```

The build should complete successfully without errors.

## Deployment Considerations

1. **Separate domain**: BCAutoLoan should ideally have its own domain (e.g., bcautoloan.com)
2. **Separate Vercel project**: Consider deploying as a separate Vercel project for independent scaling
3. **Environment configuration**: Ensure BCAUTOLOAN_DEALERSHIP_ID and BCAUTOLOAN_CREATED_BY_USER_ID are configured for CRM integration
4. **Partner bank image**: Replace the placeholder in `PartnerSection.tsx` with the actual client-provided image at `public/images/bcautoloan/partner-banks.png`
5. **Supabase Storage**: Ensure the storage bucket is created (migration 0046) before running the application

## Notes

- BCAutoLoan does NOT include vehicle inventory, dealer dashboards, or any SaaS features
- It is purely a lead-generation and application funnel
- The existing Shiftly Auto functionality remains completely intact
- No financing approval engine is implemented - BCAutoLoan only collects and funnels applications
- Financing handoff architecture is prepared but disabled until client provides credentials
