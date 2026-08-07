import http from "node:http"
import path from "node:path"
import fs from "node:fs/promises"
import { spawn } from "node:child_process"

const root = path.resolve(process.env.WORKSPACE_ROOT || "/workspaces")
const port = Number(process.env.WORKSPACE_MANAGER_PORT || 8090)
const token = process.env.WORKSPACE_MANAGER_TOKEN || process.env.AGENT_CALLBACK_TOKEN || ""
const askpass = "/opt/dagent/git-askpass.sh"

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

function safeSegment(value) {
  const normalized = String(value || "repo").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return normalized.slice(0, 80) || "repo"
}

function safePath(value) {
  const resolved = path.resolve(String(value))
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Path is outside workspace root")
  return resolved
}

function gitEnvironment(credential) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" }
  if (credential?.password) {
    env.GIT_ASKPASS = askpass
    env.DAGENT_GIT_USERNAME = String(credential.username || "oauth2")
    env.DAGENT_GIT_PASSWORD = String(credential.password)
  }
  return env
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, options.timeoutMs || 120_000)
    const append = (current, chunk) => (current + chunk.toString("utf8")).slice(-1_000_000)
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk) })
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk) })
    child.on("error", (error) => { clearTimeout(timer); reject(error) })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (timedOut) return reject(new Error(`${command} timed out`))
      const result = { code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }
      if (result.code && !options.allowFailure) {
        reject(new Error(`${command} failed (${result.code}): ${result.stderr || result.stdout}`))
      } else resolve(result)
    })
  })
}

async function git(cwd, args, options = {}) {
  return run("git", args, { cwd, ...options })
}

async function exists(value) {
  try { await fs.access(value); return true } catch { return false }
}

function isTransientFile(filePath) {
  const normalized = filePath.replaceAll("\\", "/")
  return normalized.split("/").includes("__pycache__")
    || normalized.split("/").includes(".pytest_cache")
    || /\.py[co]$/.test(normalized)
    || normalized.endsWith(".coverage")
}

async function ensureLocalExcludes(repoPath) {
  const excludePath = path.join(repoPath, ".git", "info", "exclude")
  const marker = "# Dagent transient test outputs"
  const current = await fs.readFile(excludePath, "utf8").catch(() => "")
  if (current.includes(marker)) return
  await fs.mkdir(path.dirname(excludePath), { recursive: true })
  await fs.appendFile(
    excludePath,
    `${current && !current.endsWith("\n") ? "\n" : ""}${marker}\n__pycache__/\n*.py[cod]\n.pytest_cache/\n.coverage\n`,
  )
}

async function currentStatus(repoPath) {
  const head = (await git(repoPath, ["rev-parse", "HEAD"])).stdout
  const branch = (await git(repoPath, ["branch", "--show-current"])).stdout
  const porcelain = (await git(repoPath, ["status", "--porcelain"])).stdout
  const changedFiles = porcelain
    ? porcelain.split("\n").map((line) => line.slice(3).trim()).filter((item) => item && !isTransientFile(item))
    : []
  return { head_commit: head, branch_name: branch, changed_files: changedFiles }
}

async function changedFilesSince(repoPath, baselineCommit) {
  const status = await currentStatus(repoPath)
  if (!baselineCommit) return status.changed_files
  const committed = await git(repoPath, ["diff", "--name-only", `${baselineCommit}...HEAD`], { allowFailure: true })
  if (committed.code !== 0) return status.changed_files
  const committedFiles = committed.stdout ? committed.stdout.split("\n").map((item) => item.trim()).filter(Boolean) : []
  return [...new Set([...committedFiles, ...status.changed_files])].filter((item) => !isTransientFile(item))
}

