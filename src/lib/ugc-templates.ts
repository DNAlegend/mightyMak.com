// The UGC ad copy library — proven short-form ad formats, already written.
// Each template is a complete Seedance shooting script with {product} and
// {benefit} left open: the creator swaps in their own product and what it
// does for them, and the script is ready to render. Scripts are vertical
// (9:16), handheld, creator-energy — the native language of TikTok/Reels ads.
//
// Three formats:
//   product — a creator shows and reviews a physical product on camera
//   iphone  — a creator reacts around an iPhone whose screen runs the app
//             (app screenshots ride as references and must be reproduced)
//   screen  — a screen-recording style walkthrough with a voice-over

export type UgcFormat = "product" | "iphone" | "screen";

export interface UgcInputs {
  /** The product or app name, e.g. "Glow Serum" / "SleepWell". */
  product: string;
  /** The one benefit that carries the ad, e.g. "cleared my skin in a week". */
  benefit: string;
}

export interface UgcTemplate {
  id: string;
  name: string;
  tagline: string;
  format: UgcFormat;
  durationSec: number;
  /** The proven hook line, shown on the card (with placeholders filled). */
  hook: (i: UgcInputs) => string;
  /** The full Seedance script with the inputs swapped in. */
  script: (i: UgcInputs) => string;
}

/** Shared presenter language — one consistent UGC visual grammar. */
const UGC_STYLE =
  "Style: authentic UGC creator video, vertical 9:16 handheld selfie framing, phone front-camera look, ring-light catchlights, natural imperfect motion, soft daylight interior, true-to-life skin and textures, no text overlays, no captions, no watermark.";

