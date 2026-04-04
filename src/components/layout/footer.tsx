import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-md-outline-variant/20 px-6 py-8">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between text-sm text-md-on-surface-variant">
        <span className="font-semibold text-md-primary">NutriBalance</span>
        <div className="flex items-center gap-4">
          <Link href="/search" className="hover:text-md-on-surface transition-colors">
            Search Foods
          </Link>
          <Link href="/methodology" className="hover:text-md-on-surface transition-colors">
            Our Data
          </Link>
          <Link href="/privacy" className="hover:text-md-on-surface transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-md-on-surface transition-colors">
            Terms
          </Link>
          <a
            href="https://t.me/nutri_balance_master_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-md-on-surface transition-colors"
          >
            Telegram Bot
          </a>
          <a
            href="https://discord.com/oauth2/authorize?client_id=1490013414997885080&scope=bot"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-md-on-surface transition-colors"
          >
            Discord Bot
          </a>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
