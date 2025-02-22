import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio"; 

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    console.log("Fetching metadata for URL:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.error("Error fetching metadata:", response.statusText);
      return NextResponse.json({ error: "Failed to fetch metadata" }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr("content") || $("title").text();
    const description = $('meta[property="og:description"]').attr("content") || $("meta[name='description']").attr("content") || "No description available";
    const image = $('meta[property="og:image"]').attr("content") || null;

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      image: image || null,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
