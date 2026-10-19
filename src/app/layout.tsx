import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: "Where the hell are we? — A daily NYC mystery",
  description: "Piece together a New York night. Find the spot, tell the story, and let the city pick its favorite.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><Navigation />{children}</body>
    </html>
  );
}
