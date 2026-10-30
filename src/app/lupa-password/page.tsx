import type { Metadata } from "next";
import Form from "./Form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lupa password · Ruria Report", robots: { index: false, follow: false } };

export default function LupaPassword() {
  return <Form />;
}
