import { MakeView } from "@/components/make/make-view";

// The app's home IS the video generator — one obvious place to start.
export default function AppHomePage() {
  return <MakeView mode="video" />;
}
