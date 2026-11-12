"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { UFS } from "@/lib/format";

type CompanyInitial = {
  name: string;
  tradeName: string | null;
  monthlyGoal: number;
  document: string | null;
  stateRegistration: string | null;
  pixKey: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  receiptFooter: string | null;
};

export function CompanyFiscalLookupFields({ company }: { company: CompanyInitial }) {
  const [name, setName] = useState(company.name ?? "");
  const [tradeName, setTradeName] = useState(company.tradeName ?? "");
  const [document, setDocument] = useState(company.document ?? "");
  const [stateRegistration, setStateRegistration] = useState(company.stateRegistration ?? "");
  const [pixKey, setPixKey] = useState(company.pixKey ?? company.document ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [email, setEmail] = useState(company.email ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [zipCode, setZipCode] = useState(company.zipCode ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [city, setCity] = useState(company.city ?? "");
  const [state, setState] = useState(company.state ?? "");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function lookupCnpj() {
    const digits = document.replace(/\D/g, "");
    if (digits.length !== 14) {
      setMsg("Informe um CNPJ com 14 dígitos para consultar na Receita.");
      return;
    }
    setLoadingCnpj(true);
    setMsg(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não localizado.");
      const info = await res.json();
      if (info.razao_social) setName(info.razao_social);
      if (info.nome_fantasia) setTradeName(info.nome_fantasia);
      if (info.email) setEmail(info.email.toLowerCase());
      if (info.ddd_telefone_1) setPhone(info.ddd_telefone_1);
      if (info.cep) setZipCode(String(info.cep).replace(/\D/g, ""));
      const addrParts = [
        [info.descricao_tipo_de_logradouro, info.logradouro].filter(Boolean).join(" "),
        info.numero,
        info.complemento,
        info.bairro,
      ].filter(Boolean);
      if (addrParts.length > 0) setAddress(addrParts.join(", "));
      if (info.municipio) setCity(info.municipio);
      if (info.uf) setState(info.uf);
      setMsg("Dados empresariais preenchidos automaticamente pelo CNPJ!");
    } catch {
      setMsg("Não foi possível consultar este CNPJ automaticamente.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function lookupCep() {
    const digits = zipCode.replace(/\D/g, "");
    if (digits.length !== 8) {
      setMsg("Informe um CEP com 8 dígitos.");
      return;
    }
    setLoadingCep(true);
    setMsg(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const info = await res.json();
      if (info.erro) throw new Error("CEP não encontrado");
      const street = [info.logradouro, info.bairro].filter(Boolean).join(" — ");
      if (street) setAddress(street);
      if (info.localidade) setCity(info.localidade);
      if (info.uf) setState(info.uf);
      setMsg("Endereço preenchido automaticamente pelo CEP!");
    } catch {
      setMsg("CEP não localizado.");
    } finally {
      setLoadingCep(false);
    }
  }

  return (
    <div className="form-grid">
      {msg && (
        <div className="field s12">
          <div className="alert info" style={{ marginBottom: 0 }}>
            {msg}
          </div>
        </div>
      )}

      <div className="field s4">
        <label>CNPJ (Busca Automática Receita)</label>
        <div className="row" style={{ gap: 6 }}>
          <input
            name="document"
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="00.000.000/0001-00"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn sm secondary"
            onClick={lookupCnpj}
            disabled={loadingCnpj}
            style={{ whiteSpace: "nowrap" }}
          >
            {loadingCnpj ? <Loader2 size={14} className="spin-icon" /> : <Search size={14} />} CNPJ
          </button>
        </div>
      </div>

      <div className="field s5">
        <label>Razão Social *</label>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="field s3">
        <label>Nome Fantasia</label>
        <input name="tradeName" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
      </div>

      <div className="field s3">
        <label>Meta Mensal de Faturamento (R$)</label>
        <input
          name="monthlyGoal"
          type="number"
          step="100"
          min="0"
          defaultValue={company.monthlyGoal ?? 30000}
        />
      </div>

      <div className="field s3">
        <label>Inscrição Estadual</label>
        <input
          name="stateRegistration"
          value={stateRegistration}
          onChange={(e) => setStateRegistration(e.target.value)}
        />
      </div>

      <div className="field s3">
        <label>Chave PIX (para QR Code nos Recibos)</label>
        <input
          name="pixKey"
          placeholder="CNPJ, CPF, E-mail, Celular ou Chave Aleatória"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
        />
      </div>

      <div className="field s3">
        <label>Telefone / WhatsApp</label>
        <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="field s6">
        <label>E-mail comercial</label>
        <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="field s6">
        <label>Site</label>
        <input name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div className="field s4">
        <label>CEP (Busca Automática)</label>
        <div className="row" style={{ gap: 6 }}>
          <input
            name="zipCode"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="00000-000"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn sm secondary"
            onClick={lookupCep}
            disabled={loadingCep}
            style={{ whiteSpace: "nowrap" }}
          >
            {loadingCep ? <Loader2 size={14} className="spin-icon" /> : <Search size={14} />} CEP
          </button>
        </div>
      </div>

      <div className="field s8">
        <label>Endereço</label>
        <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="field s8">
        <label>Cidade</label>
        <input name="city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="field s4">
        <label>UF</label>
        <select name="state" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </div>

      <div className="field s12">
        <label>Texto de rodapé nos recibos / Ordens de Serviço</label>
        <textarea name="receiptFooter" defaultValue={company.receiptFooter ?? ""} />
      </div>
    </div>
  );
}
