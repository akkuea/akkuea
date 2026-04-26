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
import type { PropertyInfo } from "@real-estate-defi/shared";
import { propertyApi } from "@/services/api/properties";

const buySharesMock = mock(() =>
  Promise.resolve({
    transactionHash: "a".repeat(64),
    newBalance: 12,
  }),
);
const originalBuyShares = propertyApi.buyShares;

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
    propertyApi.buyShares = buySharesMock;
    buySharesMock.mockClear();
  });

  afterAll(() => {
    propertyApi.buyShares = originalBuyShares;
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

  it("submits the investment transaction for a connected wallet", async () => {
    const onSuccess = mock(() => {});

    const view = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress="GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234"
        onConnectWallet={() => Promise.resolve()}
        onInvestmentSuccess={onSuccess}
      />,
    );

    fireEvent.click(view.getByText("+"));
    fireEvent.click(view.getByText("+"));

    fireEvent.click(view.getByRole("button", { name: /Confirm Investment/i }));

    await waitFor(() => {
      expect(buySharesMock).toHaveBeenCalledWith(
        property.id,
        "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234",
        3,
      );
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/Transaction submitted/i)).not.toBeNull();
  });
});
