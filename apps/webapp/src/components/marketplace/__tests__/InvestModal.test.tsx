/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { PropertyInfo } from "@akkuea/shared";
import { PROPERTY_IMAGE_PLACEHOLDER } from "@/components/marketplace/marketplace.utils";
import { propertyApi } from "@/services/api/properties";

const UNSIGNED_XDR = "AAAA-UNSIGNED-PURCHASE-XDR";
const SIGNED_XDR = "AAAA-SIGNED-PURCHASE-XDR";
const TX_HASH = "c".repeat(64);
const BUYER = "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234";

/** Records every step of the purchase flow, in the order it happened. */
const flowOrder: string[] = [];

const prepareBuySharesMock = mock(() => {
  flowOrder.push("prepare");
  return Promise.resolve({
    xdr: UNSIGNED_XDR,
    contractId: "CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4",
    sorobanPropertyId: "42",
    shares: 3,
    paymentToken: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    totalAmount: "300.0000000",
  });
});
const confirmBuySharesMock = mock(() => {
  flowOrder.push("confirm");
  return Promise.resolve({ transactionHash: TX_HASH, newBalance: 12 });
});
const signTransactionMock = mock(() => {
  flowOrder.push("sign");
  return Promise.resolve(SIGNED_XDR);
});
const submitSignedPurchaseMock = mock(() => {
  flowOrder.push("submit");
  return Promise.resolve({ hash: TX_HASH });
});

const originalPrepareBuyShares = propertyApi.prepareBuyShares;
const originalConfirmBuyShares = propertyApi.confirmBuyShares;

mock.module("@/services/api/properties", () => ({
  propertyApi: {
    ...propertyApi,
    prepareBuyShares: prepareBuySharesMock,
    confirmBuyShares: confirmBuySharesMock,
  },
}));

mock.module("@/services/marketplace/purchase", () => ({
  purchaseNetworkPassphrase: () => "Test SDF Network ; September 2015",
  submitSignedPurchase: submitSignedPurchaseMock,
}));

mock.module("@/components/auth/hooks", () => ({
  useWallet: () => ({
    network: "testnet" as const,
    signTransaction: signTransactionMock,
  }),
}));

mock.module("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

mock.module("framer-motion", () => {
  const passthroughDiv = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
    <div {...props}>{children}</div>
  );
  const passthroughButton = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  );

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {
        div: passthroughDiv,
        button: passthroughButton,
      },
      {
        get: (target, property) =>
          property in target
            ? target[property as keyof typeof target]
            : passthroughDiv,
      },
    ),
  };
});

const { InvestModal } = await import("../InvestModal");

const property: PropertyInfo = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Lagos Marina Towers",
  description: "Premium residential asset with audited legal documentation.",
  propertyType: "residential",
  location: {
    address: "1 Marina Road",
    city: "Lagos",
    country: "Nigeria",
  },
  totalValue: "2500000",
  tokenAddress: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
  totalShares: 25000,
  availableShares: 6250,
  pricePerShare: "100",
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  documents: [],
  verified: true,
  listedAt: "2026-03-20T00:00:00Z",
  owner: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
};

