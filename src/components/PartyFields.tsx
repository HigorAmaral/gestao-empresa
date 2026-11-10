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

/** Campos comuns de cliente e fornecedor com busca automática de CNPJ e CEP. */
export function PartyFields({ data }: { data?: PartyLike | null }) {
  return <PartyFieldsClient data={data} />;
}
