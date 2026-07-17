import { MakeView } from "@/components/make/make-view";

// The app opens straight on Make — the generator. Rendered here (not
// redirected) so ?buy / ?purchase / auth query params survive on the home URL.
export default function AppHomePage() {
  return <MakeView />;
}
