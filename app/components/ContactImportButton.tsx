"use client";

import { useEffect, useRef, useState } from "react";

export interface ImportedContact {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface ContactImportButtonProps {
  onImport: (contact: ImportedContact) => void;
  className?: string;
  label?: string;
}

type ContactPicker = {
  getProperties?: () => Promise<Array<"name" | "email" | "tel" | "address">>;
  select: (
    properties: Array<"name" | "email" | "tel" | "address">,
    options?: { multiple?: boolean }
  ) => Promise<
    Array<{
      name?: string[];
      email?: string[];
      tel?: string[];
      address?: Array<string | Record<string, unknown>>;
    }>
  >;
};

const buttonClass =
  "inline-flex items-center justify-center rounded-full border border-(--border) bg-white px-3 py-2 text-xs font-medium text-(--text) hover:bg-(--bg) disabled:opacity-60";

function stripEscapes(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\s+/g, " ")
    .trim();
}

function firstValue(lines: string[], key: string) {
  const prefix = `${key.toUpperCase()}`;
  const line = lines.find((entry) => entry.toUpperCase().startsWith(prefix));
  if (!line) return "";
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return "";
  return stripEscapes(line.slice(colonIndex + 1));
}

function parseAddress(value: string) {
  const parts = value.split(";").map(stripEscapes).filter(Boolean);
  return parts.join(", ");
}

function parseVCard(text: string): ImportedContact {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((acc, rawLine) => {
      if (/^[ \t]/.test(rawLine) && acc.length > 0) {
        acc[acc.length - 1] += rawLine.trim();
      } else {
        acc.push(rawLine.trim());
      }
      return acc;
    }, [])
    .filter(Boolean);

  const fullName = firstValue(lines, "FN") || firstValue(lines, "N").split(";").filter(Boolean).join(" ");
  const email = firstValue(lines, "EMAIL");
  const phone = firstValue(lines, "TEL");
  const rawAddress = firstValue(lines, "ADR");

  return {
    fullName: fullName || undefined,
    email: email || undefined,
    phone: phone || undefined,
    address: rawAddress ? parseAddress(rawAddress) : undefined,
  };
}

function stringifyContactAddress(address: string | Record<string, unknown>) {
  if (typeof address === "string") return address;
  const orderedParts = [
    address.streetAddress,
    address.addressLine,
    address.locality,
    address.city,
    address.region,
    address.state,
    address.postalCode,
    address.country,
  ];
  return orderedParts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(", ");
}

function getContactPicker(): ContactPicker | null {
  if (typeof navigator === "undefined") return null;
  const maybeNavigator = navigator as Navigator & { contacts?: ContactPicker };
  return maybeNavigator.contacts || null;
}

export default function ContactImportButton({
  onImport,
  className,
  label = "Import Contact",
}: ContactImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [nativeSupported, setNativeSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNativeSupported(Boolean(getContactPicker()));
  }, []);

  async function handleNativeImport() {
    const contacts = getContactPicker();
    if (!contacts) {
      fileInputRef.current?.click();
      return;
    }

    setBusy(true);
    try {
      const availableProperties = contacts.getProperties
        ? await contacts.getProperties()
        : ["name", "email", "tel"];
      const requestedProperties = ["name", "email", "tel", "address"].filter(
        (property): property is "name" | "email" | "tel" | "address" =>
          availableProperties.includes(property as "name" | "email" | "tel" | "address")
      );
      if (requestedProperties.length === 0) {
        fileInputRef.current?.click();
        return;
      }
      const [contact] = await contacts.select(requestedProperties, {
        multiple: false,
      });
      if (!contact) return;

      const address = contact.address?.map(stringifyContactAddress).find(Boolean);
      onImport({
        fullName: contact.name?.[0],
        email: contact.email?.[0],
        phone: contact.tel?.[0],
        address,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to import contact:", error);
      fileInputRef.current?.click();
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const text = await file.text();
      const contact = parseVCard(text);
      if (contact.fullName || contact.email || contact.phone || contact.address) {
        onImport(contact);
      }
    } catch (error) {
      console.error("Failed to import vCard:", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleNativeImport}
        disabled={busy}
        className={className || buttonClass}
        title={
          nativeSupported
            ? "Choose a contact from this device"
            : "Import a vCard contact file"
        }
      >
        {busy ? "Importing..." : label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
