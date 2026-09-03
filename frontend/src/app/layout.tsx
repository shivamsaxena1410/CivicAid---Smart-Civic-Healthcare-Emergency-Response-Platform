import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "../components/AuthGate";

export const metadata: Metadata = {
  title: "CivicConnect — Civic Health & Emergency Assistance",
  description:
    "Find nearby hospitals, blood banks, pharmacies and ambulances, file civic complaints and browse government health schemes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-mesh">
        {/* AuthGate restores the session once, at the root, so every page can
            read `useAuthStore` without each one re-running /auth/me. */}
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