export const UGC_TEMPLATES: UgcTemplate[] = [
  {
    id: "skeptic",
    name: "The Skeptic",
    tagline: "“I didn’t think it would work” — the highest-trust arc in UGC.",
    format: "product",
    durationSec: 12,
    hook: (i) => `Okay, I really didn’t think ${i.product} would work…`,
    script: (i) =>
      `UGC-style vertical ad. The creator speaks directly to their phone camera, handheld selfie framing.

0-3s: Tight selfie shot, the creator leans in with a doubtful half-smile and says "Okay, I really didn’t think ${i.product} would work". Natural window light, slight handheld sway.
3-6s: They raise ${i.product} into frame beside their face, turning it once so it reads clearly, eyebrows raised. Quick punch-in on the product.
6-9s: Fast cut: the product in use — hands demonstrating it naturally on a counter or in daily life, real textures, real motion.
9-12s: Back to the selfie shot, genuine surprised laugh, they point at the product and say "${i.benefit} — I’m honestly shocked".

Audio: casual room tone, soft trending acoustic beat underneath, the two spoken lines clear and natural, a small paper/foley detail when the product enters frame.

${UGC_STYLE}`,
  },
  {
    id: "three-reasons",
    name: "3 Reasons",
    tagline: "The listicle that retains — a reason every three seconds.",
    format: "product",
    durationSec: 12,
    hook: (i) => `Three reasons ${i.product} lives on my counter now`,
    script: (i) =>
      `UGC-style vertical ad, energetic jump-cut rhythm, creator to camera.

0-3s: Selfie framing, the creator holds up three fingers and says "Three reasons ${i.product} lives here now". Quick zoom punch on "three".
3-6s: Jump cut, they hold ${i.product} up close to the lens — reason one — mouthing enthusiastically, product label facing camera, crisp focus pull from face to product.
6-9s: Jump cut, product in use: hands demonstrating it in real daily context, fast and satisfying, one macro insert of its texture or mechanism.
9-12s: Jump cut back to selfie framing, they tap the product twice and say "${i.benefit} — that’s reason three", grin, quick nod.

Audio: upbeat percussive pop loop, whoosh on each jump cut, both spoken lines bright and clear, a click of the product being set down at the end.

${UGC_STYLE}`,
  },
  {
    id: "morning-routine",
    name: "Morning Routine",
    tagline: "POV aesthetic routine — the product earns its place.",
    format: "product",
    durationSec: 10,
    hook: (i) => `POV: the step of my morning I never skip`,
    script: (i) =>
      `UGC aesthetic routine clip, first-person POV, soft morning light.

0-3s: POV hands open bright curtains, warm sunrise floods a tidy bedroom, slow dreamy handheld drift.
3-6s: POV at a clean counter: hands reach past everyday items and pick up ${i.product}, a gentle rack focus lands on its label, steam or dust motes drifting in the light.
6-8s: Macro of ${i.product} in use — the exact product, its texture and finish rendered true — one slow satisfying beat.
8-10s: Mirror shot: the creator smiles at their reflection holding ${i.product}, and a warm voice-over says "${i.benefit}".

Audio: soft lo-fi morning beat, curtain swish, gentle counter foley, the single voice-over line warm and close.

${UGC_STYLE}`,
  },
  {
    id: "stop-scrolling",
    name: "Stop Scrolling",
    tagline: "Pattern interrupt — eight seconds, one job.",
    format: "product",
    durationSec: 8,
    hook: () => `Stop scrolling — you need to see this`,
    script: (i) =>
      `UGC-style vertical ad, maximum energy pattern interrupt.

0-2s: The creator’s palm covers the lens then pulls away fast to a tight selfie shot, they say "Stop scrolling — you need to see this", eyes wide, slight fisheye feel.
2-5s: Whip-pan to ${i.product} held dead center, crash-zoom onto the label, then a lightning-fast demonstration beat — the product doing its thing with real physics.
5-8s: Snap back to the creator holding it beside their face: "${i.benefit}. You’re welcome." Confident smirk, quick outward push ending the clip mid-motion.

Audio: bass-heavy trending beat that drops at the whip-pan, whoosh and impact hits on the cuts, both lines punchy and clear.

${UGC_STYLE}`,
  },
  {
    id: "before-after",
    name: "Before / After",
    tagline: "The oldest ad on earth, still undefeated.",
    format: "product",
    durationSec: 10,
    hook: (i) => `Me before ${i.product} vs. me after`,
    script: (i) =>
      `UGC-style vertical ad built on one hard before/after cut.

0-3s: Muted, slightly desaturated selfie shot: the creator looks tired and unimpressed, gestures at the everyday problem, shoulders slumped. Flat grey light. A voice-over says "me, before ${i.product}".
3-5s: They lift ${i.product} into frame; on the beat the whole grade snaps to warm and vivid — a hard cut, same framing, new world.
5-8s: Bright quick montage: the product in use, confident hands, one macro insert of its detail, everything saturated and alive.
8-10s: Tight happy selfie shot, the creator taps the product and says "${i.benefit}", genuine smile, small shrug like it’s obvious.

Audio: dull room tone in the before, a riser into the cut, warm upbeat track after, the two lines clear, one satisfying foley hit on the transition.

${UGC_STYLE}`,
  },
  {
    id: "unboxing",
    name: "First Unboxing",
    tagline: "Anticipation does the selling.",
    format: "product",
    durationSec: 10,
    hook: (i) => `It finally came — unboxing ${i.product}`,
    script: (i) =>
      `UGC unboxing clip, tabletop + selfie mix, real anticipation.

0-3s: Overhead tabletop shot: hands slide a clean parcel into frame and tear the tab in one satisfying motion, crisp paper physics, soft daylight.
3-6s: The creator lifts ${i.product} out slowly toward the lens, tissue paper falling away, the exact product with its true label and finish catching the light, a quiet "oh wow" off camera.
6-8s: Macro pass over ${i.product} — texture, edges, finish — slow orbit, shallow focus.
8-10s: Selfie framing, the creator holds it up beside their grin and says "${i.benefit} — worth the wait".

Audio: gentle acoustic bed, rich unboxing foley (tape rip, paper rustle, soft thunk), the whispered reaction and final line natural and close.

${UGC_STYLE}`,
  },
  {
    id: "app-fixed-it",
    name: "This App Fixed It",
    tagline: "Problem → phone screen → result. The app-install classic.",
    format: "iphone",
    durationSec: 12,
    hook: (i) => `I was doing this the hard way until ${i.product}`,
    script: (i) =>
      `UGC-style vertical app ad. The app's real interface (from the attached screenshots) appears on the iPhone screen and must be reproduced exactly — same layout, same colors.

0-3s: Tight selfie shot, the creator rubs their forehead and says "I was doing this the hard way until ${i.product}", exasperated half-laugh, cozy room behind.
3-7s: They raise an iPhone toward the lens; the screen fills the frame showing the app exactly as in the reference screenshots, a thumb scrolls and taps through it naturally, subtle screen glow on their fingers.
7-9s: Over-the-shoulder shot: the app on screen mid-action, the creator nodding along, the interface crisp and legible.
9-12s: Back to selfie framing, phone lowered, they point at the camera and say "${i.benefit} — it’s free, just get it", easy smile.

Audio: light plucky tech beat, soft UI tap sounds synced to the thumb, both spoken lines conversational and clear.

${UGC_STYLE}`,
  },
  {
    id: "screen-walkthrough",
    name: "Watch Me Use It",
    tagline: "A guided screen demo — voice-over sells the flow.",
    format: "screen",
    durationSec: 12,
    hook: (i) => `Let me show you ${i.product} in 10 seconds`,
    script: (i) =>
      `Screen-recording style demo with a warm voice-over. The interface shown is exactly the attached screenshots — reproduce the layout, colors and content faithfully; a cursor moves naturally through it.

0-3s: The screen fades in on the product's main view exactly as in the reference screenshots; a cursor glides to the primary action as the voice-over says "let me show you ${i.product}".
3-7s: Smooth guided flow: the cursor clicks through the key screens from the references in order, each click landing with a gentle zoom toward the acted-on element, interface crisp and legible throughout.
7-10s: The payoff screen: the result view holds center frame, a slow subtle push-in, small celebratory motion in the UI.
10-12s: Hold on the final screen as the voice-over closes: "${i.benefit} — try it today". Clean end frame.

Audio: minimal soft-key electronic bed, gentle click and whoosh sounds synced to the cursor, the two voice-over lines warm and unhurried.

Style: high-fidelity screen capture look, exact reproduction of the referenced interface, smooth 60fps cursor motion, subtle depth shadows, no invented UI text beyond the references, no watermark.`,
  },
];

