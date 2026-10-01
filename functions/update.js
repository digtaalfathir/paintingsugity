// Halaman /update: PM pilih index.html baru + password, file di-commit ke GitHub,
// lalu Cloudflare deploy otomatis seperti biasa.
// Butuh 2 secret di Cloudflare Pages: UPDATE_PASSWORD dan GITHUB_TOKEN
// (fine-grained token, hanya repo ini, izin Contents: Read and write).
const API = 'https://api.github.com/repos/digtaalfathir/paintingsugity/contents/index.html';

const PAGE = `<!DOCTYPE html>
<html lang="id">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Update Web</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; background: #f3f4f6; }
  main { width: 100%; max-width: 420px; background: #fff; border-radius: 12px; padding: 32px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06); }
  h1 { margin: 0 0 4px; font-size: 22px; }
  p { margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5; }
  label { display: block; margin: 20px 0 6px; font-size: 14px; font-weight: 600; }
  input { width: 100%; padding: 10px 12px; font-size: 16px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; }
  input:focus-visible, button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  button { width: 100%; margin-top: 24px; padding: 12px; font-size: 16px; font-weight: 600; color: #fff;
    background: #2563eb; border: 0; border-radius: 8px; cursor: pointer; }
  button:hover { background: #1d4ed8; }
  button:disabled { background: #93c5fd; cursor: wait; }
  #status { margin-top: 16px; min-height: 21px; }
  #status.error { color: #b91c1c; }
  #wait { text-align: center; }
  #wait p { margin-top: 8px; }
  .spinner { width: 40px; height: 40px; margin: 0 auto 20px; border: 4px solid #dbeafe; border-top-color: #2563eb;
    border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 4s; } }
</style>
<main>
  <form>
    <h1>Update Web</h1>
    <p>Pilih file HTML terbaru untuk menggantikan halaman utama.</p>
    <label for="pw">Password</label>
    <input id="pw" type="password" autocomplete="current-password" required>
    <label for="file">File HTML baru</label>
    <input id="file" type="file" accept=".html" required>
    <button>Upload</button>
    <p id="status" role="status"></p>
  </form>
  <div id="wait" role="status" hidden>
    <div class="spinner"></div>
    <h1>Upload berhasil</h1>
    <p>Web sedang diperbarui, biasanya sekitar 1 menit.<br>Anda akan dialihkan otomatis, jangan tutup halaman ini.</p>
    <p id="elapsed"></p>
  </div>
</main>
<script>
  const form = document.querySelector('form'), status = document.getElementById('status');
  const button = form.querySelector('button');
  const live = () => fetch('/?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()).catch(() => null);

  // Tunggu sampai halaman utama benar-benar berubah, baru redirect (maksimal 2 menit).
  const waitAndRedirect = (old) => {
    form.hidden = true;
    document.getElementById('wait').hidden = false;
    const start = Date.now();
    const timer = setInterval(async () => {
      const sec = Math.round((Date.now() - start) / 1000);
      document.getElementById('elapsed').textContent = 'Menunggu... ' + sec + ' detik';
      if (sec % 5) return;
      const now = sec >= 120 ? 'timeout' : await live();
      if (now !== null && now !== old) { clearInterval(timer); location.href = '/'; }
    }, 1000);
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async () => {
      button.disabled = true;
      status.className = '';
      status.textContent = 'Mengupload...';
      try {
        const old = await live();
        const res = await fetch('', {
          method: 'POST',
          headers: { 'x-password': document.getElementById('pw').value },
          body: reader.result.split(',')[1], // base64 saja, tanpa prefix data:
        });
        if (res.ok) return waitAndRedirect(old);
        status.textContent = await res.text();
      } catch {
        status.textContent = 'Gagal: koneksi bermasalah, coba lagi.';
      }
      status.className = 'error';
      button.disabled = false;
    };
    reader.readAsDataURL(document.getElementById('file').files[0]);
  };
</script>
</html>`;

export const onRequestGet = () =>
  new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  // ponytail: tanpa rate limit, pakai password panjang; tambah Cloudflare Access kalau perlu lebih ketat
  if (!env.UPDATE_PASSWORD || request.headers.get('x-password') !== env.UPDATE_PASSWORD)
    return new Response('Gagal: password salah.', { status: 401 });

  const content = await request.text();
  if (!content || /[^A-Za-z0-9+/=]/.test(content))
    return new Response('Gagal: file tidak valid.', { status: 400 });

  const headers = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'paintingsugity-update',
  };
  const current = await fetch(API, { headers });
  if (!current.ok) return new Response('Gagal: tidak bisa akses GitHub, hubungi admin.', { status: 502 });
  const { sha } = await current.json();

  const date = new Date().toISOString().slice(0, 10);
  const put = await fetch(API, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message: `update ${date} (via /update)`, sha, content }),
  });
  if (!put.ok) return new Response('Gagal: GitHub menolak, hubungi admin.', { status: 502 });
  return new Response('Berhasil! Web akan terupdate dalam ±1 menit.');
}
