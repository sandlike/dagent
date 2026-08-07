import { createHmac } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"

const masterKey = process.env.GIT_CREDENTIAL_ENCRYPTION_KEY || ""
const requirementId = process.env.DAGENT_REQUIREMENT_ID || ""
const outputDirectory = process.argv[2] || "/runtime-auth"

if (!masterKey || !/^\d+$/.test(requirementId)) {
  throw new Error("Runtime credential inputs are missing")
}

function derive(scope) {
  return createHmac("sha256", masterKey)
    .update(`dagent:${scope}:${requirementId}`)
    .digest("hex")
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(
  `${outputDirectory}/requirement-clarification-password`,
  derive("opencode:requirement_clarification"),
  { mode: 0o400 },
)
await writeFile(
  `${outputDirectory}/development-document-password`,
  derive("opencode:development_document"),
  { mode: 0o400 },
)
await writeFile(
  `${outputDirectory}/development-password`,
  derive("opencode:development"),
  { mode: 0o400 },
)
await writeFile(`${outputDirectory}/workspace-token`, derive("workspace"), { mode: 0o400 })
