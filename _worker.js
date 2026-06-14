// 💎 Pages専用に調整したトップ画面HTML（コピーしてgetHTMLの中身と差し替えてください）
function getHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Web Proxy Ultimate</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f7f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .container { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 500px; width: 100%; box-sizing: border-box; }
    h1 { color: #333; margin-bottom: 24px; font-size: 28px; }
    .search-box { display: flex; border: 2px solid #ddd; border-radius: 8px; overflow: hidden; transition: border-color 0.3s; }
    .search-box:focus-within { border-color: #0070f3; }
    input { flex: 1; padding: 14px; border: none; outline: none; font-size: 16px; }
    button { background: #0070f3; color: white; border: none; padding: 0 24px; font-size: 16px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
    button:hover { background: #0051a8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Web Proxy</h1>
    <div class="search-box">
      <input type="text" id="urlInput" placeholder="https://example.com" onkeydown="if(event.key==='Enter')launchProxy()">
      <button onclick="launchProxy()">Go</button>
    </div>
  </div>
  <script>
    function launchProxy() {
      const input = document.getElementById('urlInput').value.trim();
      if (!input) return;
      let targetUrl = input;
      if (!/^https?:\\/\\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }
      // ⚠️ Pages用にここを修正しました
      window.location.href = window.location.origin + '/v1/data/' + targetUrl;
    }
  </script>
</body>
</html>`;
}
