import fs from 'node:fs';
import path from 'node:path';
import { log } from '../log.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30분마다 체크
const DIGEST_HOUR_KST = 12; // 정오(KST)에 실행
const DISCORD_API = 'https://discord.com/api/v10';

interface DigestItem {
  title: string;
  url: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function scanNewItems(wikiDir: string, dateStr: string): DigestItem[] {
  const rawDir = path.join(wikiDir, 'raw');
  if (!fs.existsSync(rawDir)) return [];

  const items: DigestItem[] = [];
  for (const filename of fs.readdirSync(rawDir)) {
    if (!filename.endsWith('.md')) continue;
    try {
      const content = fs.readFileSync(path.join(rawDir, filename), 'utf-8');
      const fm = parseFrontmatter(content);
      if (fm.collected !== dateStr) continue;
      const url = fm.source_url ?? fm.hada_url ?? '';
      if (!url) continue;
      const title = fm.title ?? filename.replace(/\.md$/, '').replace(/-/g, ' ');
      items.push({ title, url });
    } catch {
      // 파일 읽기 실패 시 건너뜀
    }
  }
  return items;
}

function buildDigestMessage(items: DigestItem[]): string {
  const lines: string[] = [
    '**VMC Daily Digest**',
    '',
    '> 하루 한번, VibeMafia가 큐레이팅한 AI 소식을 전송합니다.',
    '',
  ];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. **${item.title}** [🔗 링크](${item.url})`);
  });
  return lines.join('\n');
}

async function postToDiscord(token: string, channelId: string, content: string): Promise<void> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
}

export class DailyDigestScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastDigestDate: string | null = null;

  constructor(
    private readonly wikiDir: string,
    private readonly vmcBotToken: string,
    private readonly vmcChannelId: string,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.check();
    }, CHECK_INTERVAL_MS);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async check(): Promise<void> {
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dateStr = nowKst.toISOString().slice(0, 10);
    const hour = nowKst.getUTCHours();

    if (this.lastDigestDate === dateStr) {
      log.debug('daily-digest: already ran today, skipping');
      return;
    }

    if (hour < DIGEST_HOUR_KST || hour >= DIGEST_HOUR_KST + 1) {
      log.debug({ hour }, 'daily-digest: not in digest window, skipping');
      return;
    }

    this.lastDigestDate = dateStr;
    log.info({ date: dateStr }, 'daily-digest: running');

    try {
      const items = scanNewItems(this.wikiDir, dateStr);
      if (items.length === 0) {
        log.info('daily-digest: no new items today, skipping');
        return;
      }

      const message = buildDigestMessage(items);
      await postToDiscord(this.vmcBotToken, this.vmcChannelId, message);
      log.info({ count: items.length, date: dateStr }, 'daily-digest: sent');
    } catch (err) {
      log.error({ err: (err as Error).message }, 'daily-digest: failed');
    }
  }
}
