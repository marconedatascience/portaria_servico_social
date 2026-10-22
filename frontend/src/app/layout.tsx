import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "CRM Portaria HNSBC",
  description: "Sistema de Gestão Humanizada de Acesso",
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // translate="no" impede o Tradutor do Edge/Chrome de alterar o DOM (causava erro de hidratação).
    <html lang="pt-BR" translate="no" className="notranslate h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