export const UGC_FORMATS: { key: UgcFormat; label: string; blurb: string }[] = [
  { key: "product", label: "Product in hand", blurb: "A creator shows your product on camera" },
  { key: "iphone", label: "iPhone app", blurb: "Your app on an iPhone, creator reacts" },
  { key: "screen", label: "Screen demo", blurb: "A guided walkthrough of your screens" },
];

/* ------------------------------- UGC styles ------------------------------ */
// The style library: ten real, fully-directed 15-second UGC ads — each shot
// in a real place (a car, the bus, a kitchen…) with its own beats and spoken
// lines. Every style is a FUNCTION of the creator's inputs, so "copy this
// style" swaps in their product, their presenter and their lines while the
// direction, setting and rhythm stay proven. The demo values below are what
// the library's real example videos were rendered with.

export interface UgcStyleInputs {
  /** The product's name, e.g. "Ember Coffee". */
  product: string;
  /** The one benefit that carries the ad. */
  benefit: string;
  /** Who's on camera, e.g. "a woman in her 20s with curly dark hair". */
  presenter: string;
  /** The opening spoken line (under 12 words). */
  open: string;
  /** The closing spoken line (under 12 words). */
  close: string;
}

export interface UgcStyle {
  id: string;
  name: string;
  /** Where it's shot — the style's world. */
  setting: string;
  durationSec: number;
  /** Which generated product image the library demo was rendered with. */
  demoRefId: string;
  /** The inputs the library's example video was rendered with. */
  demo: UgcStyleInputs;
  script: (i: UgcStyleInputs) => string;
}

const HANDHELD =
  "Style: authentic UGC creator video, vertical 9:16, phone front-camera look, natural imperfect handheld motion, true-to-life skin and textures, no text overlays, no captions, no watermark.";

