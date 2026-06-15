import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Threadly — Think Like The Internet",
  description: "A daily social deduction connection puzzle game designed for internet culture and puzzle lovers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
