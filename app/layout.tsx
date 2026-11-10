import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Job Tracker",
  description: "Track every job application in one place.",
  appleWebApp: { capable: true, title: "Job Tracker", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme toggle saves its choice in a cookie, so the right colours load at once.
  const saved = (await cookies()).get("jt_theme")?.value;
  const theme = saved === "dark" || saved === "light" ? saved : undefined;
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme}>
      <body className="min-h-full">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
