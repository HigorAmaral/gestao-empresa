"use client";

import { useRouter } from "next/navigation";

export function EmployeeSimulatorSelect({
  employees,
  currentId,
}: {
  employees: { id: number; name: string }[];
  currentId: number;
}) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="small muted">Simular colaborador:</span>
      <select
        value={currentId}
        onChange={(e) => router.push(`/portal-colaborador?empId=${e.target.value}`)}
        style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6 }}
      >
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}
