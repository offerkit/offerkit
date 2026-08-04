import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedVersion = process.argv[2];
const match = requestedVersion?.match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!match) {
  process.stderr.write("Usage: pnpm --filter @offerkit/site snapshot <major.minor.patch>\n");
  process.exit(1);
}

const minorVersion = `${match[1]}.${match[2]}`;
const manifestPath = path.join(docsRoot, "versions.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (compareMinor(minorVersion, manifest.latest) < 0) {
  throw new Error(
    `Cannot promote v${minorVersion} over the current v${manifest.latest} docs. ` +
      "Backport corrections directly to the archived version instead.",
  );
}

const nextDirectory = path.join(docsRoot, "content", "next");
for (const requiredFile of ["index.mdx", "meta.json"]) {
  if (!fs.existsSync(path.join(nextDirectory, requiredFile))) {
    throw new Error(`content/next/${requiredFile} is required before creating a snapshot`);
  }
}

replaceDirectory(nextDirectory, path.join(docsRoot, "content", "docs"));
replaceDirectory(
  nextDirectory,
  path.join(docsRoot, "content", "versions", minorVersion),
);

const versions = [...new Set([minorVersion, ...manifest.versions])].sort((a, b) =>
  compareMinor(b, a),
);
const nextManifest = { latest: minorVersion, versions };
const temporaryManifest = `${manifestPath}.tmp`;
fs.writeFileSync(temporaryManifest, `${JSON.stringify(nextManifest, null, 2)}\n`);
fs.renameSync(temporaryManifest, manifestPath);

process.stdout.write(
  `Promoted content/next to latest and created the v${minorVersion} snapshot for ${requestedVersion}.\n`,
);

function replaceDirectory(source, target) {
  const temporary = `${target}.tmp`;
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.cpSync(source, temporary, { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(temporary, target);
}

function compareMinor(left, right) {
  const [leftMajor, leftMinor] = left.split(".").map(Number);
  const [rightMajor, rightMinor] = right.split(".").map(Number);
  return leftMajor === rightMajor ? leftMinor - rightMinor : leftMajor - rightMajor;
}
