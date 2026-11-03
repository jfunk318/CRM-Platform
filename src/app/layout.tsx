import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { Encode_Sans_Semi_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";

// The back office's (and customer pages') font: slightly narrow, so tables and forms fit more.
const appSans = Encode_Sans_Semi_Condensed({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  return {
    title: (await getRequestBusiness())?.name ?? PLATFORM_NAME,
    description: "Custom apparel, embroidery and promotional products",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${appSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
