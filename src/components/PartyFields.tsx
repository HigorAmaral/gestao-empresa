import { reqStr, str, bool } from "@/lib/form";
import { PartyFieldsClient } from "./PartyFieldsClient";

export type PartyLike = {
  name?: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  ie?: string | null;
  ieIndicator?: string | null;
  notes?: string | null;
  active?: boolean;
};

export function partyData(fd: FormData) {
  return {
    name: reqStr(fd, "name", "Nome / Razão social"),
    document: str(fd, "document"),
    email: str(fd, "email")?.toLowerCase() ?? null,
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    notes: str(fd, "notes"),
    active: bool(fd, "active"),
  };
}

export function clientPartyData(fd: FormData) {
  return {
    ...partyData(fd),
    zipCode: str(fd, "zipCode"),
    ie: str(fd, "ie"),
    ieIndicator: str(fd, "ieIndicator") ?? "9",
  };
}

/** Campos comuns de cliente e fornecedor com busca automática de CNPJ e CEP. */
export function PartyFields({ data }: { data?: PartyLike | null }) {
  return <PartyFieldsClient data={data} />;
}
