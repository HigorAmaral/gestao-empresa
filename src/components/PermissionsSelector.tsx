"use client";

import { useState } from "react";
import { CheckSquare, KeyRound, Lock, Shield, Sparkles, Square } from "lucide-react";
import {
  ALL_MODULE_KEYS,
  APP_MODULES,
  PERMISSION_PRESETS,
  ROLE_DEFINITIONS,
  getRoleDefinition,
  normalizeRole,
  type ModuleKey,
  type Role,
} from "@/lib/permissions";

export function PermissionsSelector({
  defaultPermissions,
  defaultRole = "FUNCIONARIO",
  mode = "user",
  hasExistingUser = false,
}: {
  defaultPermissions: ModuleKey[];
  defaultRole?: Role;
  mode?: "user" | "employee";
  hasExistingUser?: boolean;
}) {
  const [enableLogin, setEnableLogin] = useState<boolean>(mode === "user" ? true : hasExistingUser);
  const [role, setRole] = useState<Role>(normalizeRole(defaultRole));
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set(defaultPermissions));

  const isAdmin = role === "ADMIN";
  const currentRoleDef = getRoleDefinition(role);

  function toggleModule(key: ModuleKey) {
    if (isAdmin) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyRolePreset(nextRole: Role, keys?: ModuleKey[]) {
    setRole(nextRole);
    const modules = keys ?? getRoleDefinition(nextRole).modules;
    setSelected(new Set(modules));
  }

  const sections = [
    "Comercial & Serviços",
    "Suprimentos",
    "Qualidade (SGQ)",
    "Gestão & Sistema",
    "Tecnologia & TI",
  ] as const;

  return (
    <div className="field s12" style={{ marginTop: 8 }}>
      <input type="hidden" name="permissionsCustomized" value="1" />
      <div className="perm-box">
        <div className="perm-header">
          <div className="row" style={{ gap: 8 }}>
            <Shield size={18} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Cargo, Perfil de Acesso e Permissões por Módulo</h3>
              <div className="muted small">
                Escolha um cargo com permissões pré-configuradas (Suporte TI, Suprimentos, Qualidade, etc.) ou ajuste módulo a módulo
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

        {/* Campos de conta de acesso (Cargo/Perfil e Senha) */}
        {(mode === "user" || enableLogin) && (
          <div className="form-grid" style={{ marginBottom: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <div className="field s6">
              <label htmlFor="role-select">Cargo / Perfil de Acesso</label>
              <select
                id="role-select"
                name="role"
                value={role}
                onChange={(e) => applyRolePreset(normalizeRole(e.target.value))}
              >
                {ROLE_DEFINITIONS.map((def) => (
                  <option key={def.key} value={def.key}>
                    {def.label}
                  </option>
                ))}
              </select>
              <div className="muted small" style={{ marginTop: 4 }}>
                {currentRoleDef.description}
              </div>
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

        {/* Atalhos Rápidos de Cargo (Presets) */}
        <div className="perm-presets">
          <div className="small bold muted" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} /> Cargos pré-configurados:
          </div>
          <div className="perm-preset-btns">
            {PERMISSION_PRESETS.map((preset) => (
              <button
                key={preset.role}
                type="button"
                className={`btn sm ${role === preset.role ? "" : "secondary"}`}
                onClick={() => applyRolePreset(preset.role, preset.modules)}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="btn sm secondary"
              onClick={() => applyRolePreset("FUNCIONARIO", ALL_MODULE_KEYS)}
            >
              Liberar Todos ({ALL_MODULE_KEYS.length})
            </button>
            <button
              type="button"
              className="btn sm secondary"
              onClick={() => applyRolePreset("FUNCIONARIO", [])}
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="alert info" style={{ marginTop: 12, marginBottom: 12 }}>
            <Shield size={16} /> O cargo <strong>Administrador</strong> possui acesso irrestrito a todos os{" "}
            {ALL_MODULE_KEYS.length} módulos do sistema. Selecione outro cargo caso queira restringir módulos específicos.
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
