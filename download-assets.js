// 镜像下载脚本：下载首页引用的所有静态资源，并迭代发现间接引用（CSS 里的字体/图片等）
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://ai-passport.folotoy.cn';
const ROOT = __dirname;

function fetchPath(p) {
  return new Promise((resolve, reject) => {
    const req = https.get(BASE + p, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${p}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('timeout ' + p)));
    req.on('error', reject);
  });
}

function saveLocal(p, buf) {
  const local = path.join(ROOT, p.replace(/^\//, ''));
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.writeFileSync(local, buf);
}

async function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // 从 HTML 中提取所有以 /_next 或 /assets 开头的资源引用
  const refs = new Set();
  const attrRe = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(html))) {
    const u = m[1];
    if (/^\/(_next|assets)\//.test(u)) refs.add(u);
  }
  // HTML 里内联 JSON（RSC payload）中的资源路径
  const jsonRe = /\\u002F(_next|assets)\\u002F[^"\\]+/g;
  while ((m = jsonRe.exec(html))) {
    refs.add('/' + m[0].replace(/\\u002F/g, '/'));
  }
  const scriptRe = /"(\/(?:_next|assets)\/[^"]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|mp4|json))"/g;
  while ((m = scriptRe.exec(html))) refs.add(m[1]);

  const downloaded = new Set();
  const failed = [];

  // 迭代下载：第一轮 HTML 引用，后续轮次扫描已下载的 CSS/JS 里的新引用
  for (let round = 1; round <= 4; round++) {
    const queue = [...refs].filter((r) => !downloaded.has(r));
    if (queue.length === 0) break;
    console.log(`第 ${round} 轮：待下载 ${queue.length} 个文件`);

    const newRefs = new Set();
    await Promise.all(
      queue.map(async (p) => {
        downloaded.add(p);
        try {
          const buf = await fetchPath(p);
          saveLocal(p, buf);
          // 扫描 CSS/JS 内容，找出其中引用的其他资源
          if (/\.(css|js)$/.test(p)) {
            const text = buf.toString('utf8');
            const re = /(?:\/_next\/(?:static|media|image)\/|\/assets\/)[A-Za-z0-9._\-/]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|mp4|json)/g;
            let r;
            while ((r = re.exec(text))) {
              if (!downloaded.has(r[0]) && !refs.has(r[0])) newRefs.add(r[0]);
            }
          }
        } catch (e) {
          failed.push(`${p} -> ${e.message}`);
        }
      })
    );
    for (const r of newRefs) refs.add(r);
  }

  console.log(`\n完成：共下载 ${downloaded.size} 个文件`);
  if (failed.length) {
    console.log(`失败 ${failed.length} 个：`);
    failed.forEach((f) => console.log('  ' + f));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
