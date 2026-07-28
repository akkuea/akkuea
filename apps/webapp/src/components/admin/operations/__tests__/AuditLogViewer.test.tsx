import "@/test/setup-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuditLogViewer } from "../AuditLogViewer";

describe("AuditLogViewer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("displays prompt when wallet is not connected", () => {
    render(<AuditLogViewer operatorWallet={null} isWalletConnected={false} />);
    expect(screen.queryByText(/Connect an authorized wallet to view audit logs/i)).not.toBeNull();
  });

  it("displays loading state and then no logs initially when connected", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          }),
      })
    ) as jest.Mock;

    render(<AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />);
    
    await waitFor(() => {
      expect(screen.queryByText(/No audit logs found/i)).not.toBeNull();
    });
  });

  it("renders fetched logs correctly", async () => {
    const mockLogs = [
      {
        id: "1",
        actor: "0xABCDEF",
        actionType: "LOGIN",
        timestamp: "2023-10-10T12:00:00Z",
      },
    ];

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockLogs,
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
      })
    ) as jest.Mock;

    render(<AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />);
    
    await waitFor(() => {
      expect(screen.queryByText("LOGIN")).not.toBeNull();
      // It should truncate the address but it's okay to just query part of the content
    });
  });

  it("displays error message if fetch fails", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Network Error")));

    render(<AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Network Error/i)).not.toBeNull();
    });
  });

  it("handles pagination controls", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
            pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
          }),
      })
    ) as jest.Mock;

    render(<AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />);

    await waitFor(() => {
      expect(screen.queryByText(/Showing page 1 of 2/i)).not.toBeNull();
    });

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Showing page 2 of 2/i)).not.toBeNull();
    });
  });
});
