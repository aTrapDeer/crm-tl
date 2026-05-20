export interface ClientAddressInput {
  address: string;
  serviceSameAsAddress: boolean;
  serviceAddress: string;
  billingSameAsAddress: boolean;
  billingAddress: string;
}

export interface ResolvedClientAddresses {
  address: string;
  service_address: string;
  billing_address: string;
}

export function resolveClientAddresses(
  input: ClientAddressInput
): ResolvedClientAddresses {
  const address = input.address.trim();
  return {
    address,
    service_address: input.serviceSameAsAddress
      ? address
      : input.serviceAddress.trim() || address,
    billing_address: input.billingSameAsAddress
      ? address
      : input.billingAddress.trim() || address,
  };
}
