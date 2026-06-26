import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthGate } from "../components/auth";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "Leadflow — Mini CRM",
  description: "Inbound legal leads, collected by AI, handed over to the legal team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
