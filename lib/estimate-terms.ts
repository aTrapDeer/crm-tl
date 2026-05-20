import { DEFAULT_TL_CORP_ORGANIZATION } from "./tl-corp-organization";

export interface DisclosureSection {
  title: string;
  lines: string[];
}

export const DISCLOSURE_SECTIONS: DisclosureSection[] = [
  {
    title: "COST ESTIMATE INCLUDES",
    lines: [
      "Cost for time, materials, and equipment.",
      "Cost to prepare worksite, including protection of existing structures, finishes, materials, and components.",
      "Cost for job cleanup and debris removal at job completion.",
      "Labor setup time and mobilization time.",
    ],
  },
  {
    title: "PAYMENT TERMS",
    lines: [
      "50% due on acceptance of contract.",
      "25% due after rough-in.",
      "20% due after drywall is paint-ready.",
      "5% due after final.",
      "There may be down days due to trade scheduling and inspections outside contractor control.",
    ],
  },
  {
    title: "TIME AND MATERIAL",
    lines: [
      "Time and material items are billed at $150.00 per man, per hour, with a one-hour minimum, and collected at completion of those items.",
    ],
  },
  {
    title: "GENERAL CONDITIONS",
    lines: [
      "All work to be performed in a substantial, workmanlike manner in accordance with submitted drawings and specifications.",
      "Unless otherwise specified in contract, 50% of total amount is due at acceptance, 25% due at rough-in completion, and remaining balance, including additional work, is due at completion.",
      "Any alteration or deviation from specifications involving extra costs will be executed upon written or oral order and becomes an extra charge above this estimate.",
      "The above prices, specifications, and conditions are accepted upon authorization to proceed.",
    ],
  },
  {
    title: "DEFAULT AND COLLECTION",
    lines: [
      "Upon customer default in payment or other obligation, contractor is entitled to all sums due under contract.",
      "Contractor may recover interest at 18% per annum on unpaid sums until paid in full.",
      "Contractor is entitled to reasonable costs of enforcement and collection, including attorney fees, with or without filing suit.",
    ],
  },
  {
    title: "WARRANTY",
    lines: [
      "Contractor warrants that labor and materials furnished, and work performed, are compliant with contract documents and authorized modifications.",
      "Work is warranted against defects due to workmanship for one (1) year from date of completion/final payment.",
    ],
  },
  {
    title: "WARRANTY TERMS AND CONDITIONS",
    lines: [
      "Contractor has been paid in full for workmanship according to contract documents.",
      "Warranty does not cover damage to person or property from use of products, materials, or methods in connection with the work.",
      "Warranty is void if modifications or changes are made without prior written contractor consent.",
      "Warranty is valid only if all project close-out documents are received by contractor.",
    ],
  },
  {
    title: "EXCLUSIONS",
    lines: [
      "Damage caused by negligence, intentional misuse, or failure to properly maintain the work.",
      "Damage caused by conditions beyond contractor control, including acts of God, war, civil unrest, or governmental regulation.",
      "Changes or modifications performed by parties other than authorized contractor representatives.",
      "Damage due to cracks, crazing, mold, mildew, or other fungi.",
      "Site preparation failures, including inadequate backfill, compaction, or drainage.",
      "Costs associated with removal and/or reinstallation of work.",
    ],
  },
  {
    title: "CLAIMS",
    lines: [
      "Claims under warranty must be submitted in writing within 30 days of defect becoming apparent.",
      "Claims must include proof of purchase and photographic evidence.",
      "Contractor must be given reasonable opportunity to investigate and remedy defects.",
      "Failure to provide timely notice may void warranty.",
    ],
  },
  {
    title: "RESOLUTION",
    lines: [
      "If a problem arises, contractor has a reasonable period, not to exceed 90 days, to remedy the problem.",
      "Replacement products, if required, will be new and of similar type, quality, and function unless otherwise mutually agreed.",
    ],
  },
  {
    title: "NON-TRANSFERABLE",
    lines: [
      "Warranty is non-transferable and void if property ownership changes before warranty expiration.",
    ],
  },
  {
    title: "AGREED AND ACCEPTED",
    lines: [
      "By signing this agreement, client and contractor agree to these terms and warranty conditions.",
      "By signing this document, customer agrees to the services and conditions outlined in this document.",
    ],
  },
];

/** @deprecated Use TlCorpOrganization from the database via getTlCorpOrganization() */
export const TL_CORP_INFO = {
  name: DEFAULT_TL_CORP_ORGANIZATION.business_name,
  address: DEFAULT_TL_CORP_ORGANIZATION.address_line1,
  cityState: `${DEFAULT_TL_CORP_ORGANIZATION.city_state} ${DEFAULT_TL_CORP_ORGANIZATION.postal_code}`.trim(),
  phone: DEFAULT_TL_CORP_ORGANIZATION.phone,
  email: DEFAULT_TL_CORP_ORGANIZATION.email,
  web: DEFAULT_TL_CORP_ORGANIZATION.website,
} as const;
