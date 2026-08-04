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
