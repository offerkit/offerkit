const GITHUB_API_URL = "https://api.github.com/repos/offerkit/offerkit";

let starsPromise: Promise<number | null> | undefined;

export function getGitHubStars() {
  starsPromise ??= fetch(GITHUB_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "offerkit-site-build",
      ...(import.meta.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${import.meta.env.GITHUB_TOKEN}` }
        : {}),
    },
    signal: AbortSignal.timeout(5_000),
  })
    .then(async (response) => {
      if (!response.ok) return null;

      const repository = (await response.json()) as { stargazers_count?: unknown };
      return typeof repository.stargazers_count === "number"
        ? repository.stargazers_count
        : null;
    })
    .catch(() => null);

  return starsPromise;
}

export function formatGitHubStars(stars: number | null) {
  if (stars === null) return "Stars";

  return new Intl.NumberFormat("en", {
    notation: stars >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(stars);
}

export interface GitHubRelease {
  tag: string;
  url: string;
  publishedAt: Date | null;
}

let releasePromise: Promise<GitHubRelease | null> | undefined;

/** Latest non-prerelease GitHub release, or null when the API is unavailable at build time. */
export function getLatestRelease() {
  releasePromise ??= fetch(`${GITHUB_API_URL}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "offerkit-site-build",
      ...(import.meta.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${import.meta.env.GITHUB_TOKEN}` }
        : {}),
    },
    signal: AbortSignal.timeout(5_000),
  })
    .then(async (response) => {
      if (!response.ok) return null;

      const release = (await response.json()) as {
        tag_name?: unknown;
        html_url?: unknown;
        published_at?: unknown;
      };
      if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") return null;

      const publishedAt =
        typeof release.published_at === "string" ? new Date(release.published_at) : null;
      return {
        tag: release.tag_name,
        url: release.html_url,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.valueOf()) ? publishedAt : null,
      };
    })
    .catch(() => null);

  return releasePromise;
}
