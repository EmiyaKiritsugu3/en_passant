import type { Metadata, Viewport } from "next";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import TabBar from "@/components/TabBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "En Passant - Chess Coach",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <div className="flex-1 pb-20">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
