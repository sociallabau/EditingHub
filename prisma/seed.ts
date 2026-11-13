import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const STAGES = [
  { name: "Content Shot", color: "#9ca3af", kind: "NORMAL" },
  { name: "To Edit", color: "#ef4444", kind: "NORMAL" },
  { name: "Currently Editing", color: "#06b6d4", kind: "NORMAL" },
  { name: "Revisions Needed", color: "#f97316", kind: "REVISIONS" },
  { name: "To Be Approved", color: "#22c55e", kind: "REVIEW" },
  { name: "Approved", color: "#84cc16", kind: "APPROVED" },
] as const;

const BRIEF = `## Edit like this
Example: (paste a link to a reference video)

In the way of:
-

## Key messages / hook
-

## Captions & text on screen
-

## Music / pacing
-

## Notes for the editor
-`;

const TEMPLATES = [
  {
    name: "Suburb Highlight",
    description: "Suburb showcase — lifestyle b-roll, local spots, agent to camera.",
    color: "#22c55e",
    defaultPriority: "MEDIUM",
    sections: [
      { key: "raw", title: "Raw Footage", hint: "Main camera / A-roll for this shoot" },
      { key: "suburb", title: "Suburb B-roll", hint: "Drone, cafés, parks, beaches, streetscapes for this suburb" },
      { key: "assets", title: "Supporting Assets", hint: "Logos, data/stat graphics, music, agent headshots" },
      { key: "style", title: "Style Guide", hint: "Client style guide / reference edits" },
    ],
    pages: [
      { title: "Brief", content: BRIEF },
      {
        title: "Suburb Details",
        content: `## Suburb\nName:\nPostcode:\n\n## Highlights to feature\n- \n\n## Stats (median price, growth, days on market)\n- \n\n## Locations filmed\n- `,
      },
    ],
  },
  {
    name: "Agent Interview",
    description: "Sit-down interview / talking head with cut-aways.",
    color: "#6366f1",
    defaultPriority: "HIGH",
    sections: [
      { key: "raw", title: "Raw Video", hint: "Interview camera angles + audio" },
      { key: "broll", title: "B-roll", hint: "Cut-aways, office, listings, agent at work" },
      { key: "style", title: "Style Guide", hint: "Client style guide / reference edits" },
    ],
    pages: [
      { title: "Brief", content: BRIEF },
      { title: "Questions & Selects", content: `## Questions asked\n1. \n\n## Best answers / timestamps\n- ` },
    ],
  },
  {
    name: "Listing / Property",
    description: "Property tour, coming soon, just listed or sold case study.",
    color: "#f59e0b",
    defaultPriority: "HIGH",
    sections: [
      { key: "raw", title: "Raw Footage", hint: "Walkthrough, gimbal and agent pieces to camera" },
      { key: "drone", title: "Drone", hint: "Aerials of the property and surrounds" },
      { key: "assets", title: "Listing Assets", hint: "Floor plan, photos, logo, price/details" },
      { key: "style", title: "Style Guide", hint: "Client style guide / reference edits" },
    ],
    pages: [
      { title: "Brief", content: BRIEF },
      {
        title: "Property Details",
        content: `## Address\n\n## Beds / Baths / Cars\n\n## Price / campaign\n\n## Feature callouts\n- `,
      },
    ],
  },
  {
    name: "Giveaway / Promo",
    description: "Competitions, giveaways, event promos.",
    color: "#ec4899",
    defaultPriority: "URGENT",
    sections: [
      { key: "raw", title: "Raw Video", hint: "Main footage" },
      { key: "assets", title: "Supporting Assets", hint: "Prize images, T&Cs, logos" },
      { key: "style", title: "Style Guide", hint: "Client style guide / reference edits" },
    ],
    pages: [{ title: "Brief", content: BRIEF }],
  },
  {
    name: "Blank",
    description: "Empty project with a raw footage section.",
    color: "#9ca3af",
    defaultPriority: "NONE",
    sections: [{ key: "raw", title: "Raw Video", hint: "Link footage from Google Drive or upload" }],
    pages: [{ title: "Outline", content: "" }],
  },
] as const;

async function main() {
  if ((await db.stage.count()) === 0) {
    for (const [i, s] of STAGES.entries()) {
      await db.stage.create({ data: { ...s, order: i } });
    }
    console.log("Created board columns");
  }
  if ((await db.template.count()) === 0) {
    for (const t of TEMPLATES) {
      await db.template.create({
        data: { ...t, sections: t.sections as never, pages: t.pages as never },
      });
    }
    console.log("Created project templates");
  }
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@editinghub.local").toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({
      data: {
        email,
        name: process.env.SEED_ADMIN_NAME || "Admin",
        role: "ADMIN",
        color: "#f2542d",
        passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "changeme123", 10),
      },
    });
    console.log(`Created admin ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
