"use client";

import { useEffect, useState } from "react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";

export interface ClientProfileFormState {
  fullName: string;
  email: string;
  address: string;
  serviceSameAsAddress: boolean;
  serviceAddress: string;
  billingSameAsAddress: boolean;
  billingAddress: string;
}

interface ClientProfileFieldsProps {
  value: ClientProfileFormState;
  onChange: (next: ClientProfileFormState) => void;
  emailDisabled?: boolean;
  showEmail?: boolean;
}

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)";

export default function ClientProfileFields({
  value,
  onChange,
  emailDisabled = false,
  showEmail = true,
}: ClientProfileFieldsProps) {
  const [proximity, setProximity] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProximity({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {},
      { maximumAge: 600_000, timeout: 8000 }
    );
  }, []);

  function patch(partial: Partial<ClientProfileFormState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-(--text)/70">
          Full name
        </label>
        <input
          type="text"
          required
          value={value.fullName}
          onChange={(e) => patch({ fullName: e.target.value })}
          className={inputClass}
          placeholder="Jane Smith"
        />
      </div>

      {showEmail && (
        <div>
          <label className="mb-1 block text-xs font-medium text-(--text)/70">
            Email
          </label>
          <input
            type="email"
            required
            disabled={emailDisabled}
            value={value.email}
            onChange={(e) => patch({ email: e.target.value })}
            className={`${inputClass} disabled:opacity-60`}
            placeholder="client@example.com"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-(--text)/70">
          Address
        </label>
        <AddressAutocomplete
          value={value.address}
          onChange={(address) => patch({ address })}
          placeholder="Street, city, state ZIP"
          className={inputClass}
          proximity={proximity}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-(--border) bg-(--bg)/50 p-3 sm:p-4">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-(--text)">
          <input
            type="checkbox"
            checked={value.serviceSameAsAddress}
            onChange={(e) =>
              patch({
                serviceSameAsAddress: e.target.checked,
                serviceAddress: e.target.checked ? value.address : value.serviceAddress,
              })
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded"
          />
          <span className="leading-snug">Service address same as address</span>
        </label>
        {!value.serviceSameAsAddress && (
          <AddressAutocomplete
            value={value.serviceAddress}
            onChange={(serviceAddress) => patch({ serviceAddress })}
            placeholder="Service / job site address"
            className={inputClass}
            proximity={proximity}
          />
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-(--border) bg-(--bg)/50 p-3 sm:p-4">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-(--text)">
          <input
            type="checkbox"
            checked={value.billingSameAsAddress}
            onChange={(e) =>
              patch({
                billingSameAsAddress: e.target.checked,
                billingAddress: e.target.checked ? value.address : value.billingAddress,
              })
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded"
          />
          <span className="leading-snug">Billing address same as address</span>
        </label>
        {!value.billingSameAsAddress && (
          <AddressAutocomplete
            value={value.billingAddress}
            onChange={(billingAddress) => patch({ billingAddress })}
            placeholder="Billing / invoice address"
            className={inputClass}
            proximity={proximity}
          />
        )}
      </div>
    </div>
  );
}

export const emptyClientProfileForm = (): ClientProfileFormState => ({
  fullName: "",
  email: "",
  address: "",
  serviceSameAsAddress: true,
  serviceAddress: "",
  billingSameAsAddress: true,
  billingAddress: "",
});

export function clientProfileFromRecord(client: {
  full_name: string;
  email: string;
  address: string | null;
  service_address: string | null;
  billing_address: string | null;
}): ClientProfileFormState {
  const address = client.address || "";
  const service = client.service_address || "";
  const billing = client.billing_address || "";
  return {
    fullName: client.full_name,
    email: client.email,
    address,
    serviceSameAsAddress: !service || service === address,
    serviceAddress: service,
    billingSameAsAddress: !billing || billing === address,
    billingAddress: billing,
  };
}
