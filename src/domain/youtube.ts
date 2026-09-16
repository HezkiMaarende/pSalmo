export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = parsed.pathname.split("/")[1];
    if (host === "youtube.com")
      id =
        parsed.searchParams.get("v") ||
        (/^\/(embed|shorts)\//.test(parsed.pathname)
          ? parsed.pathname.split("/")[2]
          : null);
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
