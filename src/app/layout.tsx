import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Sabio Circles — communities, courses & payments built for Spanish speakers",
  description:
    "A Skool-style platform for paid communities and courses built for Spanish-speaking creators: local pricing, Paystack/Flutterwave payments, plus Stripe for the rest of the world.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
