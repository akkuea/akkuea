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

const PROPERTY_ID = "550e8400-e29b-41d4-a716-446655440001";

const mockGetById = mock<() => Promise<PropertyInfo | null>>(() =>
  Promise.resolve(null),
);
const connectMock = mock(() => Promise.resolve());
const pushMock = mock(() => {});
const originalGetById = propertyApi.getById;

mock.module("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img {...props} alt={props.alt ?? ""} />,
}));

mock.module("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: HTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

mock.module("next/navigation", () => ({
  useParams: () => ({ id: PROPERTY_ID }),
  useRouter: () => ({
    push: pushMock,
    replace: mock(() => {}),
    prefetch: mock(() => {}),
    back: mock(() => {}),
  }),
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

mock.module("@/components/property", () => ({
  PropertyDetail: ({ property }: { property: PropertyInfo }) => (
    <div>
      <h2>{property.name}</h2>
      <p>{property.description}</p>
    </div>
  ),
}));

mock.module("@/components/marketplace/InvestModal", () => ({
  InvestModal: () => null,
}));

const { default: PropertyPage } = await import("./page");

const property: PropertyInfo = {
  id: PROPERTY_ID,
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

describe("PropertyPage", () => {
  beforeEach(() => {
    cleanup();
    propertyApi.getById = mockGetById as typeof propertyApi.getById;
    mockGetById.mockReset();
    mockGetById.mockImplementation(() => Promise.resolve(property));
    connectMock.mockClear();
    pushMock.mockClear();
  });

  afterAll(() => {
    propertyApi.getById = originalGetById;
  });

  it("renders loading state before showing the property", async () => {
    let resolveRequest: ((value: PropertyInfo) => void) | null = null;
    mockGetById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const view = render(<PropertyPage />);

    expect(view.getByLabelText(/Loading property/i)).not.toBeNull();

    await waitFor(() => expect(mockGetById).toHaveBeenCalled());

    await act(async () => {
      resolveRequest?.(property);
    });

    await waitFor(() => {
      expect(view.queryByText(property.name)).not.toBeNull();
    });
  });

  it("renders an error state with retry when the API request fails", async () => {
    mockGetById
      .mockImplementationOnce(() =>
        Promise.reject(new Error("Property unavailable")),
      )
      .mockResolvedValueOnce(property);

    const view = render(<PropertyPage />);

    expect(await view.findByText(/Property unavailable/i)).not.toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Retry/i }));

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledTimes(2);
      expect(view.queryByText(property.name)).not.toBeNull();
    });
  });

  it("renders empty state when the property is not found", async () => {
    mockGetById.mockResolvedValueOnce(null as unknown as PropertyInfo);

    const view = render(<PropertyPage />);

    expect(await view.findByText(/Property not found/i)).not.toBeNull();
    expect(
      view.getByText(/This property does not exist or is no longer available/i),
    ).not.toBeNull();

    fireEvent.click(view.getByRole("button", { name: /Browse marketplace/i }));
    expect(pushMock).toHaveBeenCalledWith("/marketplace");
  });

  it("renders the property on success", async () => {
    mockGetById.mockResolvedValueOnce(property);

    const view = render(<PropertyPage />);

    expect(await view.findByText(property.name)).not.toBeNull();
    expect(view.queryByText(property.description)).not.toBeNull();
    expect(view.queryByLabelText(/Loading property/i)).toBeNull();
  });
});
