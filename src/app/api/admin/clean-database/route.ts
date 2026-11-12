import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { executeDatabaseCleanup } from "@/lib/clean-database";

export async function GET(req: NextRequest) {
  return handleReset(req);
}

export async function POST(req: NextRequest) {
  return handleReset(req);
}

async function handleReset(req: NextRequest) {
  const session = await getSession();

  if (session?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Acesso restrito. É necessário estar autenticado como Administrador." },
      { status: 403 }
    );
  }

  try {
    const result = await executeDatabaseCleanup();

    // Revalidar todas as páginas do sistema para refletir o banco zerado
    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/vendas");
    revalidatePath("/produtos");
    revalidatePath("/clientes");
    revalidatePath("/fornecedores");
    revalidatePath("/financeiro");
    revalidatePath("/rh");
    revalidatePath("/os");
    revalidatePath("/producao");
    revalidatePath("/configuracoes");

    return NextResponse.json({
      success: true,
      message: "Banco de dados limpo com sucesso! Apenas os logins autorizados foram mantidos.",
      result,
    });
  } catch (error: any) {
    console.error("[Clean Database API Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erro desconhecido ao limpar banco de dados",
      },
      { status: 500 }
    );
  }
}
