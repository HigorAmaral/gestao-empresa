"use client";

import { useState } from "react";
import { CheckSquare, KeyRound, Lock, Shield, Sparkles, Square } from "lucide-react";
import {
  ALL_MODULE_KEYS,
  APP_MODULES,
  PERMISSION_PRESETS,
  type ModuleKey,
} from "@/lib/permissions";

export function PermissionsSelector({
  defaultPermissions,
  defaultRole = "FUNCIONARIO",
  mode = "user",
  hasExistingUser = false,
}: {
  defaultPermissions: ModuleKey[];
  defaultRole?: "ADMIN" | "FUNCIONARIO";
  mode?: "user" | "employee";
  hasExistingUser?: boolean;
}) {
  const [enableLogin, setEnableLogin] = useState<boolean>(mode === "user" ? true : hasExistingUser);
  const [role, setRole] = useState<"ADMIN" | "FUNCIONARIO">(defaultRole);
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set(defaultPermissions));

  const isAdmin = role === "ADMIN";

  function toggleModule(key: ModuleKey) {
    if (isAdmin) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyPreset(keys: ModuleKey[]) {
    setRole("FUNCIONARIO");
    setSelected(new Set(keys));
  }

  const sections = ["Comercial & Serviços", "Suprimentos", "Gestão & Sistema"] as const;

  return (
    <div className="field s12" style={{ marginTop: 8 }}>
      <div className="perm-box">
        <div className="perm-header">
          <div className="row" style={{ gap: 8 }}>
            <Shield size={18} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Controle de Acesso e Permissões de Módulos</h3>
              <div className="muted small">
                Defina exatamente quais áreas e menus do sistema este colaborador poderá acessar
              </div>
            </div>
          </div>

          {mode === "employee" && (
            <label className="checkbox perm-login-toggle">
              <input
                type="checkbox"
                name="enableLogin"
                checked={enableLogin}
                onChange={(e) => setEnableLogin(e.target.checked)}
              />
              <KeyRound size={14} />
              <span>Liberar login no sistema para este funcionário</span>
            </label>
          )}
        </div>

        {/* Campos de conta de acesso (Perfil e Senha) */}
        {(mode === "user" || enableLogin) && (
          <div className="form-grid" style={{ marginBottom: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <div className="field s6">
              <label>Nível do Perfil de Acesso</label>
              <select
                name="role"
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value === "ADMIN" ? "ADMIN" : "FUNCIONARIO";
                  setRole(nextRole);
                  if (nextRole === "ADMIN") setSelected(new Set(ALL_MODULE_KEYS));
                }}
              >
                <option value="FUNCIONARIO">Funcionário (Acesso controlado por módulos abaixo)</option>
                <option value="ADMIN">Administrador (Acesso total a todo o sistema)</option>
              </select>
            </div>

            {mode === "employee" && (
              <div className="field s6">
                <label>
                  <Lock size={12} className="icon-inline" />{" "}
                  {hasExistingUser
                    ? "Nova senha de login (deixe em branco para manter a atual)"
                    : "Senha de login do funcionário *"}
                </label>
                <input
                  name="loginPassword"
                  type="password"
                  minLength={6}
                  placeholder={hasExistingUser ? "•••••••• (manter atual)" : "Mínimo de 6 caracteres"}
                  required={enableLogin && !hasExistingUser}
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>
        )}

        {/* Atalhos Rápidos de Função (Presets) */}
        <div className="perm-presets">
          <div className="small bold muted" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} /> Perfis rápidos de função:
          </div>
          <div className="perm-preset-btns">
            {PERMISSION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="btn sm secondary"
                onClick={() => applyPreset(preset.modules)}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="btn sm secondary"
              onClick={() => {
                setRole("FUNCIONARIO");
                setSelected(new Set());
              }}
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="alert info" style={{ marginTop: 12, marginBottom: 12 }}>
            <Shield size={16} /> O perfil <strong>Administrador</strong> possui acesso irrestrito a todos os 13 módulos
            do sistema. Mude para <strong>Funcionário</strong> caso queira restringir módulos específicos.
          </div>
        )}

        {/* Grade de Módulos por Seção */}
        {sections.map((sectionName) => {
          const mods = APP_MODULES.filter((m) => m.section === sectionName);
          return (
            <div key={sectionName} className="perm-section">
              <div className="perm-section-title">{sectionName}</div>
              <div className="perm-grid">
                {mods.map((mod) => {
                  const checked = isAdmin || selected.has(mod.key);
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      className={`perm-card ${checked ? "checked" : ""}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleModule(mod.key);
                        }
                      }}
                    >
                      {checked && <input type="hidden" name="permissions" value={mod.key} />}
                      <div className="perm-card-top">
                        <div className="row" style={{ gap: 7 }}>
                          {checked ? <CheckSquare size={16} /> : <Square size={16} className="muted" />}
                          <strong>{mod.label}</strong>
                        </div>
                        <span className="badge gray" style={{ fontSize: 10 }}>
                          {mod.href}
                        </span>
                      </div>
                      <div className="perm-card-desc">{mod.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="small muted" style={{ marginTop: 12 }}>
          Módulos liberados:{" "}
          <strong style={{ color: "var(--text)" }}>
            {isAdmin ? ALL_MODULE_KEYS.length : selected.size} de {ALL_MODULE_KEYS.length}
          </strong>{" "}
          (O Dashboard inicial está sempre visível para todos os usuários logados).
        </div>
      </div>
    </div>
  );
}