describe("InvestModal", () => {
  beforeEach(() => {
    cleanup();
    flowOrder.length = 0;
    // bun's mockClear keeps any mockImplementation a previous test installed,
    // so the happy-path implementations are restored here before every test.
    prepareBuySharesMock.mockReset();
    prepareBuySharesMock.mockImplementation(() => {
      flowOrder.push("prepare");
      return Promise.resolve({
        xdr: UNSIGNED_XDR,
        contractId: "CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4",
        sorobanPropertyId: "42",
        shares: 3,
        paymentToken:
          "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
        totalAmount: "300.0000000",
      });
    });
    confirmBuySharesMock.mockReset();
    confirmBuySharesMock.mockImplementation(() => {
      flowOrder.push("confirm");
      return Promise.resolve({ transactionHash: TX_HASH, newBalance: 12 });
    });
    signTransactionMock.mockReset();
    signTransactionMock.mockImplementation(() => {
      flowOrder.push("sign");
      return Promise.resolve(SIGNED_XDR);
    });
    submitSignedPurchaseMock.mockReset();
    submitSignedPurchaseMock.mockImplementation(() => {
      flowOrder.push("submit");
      return Promise.resolve({ hash: TX_HASH });
    });
  });

  afterAll(() => {
    propertyApi.prepareBuyShares = originalPrepareBuyShares;
    propertyApi.confirmBuyShares = originalConfirmBuyShares;
  });

  it("shows a connect wallet prompt when the user is disconnected", () => {
    const connectWallet = mock(() => Promise.resolve());

    const view = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected={false}
        walletAddress={null}
        onConnectWallet={connectWallet}
      />,
    );

    expect(view.queryByText(/Connect your wallet to invest/i)).not.toBeNull();
    fireEvent.click(
      view.getAllByRole("button", { name: /Connect Wallet/i })[0]!,
    );
    expect(connectWallet).toHaveBeenCalledTimes(1);
  });

  it("shows the placeholder image for a property without images", () => {
    const view = render(
      <InvestModal
        property={{ ...property, images: [] }}
        isOpen
        onClose={() => {}}
        isConnected={false}
        walletAddress={null}
        onConnectWallet={() => {}}
      />,
    );

    const image = view.getByAltText(
      `${property.name} - ${property.location.city}, ${property.location.country}`,
    );
    expect(image.getAttribute("src")).toBe(PROPERTY_IMAGE_PLACEHOLDER);
  });

  it("provides accessible names for the token quantity and payment method controls", () => {
    const view = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress={BUYER}
        onConnectWallet={() => Promise.resolve()}
      />,
    );

    expect(
      view.getByRole("button", { name: /decrease token count/i }),
    ).not.toBeNull();
    expect(
      view.getByRole("button", { name: /increase token count/i }),
    ).not.toBeNull();
    expect(
      view.getByRole("radio", { name: /usdc payment method/i }),
    ).not.toBeNull();
    expect(
      view.getByRole("radio", { name: /fiat payment method/i }),
    ).not.toBeNull();
  });

  it("prepares, signs, submits and confirms the purchase in order", async () => {
    const onSuccess = mock(() => {});

    const view = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress={BUYER}
        onConnectWallet={() => Promise.resolve()}
        onInvestmentSuccess={onSuccess}
      />,
    );

    fireEvent.click(view.getByText("+"));
    fireEvent.click(view.getByText("+"));

    fireEvent.click(view.getByRole("button", { name: /Confirm Investment/i }));

    await waitFor(() => {
      expect(view.queryByText(/Transaction submitted/i)).not.toBeNull();
    });

    expect(flowOrder).toEqual(["prepare", "sign", "submit", "confirm"]);
    expect(prepareBuySharesMock).toHaveBeenCalledWith(property.id, BUYER, 3);
    // The wallet signs the exact XDR the API prepared.
    expect(signTransactionMock).toHaveBeenCalledWith(
      UNSIGNED_XDR,
      "Test SDF Network ; September 2015",
    );
    // Submission uses the signed XDR, and confirmation the resulting hash.
    expect(submitSignedPurchaseMock).toHaveBeenCalledWith(
      SIGNED_XDR,
      "testnet",
    );
    expect(confirmBuySharesMock).toHaveBeenCalledWith(
      property.id,
      TX_HASH,
      BUYER,
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // The success screen shows the real transaction hash.
    expect(
      view.queryByText(new RegExp(TX_HASH.slice(0, 8), "i")),
    ).not.toBeNull();
  });

  it("shows an error and never confirms when the wallet rejects the signature", async () => {
    signTransactionMock.mockImplementation(() => {
      flowOrder.push("sign");
      return Promise.reject(new Error("User rejected the transaction"));
    });

    const view = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress={BUYER}
        onConnectWallet={() => Promise.resolve()}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /Confirm Investment/i }));

    await waitFor(() => {
      expect(view.queryByText(/User rejected the transaction/i)).not.toBeNull();
    });

    expect(prepareBuySharesMock).toHaveBeenCalledTimes(1);
    expect(submitSignedPurchaseMock).not.toHaveBeenCalled();
    expect(confirmBuySharesMock).not.toHaveBeenCalled();
    expect(view.queryByText(/Transaction submitted/i)).toBeNull();
  });

  it("shows an error and never confirms when submission returns no hash", async () => {
    submitSignedPurchaseMock.mockImplementation(() => {
      flowOrder.push("submit");
      return Promise.reject(
        new Error(
          "The transaction was signed but the network returned no transaction hash, so it cannot be confirmed as submitted. Check the explorer before trying again.",
        ),
      );
    });

    const view = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress={BUYER}
        onConnectWallet={() => Promise.resolve()}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: /Confirm Investment/i }));

    await waitFor(() => {
      expect(view.queryByText(/returned no transaction hash/i)).not.toBeNull();
    });

    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(confirmBuySharesMock).not.toHaveBeenCalled();
    expect(view.queryByText(/Transaction submitted/i)).toBeNull();
  });
});
