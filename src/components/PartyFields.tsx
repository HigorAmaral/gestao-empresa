import { UFS } from "@/lib/format";
import { reqStr, str, bool } from "@/lib/form";

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

/** Campos comuns de cliente e fornecedor. */
export function PartyFields({ data }: { data?: PartyLike | null }) {
  return (
    <div className="form-grid">
      <div className="field s8">
        <label>Nome / Razão social *</label>
        <input name="name" defaultValue={data?.name ?? ""} required />
      </div>
      <div className="field s4">
        <label>CPF / CNPJ</label>
        <input name="document" defaultValue={data?.document ?? ""} />
      </div>
      <div className="field">
        <label>E-mail</label>
        <input name="email" type="email" defaultValue={data?.email ?? ""} />
      </div>
      <div className="field">
        <label>Telefone</label>
        <input name="phone" defaultValue={data?.phone ?? ""} />
      </div>
      <div className="field s12">
        <label>Endereço</label>
        <input name="address" defaultValue={data?.address ?? ""} />
      </div>
      <div className="field s8">
        <label>Cidade</label>
        <input name="city" defaultValue={data?.city ?? ""} />
      </div>
      <div className="field s4">
        <label>UF</label>
        <select name="state" defaultValue={data?.state ?? ""}>
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </div>
      <div className="field s12">
        <label>Observações</label>
        <textarea name="notes" defaultValue={data?.notes ?? ""} />
      </div>
      <div className="field s12">
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked={data?.active ?? true} /> Cadastro ativo
        </label>
      </div>
    </div>
  );
}
