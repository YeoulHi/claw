import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { log } from '../log.js';

const execFileAsync = promisify(execFile);

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

function extractBody(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

function extractExcerpt(body: string, maxLen = 150): string {
  const plain = body
    .replace(/^#+\s+.*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\S+$/, '').trim() + '...';
}

function buildTopicFile(opts: {
  title: string;
  date: string;
  excerpt: string;
  sourceUrl: string;
  body: string;
}): string {
  const { title, date, excerpt, sourceUrl, body } = opts;
  const safeTitle = title.replace(/"/g, '\\"');
  const safeExcerpt = excerpt.replace(/"/g, '\\"');
  return [
    '---',
    `title: "${safeTitle}"`,
    `date: "${date}"`,
    `excerpt: "${safeExcerpt}"`,
    'tags:',
    '  - AI',
    `source_url: "${sourceUrl}"`,
    '---',
    '',
    body,
  ].join('\n');
}

/**
 * wiki raw/ 디렉토리에서 sinceMs 이후 생성/수정된 파일을 찾아
 * context-hub의 content/topics/{slug}/index.md를 생성 후 커밋/푸시.
 * 이미 topic 파일이 존재하면 건너뜀.
 * 반환값: 생성된 topic 파일 수
 */
export async function syncNewTopics(
  wikiDir: string,
  contextHubDir: string,
  sinceMs: number,
): Promise<number> {
  const rawDir = path.join(wikiDir, 'raw');
  if (!fs.existsSync(rawDir)) return 0;

  const topicsContentDir = path.join(contextHubDir, 'apps', 'www', 'content', 'topics');
  fs.mkdirSync(topicsContentDir, { recursive: true });

  const candidates = fs
    .readdirSync(rawDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = path.join(rawDir, f);
      return { filename: f, filePath, mtime: fs.statSync(filePath).mtimeMs };
    })
    .filter((f) => f.mtime >= sinceMs);

  if (candidates.length === 0) return 0;

  const created: string[] = [];

  for (const { filename, filePath } of candidates) {
    const slug = filename.replace(/\.md$/, '');
    const topicDir = path.join(topicsContentDir, slug);
    const topicFile = path.join(topicDir, 'index.md');

    if (fs.existsSync(topicFile)) continue;

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const fm = parseFrontmatter(rawContent);
    const sourceUrl = fm.source_url ?? fm.hada_url ?? '';
    if (!sourceUrl) continue;

    const title = fm.title ?? slug.replace(/-/g, ' ');
    const date = fm.collected ?? new Date().toISOString().slice(0, 10);
    const body = extractBody(rawContent);
    const excerpt = extractExcerpt(body);
    const topicContent = buildTopicFile({ title, date, excerpt, sourceUrl, body });

    fs.mkdirSync(topicDir, { recursive: true });
    fs.writeFileSync(topicFile, topicContent, 'utf-8');
    created.push(slug);
    log.info({ slug }, 'topic-sync: created topic file');
  }

  if (created.length === 0) return 0;

  await execFileAsync('git', ['-C', contextHubDir, 'add', 'apps/www/content/topics']);
  await execFileAsync('git', ['-C', contextHubDir, 'commit', '-m',
    `feat: topic 자동 생성 — ${created.join(', ')}`,
  ]);
  await execFileAsync('git', ['-C', contextHubDir, 'push']);

  log.info({ count: created.length, slugs: created }, 'topic-sync: committed and pushed');
  return created.length;
}
