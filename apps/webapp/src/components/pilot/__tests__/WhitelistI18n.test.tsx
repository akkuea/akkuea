import "@/test/setup-dom";
import "@/test/jsdomListenerSignal";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";

const { cleanup, fireEvent, render, waitFor, within } =
  await import("@testing-library/react");
const { WhitelistOnboardingFormView } =
  await import("../WhitelistOnboardingForm");
const { WhitelistReviewQueue } = await import("../WhitelistReviewQueue");
const { apiClient } = await import("@/services/api/client");
const { whitelistOperationsApi } =
  await import("@/services/api/adminOperations");

const CONNECTED_WALLET = {
  address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
  isConnected: true,
  connect: () => undefined,
};

const DISCONNECTED_WALLET = {
  address: null,
  isConnected: false,
  connect: () => undefined,
};

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, child]) =>
      collectKeyPaths(child, prefix ? `${prefix}.${key}` : key),
    );
}

function renderInLocale(locale: "en" | "es", ui: ReactNode) {
  const messages = (locale === "es"
    ? esMessages
    : enMessages) as unknown as AbstractIntlMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

const originalApiGet = apiClient.get.bind(apiClient);
const originalApiPost = apiClient.post.bind(apiClient);
const originalGetPending = whitelistOperationsApi.getPendingWhitelist.bind(
  whitelistOperationsApi,
);
const originalReviewRequest =
  whitelistOperationsApi.reviewWhitelistRequest.bind(whitelistOperationsApi);

afterEach(() => {
  cleanup();
  apiClient.get = originalApiGet;
  apiClient.post = originalApiPost;
  whitelistOperationsApi.getPendingWhitelist = originalGetPending;
  whitelistOperationsApi.reviewWhitelistRequest = originalReviewRequest;
});

describe("Whitelist onboarding and review i18n", () => {
  it("keeps en.json and es.json at identical key sets", () => {
    const enKeys = collectKeyPaths(enMessages);
    const esKeys = collectKeyPaths(esMessages);

    expect(esKeys).toEqual(enKeys);
  });

  it("leaves no hardcoded English copy in the four whitelist components and pages", () => {
    const webappRoot = join(import.meta.dir, "../../../..");
    const filesToCheck = [
      "src/components/pilot/WhitelistOnboardingForm.tsx",
      "src/components/pilot/WhitelistReviewQueue.tsx",
      "src/app/[locale]/pilot/onboarding/page.tsx",
      "src/app/[locale]/pilot/review/whitelist/page.tsx",
    ];

    const forbiddenPhrases = [
      "Investor Onboarding",
      "Pilot Program Whitelist Request",
      "Loading your whitelist status...",
      "No Whitelist Application",
      "Start Application",
      "Review Pending",
      "You're Whitelisted!",
      "Application Rejected",
      "Full Name",
      "John Doe",
      "Government ID Type",
      "Document Number",
      "Connect Your Wallet",
      "Submit Request",
      "Pilot Whitelist Queue",
      "Loading pending requests...",
      "No Pending Requests",
      "Failed to load whitelist queue",
      "Review Whitelist Request",
      "Required if rejecting...",
      "Reject Request",
      "Approve & Whitelist",
    ];

    for (const relativePath of filesToCheck) {
      const source = readFileSync(join(webappRoot, relativePath), "utf8");
      for (const phrase of forbiddenPhrases) {
        expect(source).not.toContain(phrase);
      }
      expect(source).toMatch(/useTranslations|getTranslations/);
    }
  });

  it("renders WhitelistOnboardingForm loading, empty, and stepper steps in Spanish", async () => {
    let resolveStatus!: (value: {
      data: { success: boolean; status: string };
    }) => void;
    apiClient.get = mock(
      () =>
        new Promise<{ data: { success: boolean; status: string } }>(
          (resolve) => {
            resolveStatus = resolve;
          },
        ),
    ) as unknown as typeof apiClient.get;

    const loadingView = renderInLocale(
      "es",
      <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
    );
    expect(
      within(loadingView.container).getByText(
        "Cargando el estado de tu lista blanca...",
      ),
    ).toBeDefined();

    resolveStatus({ data: { success: true, status: "none" } });
    await waitFor(() => {
      expect(
        within(loadingView.container).getByText(
          "Sin solicitud de lista blanca",
        ),
      ).toBeDefined();
    });
    cleanup();

    const stepView = renderInLocale(
      "es",
      <WhitelistOnboardingFormView wallet={DISCONNECTED_WALLET} />,
    );

    await waitFor(() => {
      expect(
        within(stepView.container).getByText("Sin solicitud de lista blanca"),
      ).toBeDefined();
    });

    fireEvent.click(
      within(stepView.container).getByRole("button", {
        name: "Iniciar solicitud",
      }),
    );

    expect(
      within(stepView.container).getByRole("heading", {
        name: "Incorporación de inversor",
      }),
    ).toBeDefined();
    expect(
      within(stepView.container).getByText(
        "Solicitud de lista blanca del programa piloto",
      ),
    ).toBeDefined();

    const idTypeSelect = within(stepView.container).getByLabelText(
      "Tipo de documento oficial",
    );
    expect(within(idTypeSelect).getByText("Pasaporte")).toBeDefined();
    expect(
      within(idTypeSelect).getByText("Documento nacional de identidad"),
    ).toBeDefined();
    expect(
      within(idTypeSelect).getByText("Licencia de conducir"),
    ).toBeDefined();

    fireEvent.change(
      within(stepView.container).getByPlaceholderText("Juan Pérez"),
      { target: { value: "Lucia Gomez" } },
    );
    fireEvent.change(
      within(stepView.container).getByPlaceholderText("Número de referencia"),
      { target: { value: "NI-998877" } },
    );
    fireEvent.change(idTypeSelect, { target: { value: "national_id" } });

    fireEvent.click(
      within(stepView.container).getByRole("button", { name: "Continuar" }),
    );

    expect(
      within(stepView.container).getByRole("heading", {
        name: "Conecta tu billetera",
      }),
    ).toBeDefined();
    expect(
      within(stepView.container).getByRole("button", {
        name: "Conectar billetera",
      }),
    ).toBeDefined();
  });

  it("renders WhitelistOnboardingForm summary, pending, approved, and rejected states in Spanish", async () => {
    apiClient.get = mock(async () => ({
      data: { success: true, status: "none" },
    })) as unknown as typeof apiClient.get;
    apiClient.post = mock(async () => ({
      data: { success: true },
    })) as unknown as typeof apiClient.post;

    const submitView = renderInLocale(
      "es",
      <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
    );

    await waitFor(() => {
      expect(
        within(submitView.container).getByRole("button", {
          name: "Iniciar solicitud",
        }),
      ).toBeDefined();
    });

    fireEvent.click(
      within(submitView.container).getByRole("button", {
        name: "Iniciar solicitud",
      }),
    );
    fireEvent.change(
      within(submitView.container).getByPlaceholderText("Juan Pérez"),
      { target: { value: "Lucia Gomez" } },
    );
    fireEvent.change(
      within(submitView.container).getByPlaceholderText("Número de referencia"),
      { target: { value: "P-112233" } },
    );
    fireEvent.click(
      within(submitView.container).getByRole("button", { name: "Continuar" }),
    );

    expect(within(submitView.container).getByText("Pasaporte")).toBeDefined();
    expect(within(submitView.container).getByText("Billetera")).toBeDefined();

    fireEvent.click(
      within(submitView.container).getByRole("button", {
        name: "Enviar solicitud",
      }),
    );

    await waitFor(() => {
      expect(
        within(submitView.container).getByRole("heading", {
          name: "Revisión pendiente",
        }),
      ).toBeDefined();
    });
    expect(submitView.container.textContent).not.toContain("Review Pending");
    cleanup();

    apiClient.get = mock(async () => ({
      data: { success: true, status: "approved" },
    })) as unknown as typeof apiClient.get;
    const approvedView = renderInLocale(
      "es",
      <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
    );
    await waitFor(() => {
      expect(
        within(approvedView.container).getByRole("heading", {
          name: "Estás en la lista blanca",
        }),
      ).toBeDefined();
    });
    expect(approvedView.container.textContent).not.toContain(
      "You're Whitelisted!",
    );
    cleanup();

    apiClient.get = mock(async () => ({
      data: {
        success: true,
        status: "rejected",
        rejectionReason: "Copia ilegible",
      },
    })) as unknown as typeof apiClient.get;
    const rejectedView = renderInLocale(
      "es",
      <WhitelistOnboardingFormView wallet={CONNECTED_WALLET} />,
    );
    await waitFor(() => {
      expect(
        within(rejectedView.container).getByRole("heading", {
          name: "Solicitud rechazada",
        }),
      ).toBeDefined();
    });
    expect(within(rejectedView.container).getByText("Motivo:")).toBeDefined();
    expect(
      within(rejectedView.container).getByText("Copia ilegible"),
    ).toBeDefined();
    expect(
      within(rejectedView.container).getByRole("button", {
        name: "Volver a solicitar",
      }),
    ).toBeDefined();
    expect(rejectedView.container.textContent).not.toContain(
      "Application Rejected",
    );
  });

  it("renders WhitelistReviewQueue loading, error, empty, card, and modal states in Spanish", async () => {
    let resolveQueue!: (value: {
      success: boolean;
      data: Array<{
        id: string;
        walletAddress: string;
        fullName: string;
        idType: string;
        idReference: string;
        status: "pending";
        createdAt: string;
      }>;
    }) => void;
    whitelistOperationsApi.getPendingWhitelist = mock(
      () =>
        new Promise((resolve) => {
          resolveQueue = resolve;
        }),
    ) as typeof whitelistOperationsApi.getPendingWhitelist;

    const queueView = renderInLocale("es", <WhitelistReviewQueue />);
    expect(
      within(queueView.container).getByText(
        "Cargando solicitudes pendientes...",
      ),
    ).toBeDefined();

    await waitFor(() => {
      expect(resolveQueue).toBeDefined();
    });
    resolveQueue({
      success: true,
      data: [
        {
          id: "req-1",
          walletAddress:
            "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
          fullName: "Maria Santos",
          idType: "passport",
          idReference: "P-84721934",
          status: "pending",
          createdAt: "2026-03-15T12:00:00.000Z",
        },
      ],
    });

    await waitFor(() => {
      expect(
        within(queueView.container).getByText("Maria Santos"),
      ).toBeDefined();
    });
    expect(within(queueView.container).getByText("Pendiente")).toBeDefined();
    expect(within(queueView.container).getByText("Pasaporte")).toBeDefined();

    fireEvent.click(
      within(queueView.container).getByRole("button", { name: "Revisar" }),
    );

    const dialog = await waitFor(() =>
      within(document.body).getByRole("dialog"),
    );
    expect(
      within(dialog).getByText("Revisar solicitud de lista blanca"),
    ).toBeDefined();
    expect(
      within(dialog).getByText("Revisando la solicitud de Maria Santos"),
    ).toBeDefined();
    expect(
      within(dialog).getByPlaceholderText("Obligatorio al rechazar..."),
    ).toBeDefined();
    expect(
      within(dialog).getByRole("button", { name: "Rechazar solicitud" }),
    ).toBeDefined();
    expect(
      within(dialog).getByRole("button", {
        name: "Aprobar e incluir en lista blanca",
      }),
    ).toBeDefined();
    cleanup();

    whitelistOperationsApi.getPendingWhitelist = mock(async () => ({
      success: true,
      data: [],
    })) as unknown as typeof whitelistOperationsApi.getPendingWhitelist;
    const emptyView = renderInLocale("es", <WhitelistReviewQueue />);
    await waitFor(() => {
      expect(
        within(emptyView.container).getByText("No hay solicitudes pendientes"),
      ).toBeDefined();
    });
    cleanup();

    whitelistOperationsApi.getPendingWhitelist = mock(async () => {
      throw new Error("boom");
    }) as unknown as typeof whitelistOperationsApi.getPendingWhitelist;
    const errorView = renderInLocale("es", <WhitelistReviewQueue />);
    await waitFor(() => {
      expect(
        within(errorView.container).getByText(
          "No se pudo cargar la cola de lista blanca",
        ),
      ).toBeDefined();
    });
    expect(
      within(errorView.container).getByRole("button", { name: "Reintentar" }),
    ).toBeDefined();
  });
});
