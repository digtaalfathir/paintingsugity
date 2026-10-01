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
  body { font-family: sans-serif; max-width: 420px; margin: 60px auto; padding: 0 16px; }
  label { display: block; margin: 16px 0 6px; }
  input, button { font-size: 16px; width: 100%; box-sizing: border-box; padding: 10px; }
  button { margin-top: 20px; cursor: pointer; }
</style>
<h1>Update Web</h1>
<form>
  <label for="pw">Password</label>
  <input id="pw" type="password" required>
  <label for="file">File HTML baru</label>
  <input id="file" type="file" accept=".html" required>
  <button>Upload</button>
</form>
<p id="status" role="status"></p>
<script>
  const form = document.querySelector('form'), status = document.getElementById('status');
  form.onsubmit = (e) => {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async () => {
      form.querySelector('button').disabled = true;
      status.textContent = 'Mengupload...';
      try {
        const res = await fetch('', {
          method: 'POST',
          headers: { 'x-password': document.getElementById('pw').value },
          body: reader.result.split(',')[1], // base64 saja, tanpa prefix data:
        });
        status.textContent = await res.text();
      } catch {
        status.textContent = 'Gagal: koneksi bermasalah, coba lagi.';
      }
      form.querySelector('button').disabled = false;
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
