export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. トップページ（検索窓画面）を表示
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(getHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // 2. プロキシ中継処理
    if (url.pathname.startsWith("/v1/data/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400"
          }
        });
      }

      const targetUrlStr = url.pathname.slice("/v1/data/".length) + url.search;
      if (!targetUrlStr) return new Response("Missing target URL", { status: 400 });

      let actualTargetUrl;
      try {
        actualTargetUrl = new URL(targetUrlStr);
      } catch (e) {
        return new Response("Invalid target URL", { status: 400 });
      }

      try {
        const proxyRequestHeaders = new Headers(request.headers);
        proxyRequestHeaders.set("Host", actualTargetUrl.host);
        proxyRequestHeaders.delete("cf-connecting-ip");
        proxyRequestHeaders.delete("x-real-ip");

        let body = null;
        if (!["GET", "HEAD"].includes(request.method) && request.body) {
          body = request.body;
        }

        const response = await fetch(actualTargetUrl.href, {
          method: request.method,
          headers: proxyRequestHeaders,
          body: body,
          redirect: "manual"
        });

        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.delete("content-security-policy");
        responseHeaders.delete("content-security-policy-report-only");
        responseHeaders.delete("clear-site-data");

        if (responseHeaders.has("Set-Cookie")) {
          const cookieEntries = responseHeaders.getSetCookie();
          responseHeaders.delete("Set-Cookie");
          for (const cookie of cookieEntries) {
            const modifiedCookie = cookie
              .replace(/;\s*Secure/gi, "")
              .replace(/;\s*SameSite=[a-z]+/gi, "; SameSite=None");
            responseHeaders.append("Set-Cookie", modifiedCookie);
          }
        }

        const proxyBase = `${url.origin}/v1/data/`;

        const redirectStatuses =;
        if (redirectStatuses.includes(response.status)) {
          const location = responseHeaders.get("Location");
          if (location) {
            const absoluteLocation = new URL(location, actualTargetUrl.href).href;
            if (!absoluteLocation.startsWith(proxyBase)) {
              responseHeaders.set("Location", proxyBase + absoluteLocation);
            } else {
              responseHeaders.set("Location", absoluteLocation);
            }
          }
          return new Response(response.body, { status: response.status, headers: responseHeaders });
        }

        const reformatUrl = (attrValue) => {
          if (!attrValue || attrValue.startsWith("data:") || attrValue.startsWith("#") || attrValue.startsWith("javascript:")) {
            return attrValue;
          }
          try {
            const absolute = new URL(attrValue, actualTargetUrl.href).href;
            if (absolute.startsWith(proxyBase)) return absolute;
            return proxyBase + absolute;
          } catch (e) {
            return attrValue;
          }
        };

        const contentType = responseHeaders.get("Content-Type") || "";

        if (contentType.includes("text/html")) {
          const rewriter = new HTMLRewriter()
            .on("a", { element(el) { if (el.hasAttribute("href")) el.setAttribute("href", reformatUrl(el.getAttribute("href"))); } })
            .on("link", { element(el) { if (el.hasAttribute("href")) el.setAttribute("href", reformatUrl(el.getAttribute("href"))); } })
            .on("form", { element(el) { if (el.hasAttribute("action")) el.setAttribute("action", reformatUrl(el.getAttribute("action"))); } })
            .on("script", { element(el) { if (el.hasAttribute("src")) el.setAttribute("src", reformatUrl(el.getAttribute("src"))); } })
            .on("img", {
              element(el) {
                if (el.hasAttribute("src")) el.setAttribute("src", reformatUrl(el.getAttribute("src")));
                if (el.hasAttribute("data-src")) el.setAttribute("data-src", reformatUrl(el.getAttribute("data-src")));
                if (el.hasAttribute("srcset")) {
                  try {
                    let srcSet = el.getAttribute("srcset").split(',').map(s => {
                      let parts = s.trim().split(/\s+/);
                      if (parts.length > 0) parts[0] = reformatUrl(parts[0]);
                      return parts.join(' ');
                    }).join(', ');
                    el.setAttribute("srcset", srcSet);
                  } catch (e) {}
                }
              }
            })
            .on("source", {
              element(el) {
                if (el.hasAttribute("src")) el.setAttribute("src", reformatUrl(el.getAttribute("src")));
                if (el.hasAttribute("srcset")) el.setAttribute("srcset", reformatUrl(el.getAttribute("srcset")));
              }
            });

          return new Response(rewriter.transform(response).body, { status: response.status, headers: responseHeaders });
        }

        if (contentType.includes("text/css") || contentType.includes("javascript") || contentType.includes("json")) {
          let text = await response.text();
          const escapedHost = actualTargetUrl.host.replace(/\./g, '\\.');
          const urlRegex = new RegExp(`(https?:)?//${escapedHost}`, 'g');
          text = text.replace(urlRegex, `${url.origin}/v1/data/https://${actualTargetUrl.host}`);

          if (contentType.includes("text/css")) {
            text = text.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, path) => {
              if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://") || path.startsWith(proxyBase)) {
                return match;
              }
              try {
                const absoluteAssetUrl = new URL(path, actualTargetUrl.href).href;
                return `url(${proxyBase}${absoluteAssetUrl})`;
              } catch (e) {}
              return match;
            });
          }
          return new Response(text, { status: response.status, headers: responseHeaders });
        }

        return new Response(response.body, { status: response.status, headers: responseHeaders });

      } catch (e) {
        return new Response("🚀 Proxy Engine Error: " + e.message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

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
      window.location.href = window.location.origin + '/v1/data/' + targetUrl;
    }
  </script>
</body>
</html>`;
}
