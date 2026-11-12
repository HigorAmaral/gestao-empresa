"use client";

import { useEffect, useState } from "react";

export type MascotState = "idle" | "email" | "password_hidden" | "password_visible" | "error" | "pending";

interface MascotWallProps {
  state: MascotState;
  brandName: string;
}

export function MascotWall({ state, brandName }: MascotWallProps) {
  const [blink, setBlink] = useState(false);

  // Piscar de olhos natural a cada 3.5 segundos quando ocioso
  useEffect(() => {
    if (state !== "idle" && state !== "email") return;
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => clearInterval(interval);
  }, [state]);

  // Mensagem dinâmica do balão de fala da mascote
  const getBubbleMessage = () => {
    switch (state) {
      case "error":
        return {
          title: "Ops! Senha ou e-mail inválidos!",
          desc: "Tive um susto aqui... Verifique suas credenciais e tente novamente.",
          badge: "Acesso Negado",
        };
      case "password_hidden":
        return {
          title: "Não se preocupe, não estou olhando!",
          desc: "Privacidade absoluta! Pode digitar sua senha confidencial.",
          badge: "Modo Sigiloso",
        };
      case "password_visible":
        return {
          title: "Espiando com um olho só...",
          desc: "Você pediu para mostrar a senha! Conferindo os caracteres.",
          badge: "Visualização Ativa",
        };
      case "email":
        return {
          title: "Identificando colaborador...",
          desc: "Acompanhando a digitação do seu e-mail corporativo.",
          badge: "Validação de E-mail",
        };
      case "pending":
        return {
          title: "Consultando banco de dados...",
          desc: "Autenticando sessão segura e verificando permissões.",
          badge: "Conectando...",
        };
      case "idle":
      default:
        return {
          title: `Olá! Sou o Guardião do ${brandName}`,
          desc: "Estou vigiando a muralha do sistema. Identifique-se para entrar!",
          badge: "Segurança 24/7",
        };
    }
  };

  const bubble = getBubbleMessage();

  // Coordenadas calculadas para as patinhas da mascote
  // Na parede: Y ≈ 210
  // Cobrindo os olhos: Y ≈ 136
  const isCoveringEyes = state === "password_hidden";
  const isPeeking = state === "password_visible";
  const isError = state === "error";

  return (
    <div className="mascot-scene-container">
      {/* Balão de Diálogo Interativo Monocromático */}
      <div className={`mascot-speech-bubble ${isError ? "bubble-error" : ""}`}>
        <div className="mascot-bubble-badge">{bubble.badge}</div>
        <strong className="mascot-bubble-title">{bubble.title}</strong>
        <p className="mascot-bubble-desc">{bubble.desc}</p>
        <div className="mascot-bubble-tail" />
      </div>

      {/* Ilustração Vetorial da Mascote em cima da Parede (Preto & Branco) */}
      <div className={`mascot-svg-wrap ${isError ? "mascot-shake" : ""}`}>
        <svg
          viewBox="0 0 320 280"
          className="mascot-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Padrão de Tijolos para a Parede (Muralha) */}
            <pattern
              id="brickPattern"
              width="36"
              height="18"
              patternUnits="userSpaceOnUse"
            >
              <rect width="36" height="18" fill="#121214" stroke="#27272a" strokeWidth="1" />
              <path d="M 18 0 L 18 18 M 0 9 L 36 9" stroke="#27272a" strokeWidth="1" />
            </pattern>
          </defs>

          {/* ====================================================
              1. CORPO DA MASCOTE (Atrás da parede)
              ==================================================== */}
          <g className="mascot-body-group">
            {/* Orelhas */}
            {/* Orelha Esquerda */}
            <circle
              cx="116"
              cy="80"
              r="24"
              fill="#09090b"
              stroke="#ffffff"
              strokeWidth="3.5"
            />
            <circle cx="116" cy="80" r="14" fill="#27272a" />

            {/* Orelha Direita */}
            <circle
              cx="204"
              cy="80"
              r="24"
              fill="#09090b"
              stroke="#ffffff"
              strokeWidth="3.5"
            />
            <circle cx="204" cy="80" r="14" fill="#27272a" />

            {/* Tronco / Ombros (visível atrás da parede) */}
            <path
              d="M 100 220 Q 160 170 220 220 L 230 260 L 90 260 Z"
              fill="#09090b"
              stroke="#ffffff"
              strokeWidth="3.5"
            />

            {/* Cabeça Principal */}
            <ellipse
              cx="160"
              cy="130"
              rx="62"
              ry="56"
              fill="#09090b"
              stroke="#ffffff"
              strokeWidth="3.5"
            />

            {/* Manchas ao redor dos olhos estilo Panda / Cyber Guardião */}
            <ellipse
              cx="134"
              cy="126"
              rx="18"
              ry="22"
              fill="#18181b"
              transform="rotate(-8 134 126)"
            />
            <ellipse
              cx="186"
              cy="126"
              rx="18"
              ry="22"
              fill="#18181b"
              transform="rotate(8 186 126)"
            />

            {/* Focinho */}
            <ellipse
              cx="160"
              cy="152"
              rx="22"
              ry="16"
              fill="#ffffff"
              stroke="#09090b"
              strokeWidth="2"
            />
            {/* Nariz */}
            <path
              d="M 154 146 Q 160 142 166 146 Q 160 152 154 146 Z"
              fill="#09090b"
            />

            {/* Boca (muda conforme estado) */}
            {isError ? (
              // Boca aberta de susto "O"
              <ellipse
                cx="160"
                cy="159"
                rx="6"
                ry="8"
                fill="#09090b"
              />
            ) : isCoveringEyes ? (
              // Boca envergonhada / sorrisinho tímido
              <path
                d="M 155 158 Q 160 162 165 158"
                stroke="#09090b"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              // Sorriso amigável normal
              <path
                d="M 152 156 Q 160 163 168 156"
                stroke="#09090b"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Gota de suor em caso de erro */}
            {isError && (
              <g className="mascot-sweat">
                <path
                  d="M 215 105 C 215 105 224 118 224 123 C 224 128 220 132 215 132 C 210 132 206 128 206 123 C 206 118 215 105 215 105 Z"
                  fill="#ffffff"
                  stroke="#09090b"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* ====================================================
                2. OLHOS E PUPILAS
                ==================================================== */}
            {isCoveringEyes ? (
              // Olhos fechados com linhas fofas quando cobre com as mãos
              <g className="mascot-closed-eyes">
                <path
                  d="M 126 128 Q 134 135 142 128"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 178 128 Q 186 135 194 128"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            ) : isPeeking ? (
              // Olho esquerdo fechado, olho direito aberto espiando
              <g className="mascot-peeking-eyes">
                <path
                  d="M 126 128 Q 134 135 142 128"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Olho Direito Aberto */}
                <ellipse cx="186" cy="126" rx="9" ry="11" fill="#ffffff" />
                <circle cx="189" cy="127" r="5" fill="#09090b" />
                <circle cx="191" cy="125" r="1.8" fill="#ffffff" />
              </g>
            ) : isError ? (
              // Olhos espantados em formato X ou círculos arregalados
              <g className="mascot-error-eyes">
                {/* Olho Esquerdo arregalado */}
                <circle cx="134" cy="125" r="10" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <circle cx="134" cy="125" r="3.5" fill="#09090b" />

                {/* Olho Direito arregalado */}
                <circle cx="186" cy="125" r="10" fill="#ffffff" stroke="#09090b" strokeWidth="2" />
                <circle cx="186" cy="125" r="3.5" fill="#09090b" />
              </g>
            ) : (
              // Olhos normais com animação de piscar e seguir cursor
              <g className="mascot-normal-eyes">
                {/* Olho Esquerdo */}
                <ellipse
                  cx="134"
                  cy="126"
                  rx="9"
                  ry={blink ? "1" : "12"}
                  fill="#ffffff"
                  style={{ transition: "ry 0.1s" }}
                />
                {!blink && (
                  <circle
                    cx={state === "email" ? "137" : "134"}
                    cy={state === "email" ? "129" : "126"}
                    r="5"
                    fill="#09090b"
                    style={{ transition: "cx 0.2s, cy 0.2s" }}
                  />
                )}
                {!blink && (
                  <circle
                    cx={state === "email" ? "139" : "136"}
                    cy={state === "email" ? "127" : "124"}
                    r="1.8"
                    fill="#ffffff"
                  />
                )}

                {/* Olho Direito */}
                <ellipse
                  cx="186"
                  cy="126"
                  rx="9"
                  ry={blink ? "1" : "12"}
                  fill="#ffffff"
                  style={{ transition: "ry 0.1s" }}
                />
                {!blink && (
                  <circle
                    cx={state === "email" ? "189" : "186"}
                    cy={state === "email" ? "129" : "126"}
                    r="5"
                    fill="#09090b"
                    style={{ transition: "cx 0.2s, cy 0.2s" }}
                  />
                )}
                {!blink && (
                  <circle
                    cx={state === "email" ? "191" : "188"}
                    cy={state === "email" ? "127" : "124"}
                    r="1.8"
                    fill="#ffffff"
                  />
                )}
              </g>
            )}
          </g>

          {/* ====================================================
              3. A PAREDE (Muralha com textura e parapeito)
              ==================================================== */}
          <g className="mascot-wall-structure">
            {/* Corpo da Parede com Tijolos */}
            <rect
              x="20"
              y="205"
              width="280"
              height="80"
              fill="url(#brickPattern)"
              stroke="#ffffff"
              strokeWidth="2.5"
            />

            {/* Parapeito / Borda Superior da Parede */}
            <rect
              x="12"
              y="196"
              width="296"
              height="16"
              rx="4"
              fill="#18181b"
              stroke="#ffffff"
              strokeWidth="3"
            />

            {/* Placa em baixo relevo na parede */}
            <rect
              x="60"
              y="226"
              width="200"
              height="30"
              rx="6"
              fill="#09090b"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
            <text
              x="160"
              y="245"
              textAnchor="middle"
              fill="#a1a1aa"
              fontSize="9.5"
              fontWeight="700"
              letterSpacing="2.5"
            >
              ÁREA CORPORATIVA SEGURA
            </text>
          </g>

          {/* ====================================================
              4. PATINHAS DA MASCOTE (Sobre a parede ou nos olhos)
              ==================================================== */}
          <g className="mascot-paws-layer">
            {/* Patinha Esquerda */}
            <g
              className="mascot-paw paw-left"
              style={{
                transform: isCoveringEyes
                  ? "translate(12px, -70px)" // sobe cobrindo olho esquerdo
                  : isPeeking
                  ? "translate(12px, -70px)" // continua cobrindo olho esquerdo
                  : "translate(0px, 0px)",   // repousada sobre o parapeito da parede
                transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <ellipse
                cx="124"
                cy="204"
                rx="15"
                ry="12"
                fill="#ffffff"
                stroke="#09090b"
                strokeWidth="2.5"
              />
              {/* Almofadas da pata */}
              <circle cx="120" cy="201" r="2.5" fill="#09090b" />
              <circle cx="126" cy="199" r="2.5" fill="#09090b" />
              <circle cx="131" cy="202" r="2.5" fill="#09090b" />
            </g>

            {/* Patinha Direita */}
            <g
              className="mascot-paw paw-right"
              style={{
                transform: isCoveringEyes
                  ? "translate(-12px, -70px)" // sobe cobrindo olho direito
                  : isPeeking
                  ? "translate(0px, -40px) rotate(12deg)" // baixa um pouco para espiar
                  : "translate(0px, 0px)",   // repousada sobre o parapeito da parede
                transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <ellipse
                cx="196"
                cy="204"
                rx="15"
                ry="12"
                fill="#ffffff"
                stroke="#09090b"
                strokeWidth="2.5"
              />
              {/* Almofadas da pata */}
              <circle cx="189" cy="202" r="2.5" fill="#09090b" />
              <circle cx="194" cy="199" r="2.5" fill="#09090b" />
              <circle cx="200" cy="201" r="2.5" fill="#09090b" />
            </g>
          </g>
        </svg>
      </div>

      {/* Rodapé da Muralha */}
      <div className="mascot-footer-caption">
        <span>● Monitoramento Ativo em Tempo Real</span>
      </div>
    </div>
  );
}
