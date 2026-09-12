import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TartanOrder · Demo Counter",
  description: "A reversible campus food ordering prototype. Seeded menu. No real purchase.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
