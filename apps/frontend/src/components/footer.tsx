import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@/config/navigation";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-4 md:grid-cols-5">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-semibold mb-4"
            >
              <BrandIcon className="size-5" />
              BizNest
            </Link>
            <p className="text-sm text-muted-foreground">
              Geo-intelligence for smarter investment decisions.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Authentication */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Get Started</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Create account
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8">
          <p className="text-sm text-muted-foreground text-center">
            © {currentYear} BizNest. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