export const UGC_STYLES: UgcStyle[] = [
  {
    id: "ugc-car-review",
    name: "Front Seat Review",
    setting: "Parked car, driver's seat",
    durationSec: 15,
    demoRefId: "prod-coffee",
    demo: {
      product: "Ember Coffee",
      benefit: "keeps me sharp through the whole commute",
      presenter: "a man in his late 20s with short dark hair and light stubble, wearing a denim jacket",
      open: "Okay, real talk from my car.",
      close: "Keeps me sharp all the way to work.",
    },
    script: (i) =>
      `UGC-style vertical ad shot in a PARKED CAR, driver's seat. ${i.presenter} holds the phone at arm's length, seatbelt off, daylight through the windshield.

0-3s: Tight selfie framing from the passenger side angle, soft window light across their face, they lean toward the lens and say "${i.open}" with a knowing look. Blurred dashboard and headrest behind.
3-7s: They lift ${i.product} up beside their face — the exact product from the reference, label facing camera — and tilt it once so the light catches it. Quick natural rack focus from face to product.
7-11s: Close insert: the product in their hand resting on the steering wheel, thumb tapping it twice; outside the windshield, a soft out-of-focus parking lot. Subtle handheld sway.
11-15s: Back to selfie framing, they nod at the camera, hold the product to their chest and say "${i.close}", small grin, clip ends on the grin.

Audio: quiet car interior ambience, a distant door thunk, both spoken lines close and natural like a voice memo, soft acoustic pad underneath.

${HANDHELD}`,
  },
  {
    id: "ugc-bus-commute",
    name: "Bus Window Seat",
    setting: "City bus, window seat",
    durationSec: 15,
    demoRefId: "prod-earbuds",
    demo: {
      product: "Aura Earbuds",
      benefit: "the whole bus just disappears",
      presenter: "a woman in her early 20s with a low bun and a beige hoodie",
      open: "This is my bus survival kit.",
      close: "The whole bus just disappears.",
    },
    script: (i) =>
      `UGC-style vertical ad shot on a MOVING CITY BUS, window seat. ${i.presenter} films themselves front-camera, city sliding past the window, gentle bus vibration in the frame.

0-3s: Selfie framing against the window, daylight flickering as buildings pass, they lean in conspiratorially and half-whisper "${i.open}". Other seats soft-focus behind.
3-7s: They raise ${i.product} into frame — the exact product from the reference, label readable — open it toward the lens with one thumb, eyebrows up.
7-11s: Close-up: the product in use in a natural motion, the window light rolling across it as the bus turns; the reflection of passing trees slides over the frame.
11-15s: Back to the selfie shot, they settle back into the seat with a content exhale, glance out the window, then to camera: "${i.close}". Ends mid-smile as the bus hums on.

Audio: real bus interior — low engine hum, a stop-request ding, muffled chatter — both lines whispered-close, lo-fi beat rising softly at the end.

${HANDHELD}`,
  },
  {
    id: "ugc-kitchen-counter",
    name: "Kitchen Counter Morning",
    setting: "Home kitchen, morning",
    durationSec: 15,
    demoRefId: "prod-coffee",
    demo: {
      product: "Ember Coffee",
      benefit: "the best part of my morning, every morning",
      presenter: "a woman in her 30s with shoulder-length brown hair in an oversized cream sweater",
      open: "My mornings changed because of this.",
      close: "Best part of my morning, every morning.",
    },
    script: (i) =>
      `UGC-style vertical ad shot in a bright HOME KITCHEN, morning. ${i.presenter} has the phone propped on the counter, sunlight across marble, a kettle steaming softly behind.

0-3s: Counter-level framing, they lean into frame resting on their elbows and say "${i.open}", morning light glowing on one side of their face.
3-7s: They set ${i.product} on the counter in front of the lens — the exact product from the reference — and slide it a little closer with two fingers, label square to camera.
7-11s: Overhead insert: hands using the product naturally on the counter, steam drifting through the sunbeam, a wooden spoon and mug in soft focus at the edge.
11-15s: Back to counter framing, they cradle their mug in both hands next to the product, shrug happily and say "${i.close}", then take a sip as the clip ends.

Audio: kettle hiss, ceramic clinks, a soft morning acoustic guitar loop, both lines warm and unhurried.

${HANDHELD}`,
  },
  {
    id: "ugc-mirror-routine",
    name: "Bathroom Mirror Routine",
    setting: "Bathroom mirror, AM routine",
    durationSec: 15,
    demoRefId: "prod-serum",
    demo: {
      product: "Glow Serum",
      benefit: "my skin finally looks awake",
      presenter: "a woman in her mid 20s with curly dark hair pulled back with a claw clip",
      open: "Step one, every single morning.",
      close: "My skin finally looks awake.",
    },
    script: (i) =>
      `UGC-style vertical ad shot at a VANITY MIRROR with warm bulbs along its edge. ${i.presenter}, fully dressed in a soft white tee, films their mirror reflection with the phone visible in one hand.

0-3s: Mirror selfie framing, they meet their own eyes in the reflection and say "${i.open}", bright fresh morning face, hair neatly clipped back.
3-7s: They hold ${i.product} up beside their cheek in the mirror — the exact product from the reference, label to camera — and give it a little shake, smiling.
7-11s: Close insert at the vanity table: the product in use with gentle, precise fingers among tidy makeup brushes and a small plant, the warm bulbs throwing soft highlights.
11-15s: Back to the mirror, they lean toward their reflection, point at their own face and say "${i.close}", then laugh softly; end on the laugh.

Audio: quiet room tone, a soft click of the product being set down, the two lines intimate and close, a light airy pop bed underneath.

${HANDHELD}`,
  },
  {
    id: "ugc-couch-haul",
    name: "Couch Close-Up",
    setting: "Living room couch, evening",
    durationSec: 15,
    demoRefId: "prod-handbag",
    demo: {
      product: "Atelier Handbag",
      benefit: "elevates literally every outfit I own",
      presenter: "a woman in her late 20s with straight black hair, gold hoops and a knit cardigan",
      open: "Okay, it finally arrived.",
      close: "It elevates literally everything I own.",
    },
    script: (i) =>
      `UGC-style vertical ad shot on a LIVING ROOM COUCH in the evening. ${i.presenter} sits cross-legged on the couch, a warm floor lamp glowing behind, phone at arm's length.

0-3s: Cozy selfie framing sunk into couch cushions, they bite back a grin and say "${i.open}", lamplight warm on their face.
3-7s: They lift ${i.product} up from off-screen into the frame — the exact product from the reference — turning it slowly so every side catches the lamp light, mouth open in delight.
7-11s: Close pass: their fingers tracing the product's details and texture, gold light and soft shadows, a knit blanket in the background bokeh.
11-15s: Back to the couch framing, they hug the product to their chest, look at the ceiling in mock disbelief and say "${i.close}", flopping back into the cushions as it ends.

Audio: soft home ambience, couch fabric rustle, a warm R&B-tinged bed, both lines gleeful and close.

${HANDHELD}`,
  },
  {
    id: "ugc-desk-latenight",
    name: "Late-Night Desk",
    setting: "Bedroom desk, night",
    durationSec: 15,
    demoRefId: "prod-earbuds",
    demo: {
      product: "Aura Earbuds",
      benefit: "three hours of focus, zero distractions",
      presenter: "a man in his early 20s with round glasses and a grey hoodie",
      open: "Finals week. This is how I survive.",
      close: "Three hours of focus, zero distractions.",
    },
    script: (i) =>
      `UGC-style vertical ad shot at a BEDROOM DESK at night. ${i.presenter} sits at a desk lit by a warm lamp and the cool glow of a laptop, fairy lights out of focus behind.

0-3s: Desk-level selfie framing, laptop glow on their face, they look up from the screen at the lens and say "${i.open}" with tired but amused eyes.
3-7s: They pick ${i.product} up from beside the keyboard and hold it toward the lens — the exact product from the reference — turning it once, the lamp catching its finish.
7-11s: Close insert on the desk: the product in use next to scattered notes and a coffee mug, the laptop light pulsing softly, a pen tapping once.
11-15s: Back to the selfie framing, they exhale, settle into the chair and say "${i.close}", give the lens a small salute and turn back to the screen as it ends.

Audio: quiet night room tone, keyboard taps, page turn, a mellow lo-fi study beat, both lines low and close.

${HANDHELD}`,
  },
  {
    id: "ugc-cafe-table",
    name: "Café Table Chat",
    setting: "Coffee shop table",
    durationSec: 15,
    demoRefId: "prod-handbag",
    demo: {
      product: "Atelier Handbag",
      benefit: "fits my whole life and still looks like this",
      presenter: "a woman in her 30s with a blunt bob and a camel coat",
      open: "Everyone keeps asking about this.",
      close: "Fits my whole life, still looks like this.",
    },
    script: (i) =>
      `UGC-style vertical ad shot at a CAFÉ TABLE by a window. ${i.presenter} sits with a latte, phone propped against a sugar jar, soft daylight and café bustle behind.

0-3s: Table-level framing across the latte, they lean in over the cup and say "${i.open}" with a raised eyebrow, window light rimming their hair.
3-7s: They lift ${i.product} from the chair beside them onto the table — the exact product from the reference — placing it neatly beside the latte, angled to the lens.
7-11s: Close orbit across the tabletop: the product's details against the wood grain, steam from the latte drifting past, silverware glinting soft-focus.
11-15s: Back to the table framing, they rest their chin on one hand, pat the product twice and say "${i.close}", then sip the latte as the clip ends.

Audio: café ambience — espresso machine hiss, cup clinks, low chatter — a jazzy lo-fi loop, both lines conversational and warm.

${HANDHELD}`,
  },
  {
    id: "ugc-gym-check",
    name: "Gym Bag Check",
    setting: "Gym floor, between sets",
    durationSec: 15,
    demoRefId: "prod-sneakers",
    demo: {
      product: "Court Sneakers",
      benefit: "leg day tested, zero complaints",
      presenter: "a fit man in his 20s with short curly hair, wearing a black training tee",
      open: "Leg day verdict, right now.",
      close: "Leg day tested. Zero complaints.",
    },
    script: (i) =>
      `UGC-style vertical ad shot on a GYM FLOOR between sets. ${i.presenter} films front-camera sitting on a bench, racks and plates out of focus behind, bright gym lighting.

0-3s: Slightly breathless selfie framing on the bench, towel over one shoulder, they point at the lens and say "${i.open}".
3-7s: They angle the phone down to ${i.product} — the exact product from the reference — flexing it once with one hand, gym light across its lines.
7-11s: Low tracking insert: the product in action on the gym floor for two quick beats, rubber floor texture, a plate being racked in the background blur.
11-15s: Back to the bench selfie, they wipe their brow, nod at the camera with respect and say "${i.close}", then stand up out of frame as it ends.

Audio: real gym — plates clinking, distant treadmill hum, a bass-forward workout beat, both lines punchy over the noise.

${HANDHELD}`,
  },
  {
    id: "ugc-street-walk",
    name: "Walk-and-Talk",
    setting: "City sidewalk, walking",
    durationSec: 15,
    demoRefId: "prod-sneakers",
    demo: {
      product: "Court Sneakers",
      benefit: "ten thousand steps and my feet feel brand new",
      presenter: "a woman in her 20s with box braids, a puffer jacket and gold jewelry",
      open: "Day three of wearing these everywhere.",
      close: "Ten thousand steps, feet feel brand new.",
    },
    script: (i) =>
      `UGC-style vertical ad shot WALKING on a CITY SIDEWALK. ${i.presenter} films themselves front-camera mid-stride, storefronts and pedestrians sliding by, natural walking bounce in the frame.

0-3s: Walking selfie framing, hair moving with the pace, they talk straight into the lens: "${i.open}", city light shifting across their face.
3-7s: They flip the camera down mid-stride to ${i.product} — the exact product from the reference — in step after step on the pavement, crosswalk stripes passing under.
7-11s: Quick cut: they stop at a shop window, hold the product up to the glass reflection so both it and their grin are visible, tilting it to the light.
11-15s: Walking selfie again, they shrug into the camera with a laugh and say "${i.close}", then look ahead as the city keeps moving past.

Audio: street ambience — traffic wash, footsteps, a crosswalk chirp — an upbeat confident pop loop, both lines bright over the city.

${HANDHELD}`,
  },
  {
    id: "ugc-office-desk",
    name: "Office Desk Flex",
    setting: "Office desk, daytime",
    durationSec: 15,
    demoRefId: "prod-watch",
    demo: {
      product: "Meridian Watch",
      benefit: "makes every meeting feel like my meeting",
      presenter: "a man in his 30s with a trimmed beard, navy shirt with rolled sleeves",
      open: "Small upgrade. Massive difference.",
      close: "Every meeting feels like my meeting now.",
    },
    script: (i) =>
      `UGC-style vertical ad shot at an OFFICE DESK in daylight. ${i.presenter} films front-camera at a tidy desk, a monitor and a plant soft-focus behind, big window light from the side.

0-3s: Desk selfie framing, they glance left and right like sharing a secret, then to the lens: "${i.open}".
3-7s: They raise their wrist deliberately into frame with ${i.product} on it — the exact product from the reference — rotating the wrist slowly so the light walks across it.
7-11s: Close insert over the keyboard: the product catching window light as they type two beats, then a slow push toward its face, papers and a coffee cup in the blur.
11-15s: Back to the desk framing, they straighten their collar with one hand, show the wrist once more and say "${i.close}", ending on a confident half-smile.

Audio: quiet office tone, keyboard clicks, a sleek minimal beat, both lines low-key confident.

${HANDHELD}`,
  },
];
