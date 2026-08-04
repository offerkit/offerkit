export function remarkVersionedLinks() {
  return (tree, file) => {
    const filePath = String(file.path ?? file.history?.[0] ?? "").replaceAll("\\", "/");
    const prefix = docsPrefix(filePath);
    if (!prefix) return;

    visit(tree, (node) => {
      if (
        node.type !== "link" ||
        typeof node.url !== "string" ||
        !node.url.startsWith("/") ||
        node.url.startsWith("//") ||
        node.url === "/docs" ||
        node.url.startsWith("/docs/") ||
        node.url === "/blog" ||
        node.url.startsWith("/blog/")
      ) {
        return;
      }
      node.url = node.url === "/" ? prefix : `${prefix}${node.url}`;
    });
  };
}

function docsPrefix(filePath) {
  if (filePath.includes("/content/next/")) return "/docs/next";
  const archived = filePath.match(/\/content\/versions\/([^/]+)\//);
  if (archived) return `/docs/v/${archived[1]}`;
  return filePath.includes("/content/docs/") ? "/docs" : "";
}

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) visit(child, callback);
}