async function verify(body) {
  const url = String(body.url || "")
  const branch = String(body.default_branch || "main")
  if (!url) throw new Error("Repository URL is required")
  const credentialConfigured = Boolean(body.credential?.password)
  const env = gitEnvironment(body.credential)
  const result = await git(root, ["ls-remote", "--exit-code", "--heads", "--", url, branch], {
    env,
    timeoutMs: 25_000,
    allowFailure: true,
  })
  if (result.code !== 0) {
    const detail = `${result.stderr}\n${result.stdout}`.toLowerCase()
    const authenticationFailed = credentialConfigured && [
      "authentication failed",
      "invalid username or password",
      "access denied",
      "http 401",
      "http 403",
      "could not read username",
      "repository not found",
    ].some((marker) => detail.includes(marker))
    return {
      result: authenticationFailed ? "token_invalid" : "read_failed",
      read_verified: false,
      write_verified: false,
      credential_configured: credentialConfigured,
      message: authenticationFailed ? "Git access token is invalid" : "Repository or default branch cannot be read",
    }
  }
  if (!credentialConfigured) {
    return {
      result: "read_success",
      read_verified: true,
      write_verified: false,
      credential_configured: false,
      message: "Repository read access verified; push credential is not configured",
      branch,
      head_commit: result.stdout.split(/\s+/)[0] || "",
    }
  }

  const verifyRoot = await fs.mkdtemp(path.join(root, ".verify-"))
  try {
    await git(verifyRoot, ["init", "--quiet"])
    await git(verifyRoot, ["fetch", "--quiet", "--depth=1", "--", url, branch], { env, timeoutMs: 60_000 })
    const write = await git(
      verifyRoot,
      ["push", "--dry-run", "--porcelain", "--", url, `FETCH_HEAD:refs/heads/${branch}`],
      { env, timeoutMs: 60_000, allowFailure: true },
    )
    if (write.code !== 0) {
      return {
        result: "no_write_permission",
        read_verified: true,
        write_verified: false,
        credential_configured: true,
        message: "Repository is readable but the token cannot push to the default branch",
      }
    }
    return {
      result: "read_write_success",
      read_verified: true,
      write_verified: true,
      credential_configured: true,
      message: "Repository read and push permissions verified",
      branch,
      head_commit: result.stdout.split(/\s+/)[0] || "",
    }
  } finally {
    await fs.rm(verifyRoot, { recursive: true, force: true })
  }
}

