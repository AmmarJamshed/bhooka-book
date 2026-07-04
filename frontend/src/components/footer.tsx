/** Site footer */

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/50 bg-accent text-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-lg font-bold text-primary">Bhooka Book</h3>
            <p className="mt-2 text-sm text-white/70">
              Pakistan&apos;s AI Restaurant Concierge. Discover, reserve, and dine smarter.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li><Link href="/search" className="hover:text-primary">Search</Link></li>
              <li><Link href="/concierge" className="hover:text-primary">AI Concierge</Link></li>
              <li><Link href="/search?category=bbq" className="hover:text-primary">BBQ</Link></li>
              <li><Link href="/search?category=desi" className="hover:text-primary">Desi</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Account</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li><Link href="/profile" className="hover:text-primary">Profile</Link></li>
              <li><Link href="/reservations" className="hover:text-primary">My Reservations</Link></li>
              <li><Link href="/favorites" className="hover:text-primary">Favorites</Link></li>
              <li><Link href="/settings" className="hover:text-primary">Settings</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Business</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li><Link href="/dashboard/restaurant" className="hover:text-primary">Restaurant Dashboard</Link></li>
              <li><Link href="/dashboard/admin" className="hover:text-primary">Admin</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-white/50">
          © {new Date().getFullYear()} Bhooka Book. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
