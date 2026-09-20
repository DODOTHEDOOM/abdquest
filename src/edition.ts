/**
 * Which build this is.
 *
 * The same codebase ships as two apps. The personal edition is Abd's own, and
 * carries the things only he can use: it reads the old app's data off his
 * device, and it exposes the Google Health connection.
 *
 * The public edition deliberately does not. Two reasons, and the second is the
 * important one:
 *
 *  - There is no `abdquest_v2` on a stranger's phone, so looking for one is
 *    dead code that could only ever misfire.
 *  - Google Health sign-in requires the user to create their OWN Google Cloud
 *    project, enable the Health API and paste a client ID and secret. That is a
 *    reasonable thing to ask of the person who built the app and an absurd
 *    thing to put in front of a new user. It is hidden behind Advanced rather
 *    than removed, so a technical user can still reach it.
 *
 * Set with VITE_EDITION at build time; anything other than "public" is personal.
 */

export type EditionId = "personal" | "public";

export interface Edition {
  id: EditionId;
  /** Product name, shown in the header, setup and the document title. */
  name: string;
  tagline: string;
  /** Read (never write) the old app's localStorage on this device. */
  migrateLegacy: boolean;
  /** Show the Google Health panel without putting it behind Advanced. */
  healthProminent: boolean;
  /** Offer to fill the app with example data so it can be looked around. */
  offerSampleData: boolean;
}

const PERSONAL: Edition = {
  id: "personal",
  name: "Abd's Quest",
  tagline: "Habits, training and health, all on your phone.",
  migrateLegacy: true,
  healthProminent: true,
  offerSampleData: false,
};

const PUBLIC: Edition = {
  id: "public",
  name: "Steady",
  tagline: "A habit and health tracker that never lies to you about your own data.",
  migrateLegacy: false,
  healthProminent: false,
  offerSampleData: true,
};

function resolve(): Edition {
  let raw: string | undefined;
  try {
    raw = import.meta.env?.VITE_EDITION as string | undefined;
  } catch {
    raw = undefined;
  }
  return raw === "public" ? PUBLIC : PERSONAL;
}

export const EDITION: Edition = resolve();

export const isPublicEdition = EDITION.id === "public";
