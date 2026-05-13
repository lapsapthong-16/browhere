import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Browhere?",
  description: "Local folder RAG search with Gemini embeddings and Groq retrieval.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
