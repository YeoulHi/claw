import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type Artifact, extractArtifacts } from './artifact.js';
import { log } from './log.js';

export interface CodexRunOptions {
  /** Working directory for the codex session */
  cwd: string;
  /** User message — sent via stdin */
  prompt: string;
  /** Session ID to resume. Omit for a fresh session. */
  resume?: string;
  /** Additional system-style instructions. Appended after the prompt with a "---" separator. */
  systemAppend?: string;
  /** Override model (e.g. 'o3', 'gpt-4o'). Defaults to CLI's configured model. */
  model?: string;
  /** Cancellation. Default: none. */
  signal?: AbortSignal;
  /** Hard timeout in ms. Default 600_000 (10 min). */
  timeoutMs?: number;
}

export interface CodexRunResult {
  /** The assistant's final reply text. */
  text: string;
  /** Session ID for the next resume. */
  sessionId: string;
  /** Wall-clock duration. */
  durationMs: number;
  /** codex process exit code (0 on success). */
  exitCode: number;
  /** Parsed artifact markers stripped from text (files to attach, URLs to link). */
  artifacts: Artifact[];
  /** Always 0 — codex does not expose context window usage. */
  contextWindowUsed: number;
  /** Always 0 — codex does not expose context window size. */
  contextWindowMax: number;
  /** Always 0 — codex does not expose cost. */
  costUsd: number;
}

export class CodexError extends Error {
  exitCode: number;
  stderr: string;
  constructor(msg: string, exitCode: number, stderr: string) {
    super(msg);
    this.name = 'CodexError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

const DEFAULT_TIMEOUT_MS = 600_000;
const SIGKILL_GRACE_MS = 5_000;

function getCodexBin(): string {
  return process.env['CODEX_BIN'] ?? 'codex';
}

function buildPrompt(prompt: string, systemAppend: string | undefined): string {
  if (systemAppend?.length) {
    return `${prompt}\n\n---\n${systemAppend}`;
  }
  return prompt;
}

function buildArgs(opts: CodexRunOptions): string[] {
  // SSOT: claw/docs/codex-cli-spec.md
  // - codex exec [OPTIONS] [PROMPT]              새 세션
  // - codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]   세션 재개
  // 두 명령은 옵션 집합이 다름. resume은 --sandbox/-s, --cd/-C 등 받지 않음 (있으면 exit 2).
  // '-' 는 PROMPT를 stdin에서 읽으라는 표시.
  const args: string[] = ['exec'];
  if (opts.resume) {
    // resume: SESSION_ID는 위치 인자. --sandbox 추가 금지.
    args.push('resume', opts.resume, '--json');
    if (opts.model) args.push('--model', opts.model);
  } else {
    // 새 세션: --sandbox로 권한 우회 (codex.ts SSOT의 enum 값)
    args.push('--json', '--sandbox', 'danger-full-access');
    if (opts.model) args.push('--model', opts.model);
  }
  args.push('-');
  return args;
}

// codex exec --json event shapes — SSOT: claw/docs/codex-cli-spec.md
// codex-cli 0.133+ 는 `thread.started` 이벤트로 thread_id 노출. 구버전(0.130)의
// `session_meta`/`session_summary`도 fallback으로 유지 (호환성).
interface CodexEvent {
  type?: string;
  item?: {
    id?: string;
    // 'assistant_message' | 'agent_message' (both observed in docs)
    item_type?: string;
    type?: string;
    text?: string;
    role?: string;
    content?: Array<{ type?: string; text?: string }> | string;
  };
  // session_summary (legacy) or session_meta (v0.130+)
  session_id?: string;
  payload?: { id?: string };
  rollout_path?: string;
  // thread.started (v0.133+)
  thread_id?: string;
}

function tryParseJson(line: string): CodexEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as CodexEvent;
  } catch {
    return null;
  }
}

function extractItemText(event: CodexEvent): string {
  const item = event.item;
  if (!item) return '';
  // item_type field (observed format): 'assistant_message' or 'agent_message'
  const itemType = item.item_type ?? item.type ?? '';
  if (!itemType.includes('message')) return '';
  // role guard (legacy format)
  if (item.role && item.role !== 'assistant') return '';
  if (typeof item.text === 'string') return item.text;
  // legacy content array
  if (Array.isArray(item.content)) {
    return item.content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('');
  }
  if (typeof item.content === 'string') return item.content;
  return '';
}

