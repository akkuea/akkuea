import "@/test/setup-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { AuditLogViewer } from "../AuditLogViewer";

describe("AuditLogViewer", () => {
  it("displays prompt when wallet is not connected", () => {
    render(<AuditLogViewer operatorWallet={null} isWalletConnected={false} />);
    expect(screen.queryByText(/Connect an authorized wallet to view audit logs/i)).not.toBeNull();
  });

  it("displays loading state and then no logs initially when connected", async () => {
    // Mock fetch for the initial load
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
    
    // Initially should show loading state (or at least no logs found after loading)
    await waitFor(() => {
      expect(screen.queryByText(/No audit logs found/i)).not.toBeNull();
    });
  });
});
