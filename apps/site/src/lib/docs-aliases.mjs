const destinations = {
  "api-reference": "reference/api-reference",
  integrations: "reference/developer-tools",
  webhooks: "integrate/webhooks",
};

export function canonicalDocsUrl(url) {
  return url.replace(
    /^(\/docs(?:\/next|\/v\/0\.2)?)\/(api-reference|integrations|webhooks)\/?(?=[?#]|$)/,
    (_, prefix, alias) => `${prefix}/${destinations[alias]}/`,
  );
}
