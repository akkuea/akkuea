/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  HTMLAttributes as SpanHTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { propertyApi } from "@/services/api/properties";

type PropertiesResponse = {
  data: PropertyInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const mockGetAll = mock<() => Promise<PropertiesResponse>>(() =>
  Promise.resolve({
    data: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  }),
);
const mockBuyShares = mock(() =>
  Promise.resolve({
    transactionHash: "b".repeat(64),
    newBalance: 8,
  }),
);
const connectMock = mock(() => Promise.resolve());
const originalGetAll = propertyApi.getAll;
const originalBuyShares = propertyApi.buyShares;

mock.module("next/image", () => ({
  default: ({
    fill: _fill,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
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
  const passthroughSpan = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: SpanHTMLAttributes<HTMLSpanElement> & Record<string, unknown>) => (
    <span {...props}>{children}</span>
  );

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {
        div: passthroughDiv,
        button: passthroughButton,
        span: passthroughSpan,
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

mock.module("@/components/layout", () => ({
  Navbar: () => <div>Navbar</div>,
  Footer: () => <div>Footer</div>,
}));

mock.module("@/components/auth/hooks", () => ({
  useWallet: () => ({
    isConnected: true,
    connect: connectMock,
    isConnecting: false,
    address: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
  }),
}));

const { default: MarketplacePage } = await import("./page");

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

describe("MarketplacePage", () => {
  beforeEach(() => {
    cleanup();
    propertyApi.getAll = mockGetAll;
    propertyApi.buyShares = mockBuyShares;
    mockGetAll.mockClear();
    mockBuyShares.mockClear();
    connectMock.mockClear();
  });

  afterAll(() => {
    propertyApi.getAll = originalGetAll;
    propertyApi.buyShares = originalBuyShares;
  });

  it("renders loading skeletons before showing properties", async () => {
    let resolveRequest: ((value: PropertiesResponse) => void) | null = null;
    mockGetAll.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const view = render(<MarketplacePage />);

    expect(view.getAllByLabelText(/Loading property/i).length).toBeGreaterThan(
      0,
    );

    await act(async () => {
      resolveRequest?.({
        data: [property],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
    });

    await waitFor(() => {
      expect(view.queryByText(property.name)).not.toBeNull();
    });
  });

  it("opens the invest modal after the property data loads", async () => {
    mockGetAll.mockResolvedValueOnce({
      data: [property],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    const view = render(<MarketplacePage />);

    await view.findByText(property.name);
    fireEvent.click(view.getByRole("button", { name: /Invest Now/i }));

    expect(view.queryByText(/Invest in Property/i)).not.toBeNull();
  });

  it("renders an error state with retry when the API request fails", async () => {
    mockGetAll
      .mockRejectedValueOnce(new Error("Marketplace unavailable"))
      .mockResolvedValueOnce({
        data: [property],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

    const view = render(<MarketplacePage />);

    expect(
      await view.findByText(/Could not load the marketplace/i),
    ).not.toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledTimes(2);
      expect(view.queryByText(property.name)).not.toBeNull();
    });
  });
});
