import FuncionariosPage from "../page";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SegurancaTrabalhoSstPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <FuncionariosPage searchParams={Promise.resolve({ ...sp, tab: "sst" })} />;
}
