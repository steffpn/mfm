import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Song Curation — myFuckingMusic",
  description: "Vote on songs — Keeper or Skipper",
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