async function prepare(body) {
  const tenantId = Number(body.tenant_id)
  const requirementId = Number(body.requirement_id)
  if (!Number.isInteger(tenantId) || !Number.isInteger(requirementId)) throw new Error("Invalid tenant or requirement")
  const requirementRoot = safePath(path.join(root, `tenant-${tenantId}`, `requirement-${requirementId}`))
  await fs.mkdir(requirementRoot, { recursive: true })
  const output = []
  for (const repository of body.repositories || []) {
    const repositoryId = Number(repository.id)
    const repoPath = safePath(path.join(requirementRoot, `${safeSegment(repository.name)}-${repositoryId}`))
    const baseBranch = String(repository.default_branch || "main")
    const featureBranch = String(body.branch_name || `dagent/req-${requirementId}`)
    const env = gitEnvironment(repository.credential)
    if (!(await exists(path.join(repoPath, ".git")))) {
      await git(requirementRoot, ["clone", "--no-tags", "--branch", baseBranch, "--", String(repository.url), repoPath], { env, timeoutMs: 240_000 })
    } else {
      await git(repoPath, ["remote", "set-url", "origin", String(repository.url)])
      await git(repoPath, ["fetch", "--prune", "origin", baseBranch], { env, timeoutMs: 120_000 })
    }
    await ensureLocalExcludes(repoPath)
    const featureExists = (await git(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${featureBranch}`], { allowFailure: true })).code === 0
    if (featureExists) {
      await git(repoPath, ["checkout", featureBranch])
    } else if (body.write_branch) {
      await git(repoPath, ["checkout", "-B", featureBranch, `origin/${baseBranch}`])
    } else {
      await git(repoPath, ["checkout", "-B", baseBranch, `origin/${baseBranch}`])
    }
    const baseline = (await git(repoPath, ["rev-parse", `origin/${baseBranch}`])).stdout
    const status = await currentStatus(repoPath)
    const changedFiles = await changedFilesSince(repoPath, baseline)
    output.push({
      repository_id: repositoryId,
      path: repoPath,
      branch_name: status.branch_name,
      baseline_commit: baseline,
      ...status,
      changed_files: changedFiles,
    })
  }
  return { root: requirementRoot, workspaces: output }
}

async function commit(body) {
  const repoPath = safePath(body.path)
  await git(repoPath, ["add", "-A"])
  const staged = await git(repoPath, ["diff", "--cached", "--quiet"], { allowFailure: true })
  let committed = false
  if (staged.code !== 0) {
    await git(repoPath, ["config", "user.name", "Dagent"])
    await git(repoPath, ["config", "user.email", "dagent@local"])
    await git(repoPath, ["commit", "-m", String(body.message || "Dagent changes")])
    committed = true
  }
  const status = await currentStatus(repoPath)
  return {
    committed,
    ...status,
    changed_files: await changedFilesSince(repoPath, String(body.baseline_commit || "")),
  }
}

function isAllowedTestPath(filePath) {
  const [topLevel] = filePath.replaceAll("\\", "/").split("/").filter(Boolean)
  return ["tests", "e2e", "specs"].includes(topLevel)
}

async function restoreUnauthorizedTestPath(repoPath, filePath) {
  const target = path.resolve(repoPath, filePath)
  if (target !== repoPath && !target.startsWith(`${repoPath}${path.sep}`)) {
    throw new Error("Test Agent produced an invalid workspace path")
  }
  const tracked = await git(repoPath, ["ls-files", "--error-unmatch", "--", filePath], { allowFailure: true })
  if (tracked.code === 0) {
    await git(repoPath, ["restore", "--staged", "--worktree", "--", filePath], { allowFailure: true })
  } else {
    await fs.rm(target, { recursive: true, force: true })
  }
}

async function enforceTestScope(body) {
  const repoPath = safePath(body.path)
  const status = await currentStatus(repoPath)
  const expectedHead = String(body.expected_head || "")
  const changedFiles = expectedHead ? await changedFilesSince(repoPath, expectedHead) : status.changed_files
  const violations = changedFiles.filter((filePath) => !isAllowedTestPath(filePath))
  if (violations.length) {
    if (expectedHead && status.head_commit !== expectedHead) {
      await git(repoPath, ["reset", "--hard", expectedHead])
    }
    for (const filePath of violations) await restoreUnauthorizedTestPath(repoPath, filePath)
    throw new Error(`Testing Agent attempted to modify business files: ${violations.join(", ")}`)
  }
  return { allowed: true, changed_files: changedFiles }
}

async function push(body) {
  const repoPath = safePath(body.path)
  const result = await git(repoPath, ["push", "-u", "origin", "HEAD"], { env: gitEnvironment(body.credential) })
  return { pushed: true, message: result.stderr || result.stdout, ...(await currentStatus(repoPath)) }
}

async function mergeCheck(body) {
  const repoPath = safePath(body.path)
  const target = String(body.target_branch || "main")
  await git(repoPath, ["fetch", "origin", target], { env: gitEnvironment(body.credential) })
  const result = await git(repoPath, ["merge-tree", "--write-tree", `origin/${target}`, "HEAD"], { allowFailure: true })
  const conflictFiles = [...`${result.stdout}\n${result.stderr}`.matchAll(/CONFLICT \([^)]*\): .* in (.+)$/gm)].map((item) => item[1].trim())
  return {
    can_merge: result.code === 0,
    target_branch: target,
    conflict_files: [...new Set(conflictFiles)],
    message: result.code === 0 ? "Merge check passed" : (result.stderr || result.stdout || "Merge conflict"),
  }
}

async function merge(body) {
  const repoPath = safePath(body.path)
  const target = String(body.target_branch || "main")
  const source = (await git(repoPath, ["branch", "--show-current"])).stdout
  const env = gitEnvironment(body.credential)
  await git(repoPath, ["fetch", "origin", target], { env })
  await git(repoPath, ["checkout", "-B", target, `origin/${target}`])
  try {
    await git(repoPath, ["merge", "--no-ff", "--no-edit", source])
    const targetCommit = (await git(repoPath, ["rev-parse", "HEAD"])).stdout
    await git(repoPath, ["push", "origin", target], { env })
    await git(repoPath, ["checkout", source])
    return {
      merged: true,
      source_branch: source,
      target_branch: target,
      target_commit: targetCommit,
      ...(await currentStatus(repoPath)),
    }
  } catch (error) {
    await git(repoPath, ["merge", "--abort"], { allowFailure: true })
    await git(repoPath, ["checkout", source], { allowFailure: true })
    throw error
  }
}

const handlers = {
  "/verify": verify,
  "/prepare": prepare,
  "/status": async (body) => currentStatus(safePath(body.path)),
  "/enforce-test-scope": enforceTestScope,
  "/commit": commit,
  "/push": push,
  "/merge-check": mergeCheck,
  "/merge": merge,
}

const server = http.createServer(async (request, response) => {
  if (request.url === "/health" && request.method === "GET") return json(response, 200, { status: "ok" })
  if (!token || request.headers.authorization !== `Bearer ${token}`) return json(response, 401, { error: "unauthorized" })
  const handler = handlers[request.url]
  if (request.method !== "POST" || !handler) return json(response, 404, { error: "not found" })
  let raw = ""
  request.on("data", (chunk) => {
    raw += chunk.toString("utf8")
    if (raw.length > 1_000_000) request.destroy()
  })
  request.on("end", async () => {
    try {
      json(response, 200, await handler(JSON.parse(raw || "{}")))
    } catch (error) {
      console.error(String(error?.message || error).replace(/https?:\/\/[^\s@]+@/g, "https://<redacted>@"))
      json(response, 409, { error: String(error?.message || error).replace(/https?:\/\/[^\s@]+@/g, "https://<redacted>@") })
    }
  })
})

server.listen(port, "0.0.0.0", () => console.log(`workspace-manager listening on ${port}`))
