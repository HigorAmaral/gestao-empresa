import Link from "next/link";
import { Calendar, Cpu, HeartPulse, Receipt, Users } from "lucide-react";

export function RhSubnav({
  active,
  refMonth,
  basePath,
}: {
  active: "equipe" | "folha" | "ponto" | "ferias" | "sst";
  refMonth: string;
  basePath: string;
}) {
  return (
    <div
      className="card mb"
      style={{
        padding: "10px 14px",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link
          href={`/funcionarios?month=${refMonth}`}
          className={`btn ${active === "equipe" ? "" : "secondary"}`}
        >
          <Users size={15} /> Equipe & Prontuários
        </Link>
        <Link
          href={`/funcionarios/folha?month=${refMonth}`}
          className={`btn ${active === "folha" ? "" : "secondary"}`}
        >
          <Receipt size={15} /> Folha de Pagamento & Holerites
        </Link>
        <Link
          href={`/funcionarios/ponto?month=${refMonth}`}
          className={`btn ${active === "ponto" ? "" : "secondary"}`}
        >
          <Cpu size={15} /> Relógio de Ponto (REP)
        </Link>
        <Link
          href={`/funcionarios/ferias?month=${refMonth}`}
          className={`btn ${active === "ferias" ? "" : "secondary"}`}
        >
          <Calendar size={15} /> Férias & Atestados
        </Link>
        <Link
          href={`/funcionarios/sst?month=${refMonth}`}
          className={`btn ${active === "sst" ? "" : "secondary"}`}
        >
          <HeartPulse size={15} /> EPIs & Exames (SST)
        </Link>
      </div>

      <form method="GET" action={basePath} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span className="small muted bold">Competência:</span>
        <input
          type="month"
          name="month"
          defaultValue={refMonth}
          style={{ width: 155, padding: "6px 10px" }}
        />
        <button type="submit" className="btn sm secondary">
          Alternar Mês
        </button>
      </form>
    </div>
  );
}