interface ParseAccumulator {
  sessionId: string;
  text: string;
}

function newAccumulator(): ParseAccumulator {
  return { sessionId: '', text: '' };
}

function consumeEvent(acc: ParseAccumulator, event: CodexEvent): void {
  if (event.type === 'thread.started') {
    // codex-cli 0.133+ — top-level thread_id
    if (event.thread_id) acc.sessionId = event.thread_id;
  } else if (event.type === 'session_summary') {
    // legacy
    if (event.session_id) acc.sessionId = event.session_id;
  } else if (event.type === 'session_meta') {
    // v0.130
    if (event.payload?.id) acc.sessionId = event.payload.id;
  } else if (event.type === 'item.completed') {
    const t = extractItemText(event);
    if (t) acc.text += t;
  }
}

function getCodexHome(): string {
  return process.env['CODEX_HOME'] ?? os.homedir();
}

function getCodexSessionsDir(): string {
  const codexHome = getCodexHome();
  if (path.basename(codexHome).toLowerCase() === '.codex') {
    return path.join(codexHome, 'sessions');
  }
  return path.join(codexHome, '.codex', 'sessions');
}

async function lookupLatestCodexSessionId(): Promise<string> {
  // Codex stores sessions in ~/.codex/sessions/ (nested: YYYY/MM/DD/rollout-*.jsonl)
  // CODEX_HOME overrides os.homedir() for non-standard service environments (e.g. NSSM LocalSystem).
  const sessionsDir = getCodexSessionsDir();
  const entries = await fs.readdir(sessionsDir, { recursive: true }).catch(() => [] as string[]);
  let newest = '';
  let newestMtime = 0;
  for (const name of entries) {
    const full = path.join(sessionsDir, name as string);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile()) continue;
    if (stat.mtimeMs > newestMtime) {
      newestMtime = stat.mtimeMs;
      newest = name as string;
    }
  }
  if (!newest) throw new Error(`no codex session files found in ${sessionsDir}`);
  // Extract UUID from filename: rollout-YYYY-MM-DDTHH-MM-SS-{uuid}.jsonl
  const basename = path.basename(newest).replace(/\.(json|jsonl)$/, '');
  const uuidMatch = basename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return uuidMatch ? uuidMatch[1] : basename;
}

/**
 * resume 실패 stderr 패턴.
 * - 사건 7(crypto.randomUUID fallback이 DB에 적재됐던 가짜 UUID로 resume 시도)
 * - 또는 codex 측에서 rollout 파일 누락 / thread/resume RPC 실패
 * 감지 시 fresh session으로 한 번 retry (silent fallback 아님 — 명시적 로그 + 진짜 새 세션 강제).
 * SSOT: claw/docs/sop/ssot-first-debugging.md "fallback 함정"의 marker 패턴 적용.
 */
function isCodexResumeFailure(stderr: string): boolean {
  return (
    stderr.includes('no rollout found') ||
    stderr.includes('thread/resume failed') ||
    stderr.includes('thread/resume:')
  );
}

export async function runCodex(opts: CodexRunOptions): Promise<CodexRunResult> {
  try {
    return await runCodexOnce(opts);
  } catch (err) {
    if (
      opts.resume &&
      err instanceof CodexError &&
      isCodexResumeFailure(err.stderr)
    ) {
      log.warn(
        { resume: opts.resume, stderrTail: err.stderr.slice(-200) },
        'codex resume failed (stale or missing rollout) — retrying as fresh session',
      );
      return await runCodexOnce({ ...opts, resume: undefined });
    }
    throw err;
  }
}

