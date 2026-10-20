// AI Passport 本地静态服务器
// 由「双击启动本地预览.command」调用，也可手动运行: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4173;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';

  // 目录路径映射到目录下的 index.html（Next.js 静态导出风格）
  let filePath = path.join(ROOT, urlPath);
  if (!filePath.endsWith(path.sep) && !path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  // 防止路径穿越
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + urlPath + '（该页面未包含在本地镜像中）');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
  });
  fs.createReadStream(resolved).pipe(res);
});

// 允许端口复用，避免重启时因 TIME_WAIT 启动失败
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 仍被占用，请稍后重试或重启电脑`);
  } else {
    console.error('服务器错误:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`本地预览已启动: http://localhost:${PORT}/`);
  console.log(`站点目录: ${ROOT}`);
  console.log('按 Ctrl+C 停止服务');
});
