import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Web Chat",
  description: "Chat IA avec mode workspace agentique",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-hidden bg-black">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const METAMASK_EXTENSION_ID = "nkbihfbeogaeaoehlefnkodbefgpgknn";
                function isExternalMetaMaskError(value) {
                  const text = String(value && (value.stack || value.message || value.reason || value.filename || value) || "");
                  return text.includes(METAMASK_EXTENSION_ID) ||
                    text.includes("MetaMask extension not found") ||
                    text.includes("Failed to connect to MetaMask");
                }
                window.addEventListener("error", (event) => {
                  if (!isExternalMetaMaskError(event.error || event.message || event.filename)) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                }, true);
                window.addEventListener("unhandledrejection", (event) => {
                  if (!isExternalMetaMaskError(event.reason)) return;
                  event.preventDefault();
                  event.stopImmediatePropagation();
                }, true);
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
