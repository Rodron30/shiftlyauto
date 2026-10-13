import Link from "next/link";
import Image from "next/image";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-bc-surface border-t border-bc-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="relative h-10 w-10">
                <Image
                  src="/images/bcautoloan/logo.png"
                  alt="BCAutoLoan Logo"
                  fill
                  className="object-contain"
                  sizes="40px"
                />
              </div>
              <span className="text-xl font-bold text-bc-text-primary">AutoLoan</span>
            </div>
            <p className="text-sm text-bc-text-tertiary">
              Simple, straightforward pre-approval and car selling services.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-bc-text-primary mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/bcautoloan/pre-approved" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  Get Pre-Approved
                </Link>
              </li>
              <li>
                <Link href="/bcautoloan/sell-your-car" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  Sell Your Car
                </Link>
              </li>
              <li>
                <Link href="/bcautoloan/how-it-works" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/bcautoloan/about" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-bc-text-primary mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/bcautoloan/privacy" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/bcautoloan/terms" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-bc-text-primary mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/bcautoloan/contact" className="text-sm text-bc-text-tertiary hover:text-bc-text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-bc-border">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://www.google.com/search?q=BCAutoLoan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center transition-opacity hover:opacity-80"
              aria-label="View BCAutoLoan Google Reviews"
            >
              <Image
                src="https://www.canadadrives.ca/img/google/google2x.webp"
                alt="Google Reviews"
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
                unoptimized
              />
            </a>

            <span className="text-sm text-bc-text-muted">
              &copy; {currentYear} BCAutoLoan. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}


