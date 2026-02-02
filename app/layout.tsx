import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ModelTriage",
  description: "LLM decision and verification layer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
