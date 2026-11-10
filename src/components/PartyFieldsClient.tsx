"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { UFS } from "@/lib/format";
import type { PartyLike } from "./PartyFields";

export function PartyFieldsClient({ data }: { data?: PartyLike | null }) {
  const [name, setName] = useState(data?.name ?? "");
  const [document, setDocument] = useState(data?.document ?? "");
  const [email, setEmail] = useState(data?.email ?? "");
  const [phone, setPhone] = useState(data?.phone ?? "");
  const [zipSearch, setZipSearch] = useState("");
  const [address, setAddress] = useState(data?.address ?? "");
  const [city, setCity] = useState(data?.city ?? "");
  const [state, setState] = useState(data?.state ?? "");
  const [notes, setNotes] = useState(data?.notes ?? "");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);

  async function lookupCnpj() {
    const digits = document.replace(/\D/g, "");
    if (digits.length !== 14) {
      setLookupMsg("Informe um CNPJ com 14 dígitos para consultar na Receita.");
      return;
    }
    setLoadingCnpj(true);
    setLookupMsg(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não localizado.");
      const info = await res.json();
      if (info.razao_social || info.nome_fantasia) setName(info.nome_fantasia || info.razao_social);
      if (info.email) setEmail(info.email.toLowerCase());
      if (info.ddd_telefone_1) setPhone(info.ddd_telefone_1);
      if (info.cep) setZipSearch(String(info.cep).replace(/\D/g, ""));
      const addrParts = [
        [info.descricao_tipo_de_logradouro, info.logradouro].filter(Boolean).join(" "),
        info.numero,
        info.complemento,
        info.bairro,
      ].filter(Boolean);
      if (addrParts.length > 0) setAddress(addrParts.join(", "));
      if (info.municipio) setCity(info.municipio);
      if (info.uf) setState(info.uf);
      setLookupMsg("Dados do CNPJ preenchidos automaticamente!");
    } catch {
      setLookupMsg("Não foi possível consultar este CNPJ automaticamente.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function lookupCep() {
    const digits = zipSearch.replace(/\D/g, "");
    if (digits.length !== 8) {
      setLookupMsg("Informe um CEP com 8 dígitos para buscar o endereço.");
      return;
    }
    setLoadingCep(true);
    setLookupMsg(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const info = await res.json();
      if (info.erro) throw new Error("CEP não encontrado");
      const street = [info.logradouro, info.bairro].filter(Boolean).join(" — ");
      if (street) setAddress(street);
      if (info.localidade) setCity(info.localidade);
      if (info.uf) setState(info.uf);
      setLookupMsg("Endereço preenchido pelo CEP!");
    } catch {
      setLookupMsg("CEP não encontrado.");
    } finally {
      setLoadingCep(false);
    }
  }

  return (
    <div className="form-grid">
      {lookupMsg && (
        <div className="field s12">
          <div className="alert info" style={{ marginBottom: 0 }}>
            {lookupMsg}
          </div>
        </div>
      )}

      <div className="field s5">
        <label>CPF / CNPJ</label>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <input
            name="document"
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="Digite o CPF ou CNPJ..."
          />
          <button
            type="button"
            className="btn sm secondary"
            onClick={lookupCnpj}
            disabled={loadingCnpj}
            style={{ whiteSpace: "nowrap", padding: "8px 11px" }}
            title="Buscar dados do CNPJ automaticamente"
          >
            {loadingCnpj ? <Loader2 size={14} className="spin-icon" /> : <Search size={14} />} Buscar CNPJ
          </button>
        </div>
      </div>

      <div className="field s7">
        <label>Nome / Razão social *</label>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="field s4">
        <label>E-mail</label>
        <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="field s4">
        <label>Telefone / WhatsApp</label>
        <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="field s4">
        <label>Buscar Endereço por CEP</label>
        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <input
            value={zipSearch}
            onChange={(e) => setZipSearch(e.target.value)}
            placeholder="00000-000"
            maxLength={9}
          />
          <button
            type="button"
            className="btn sm secondary"
            onClick={lookupCep}
            disabled={loadingCep}
            style={{ whiteSpace: "nowrap", padding: "8px 11px" }}
          >
            {loadingCep ? <Loader2 size={14} className="spin-icon" /> : <Search size={14} />} CEP
          </button>
        </div>
      </div>

      <div className="field s6">
        <label>Endereço</label>
        <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="field s4">
        <label>Cidade</label>
        <input name="city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="field s2">
        <label>UF</label>
        <select name="state" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </div>

      <div className="field s12">
        <label>Observações</label>
        <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="field s12">
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked={data?.active ?? true} /> Cadastro ativo
        </label>
      </div>
    </div>
  );
}