function runCodexOnce(opts: CodexRunOptions): Promise<CodexRunResult> {
  return (async () => {
    const start = Date.now();
    const args = buildArgs(opts);
    const stdinPayload = buildPrompt(opts.prompt, opts.systemAppend);
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    log.debug(
      {
        cwd: opts.cwd,
        resume: opts.resume,
        promptLen: opts.prompt.length,
        systemAppendLen: opts.systemAppend?.length ?? 0,
      },
      'codex run start',
    );

    return await new Promise<CodexRunResult>((resolve, reject) => {
      const proc = spawn(getCodexBin(), args, {
        cwd: opts.cwd,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const acc = newAccumulator();
      let lineBuf = '';
      let stderrBuf = '';
      let settled = false;
      let killTimer: NodeJS.Timeout | null = null;
      let sigkillTimer: NodeJS.Timeout | null = null;

      const cleanup = (): void => {
        if (killTimer) { clearTimeout(killTimer); killTimer = null; }
        if (sigkillTimer) { clearTimeout(sigkillTimer); sigkillTimer = null; }
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      };

      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const killHard = (): void => {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
        sigkillTimer = setTimeout(() => {
          try { proc.kill('SIGKILL'); } catch { /* ignore */ }
        }, SIGKILL_GRACE_MS);
        sigkillTimer.unref();
      };

      const onAbort = (): void => {
        settle(() => {
          killHard();
          reject(new CodexError('codex run aborted', -1, stderrBuf));
        });
      };

      if (opts.signal) {
        if (opts.signal.aborted) { onAbort(); return; }
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      killTimer = setTimeout(() => {
        settle(() => {
          killHard();
          reject(new CodexError(`codex run exceeded timeout ${timeoutMs}ms`, -1, stderrBuf));
        });
      }, timeoutMs);
      killTimer.unref();

      proc.on('error', (err) => {
        settle(() => {
          reject(new CodexError(`failed to spawn codex: ${err.message}`, -1, stderrBuf));
        });
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        lineBuf += chunk.toString('utf8');
        let idx: number;
        while ((idx = lineBuf.indexOf('\n')) !== -1) {
          const line = lineBuf.slice(0, idx);
          lineBuf = lineBuf.slice(idx + 1);
          const event = tryParseJson(line);
          if (event) consumeEvent(acc, event);
        }
      });

      proc.stdin.on('error', (err) => {
        log.debug({ err: err.message }, 'codex stdin error');
      });

      proc.stdin.end(stdinPayload, 'utf8');

      proc.on('close', (code, signal) => {
        // Drain remaining line buffer
        if (lineBuf.trim()) {
          const event = tryParseJson(lineBuf);
          if (event) consumeEvent(acc, event);
          lineBuf = '';
        }

        const exitCode = code ?? (signal ? -1 : 1);
        const durationMs = Date.now() - start;

        if (exitCode !== 0) {
          settle(() => {
            log.error(
              { exitCode, signal, durationMs, stderr: stderrBuf.slice(-500) },
              'codex run failed',
            );
            reject(
              new CodexError(
                `codex exited with code ${exitCode}${signal ? ` (signal ${signal})` : ''}`,
                exitCode,
                stderrBuf,
              ),
            );
          });
          return;
        }

        const finalize = async (): Promise<CodexRunResult> => {
          if (!acc.text) {
            throw new CodexError('codex run produced no assistant text', exitCode, stderrBuf);
          }
          const sessionId = acc.sessionId || await lookupLatestCodexSessionId().catch(() => crypto.randomUUID());
          const { text, artifacts } = extractArtifacts(acc.text);
          return { text, sessionId, durationMs, exitCode, artifacts, contextWindowUsed: 0, contextWindowMax: 0, costUsd: 0 };
        };

        finalize().then(
          (result) => {
            settle(() => {
              log.info(
                {
                  durationMs: result.durationMs,
                  sessionId: result.sessionId,
                  textLen: result.text.length,
                  resumed: Boolean(opts.resume),
                },
                'codex run ok',
              );
              resolve(result);
            });
          },
          (err: unknown) => {
            settle(() => {
              const e =
                err instanceof CodexError
                  ? err
                  : new CodexError(
                      `codex run post-processing failed: ${(err as Error).message}`,
                      exitCode,
                      stderrBuf,
                    );
              log.error(
                { err: e.message, exitCode: e.exitCode, durationMs },
                'codex run finalize failed',
              );
              reject(e);
            });
          },
        );
      });
    });
  })();
}
