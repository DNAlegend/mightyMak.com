import { redirect } from "next/navigation";

// The video generator lives at /app now. Preserve old links.
export default function VideoPage() {
  redirect("/app");
}
