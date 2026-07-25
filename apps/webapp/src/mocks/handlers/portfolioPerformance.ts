import { http, HttpResponse } from "msw";
import { mockPortfolioPerformance } from "../fixtures/portfolioPerformance";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const portfolioPerformanceHandlers = [
  /**
   * GET /portfolio/performance?address=<wallet>
   *
   * Returns the 90-day time series of holdings value and collateral ratio for
   * the given wallet address.  Corresponds to the endpoint that will be
   * implemented in issue #1001.
   */
  http.get(`${API_BASE}/portfolio/performance`, ({ request }) => {
    const url = new URL(request.url);
    const address = url.searchParams.get("address");

    if (!address) {
      return HttpResponse.json(
        {
          code: "MISSING_ADDRESS",
          message: "Query parameter 'address' is required.",
        },
        { status: 400 },
      );
    }

    // Return the shared mock regardless of the wallet address so any connected
    // wallet gets meaningful demo data.
    return HttpResponse.json({
      ...mockPortfolioPerformance,
      walletAddress: address,
    });
  }),
];
