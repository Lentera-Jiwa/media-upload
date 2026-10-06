/*
 * GANTI nilai API_URL di bawah dengan URL Web App Google Apps Script.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxkf9Ts_HOQieWmnL7ZJABDj-Nwk6UHfMqbGowHbF4ack5EUZ4nRpIFL7fTIFSsuzE9yg/exec";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const els = {
  uploadForm: document.getElementById("uploadForm"),
  visitor: document.getElementById("visitor"),
  type: document.getElementById("type"),
  file: document.getElementById("file"),
  customName: document.getElementById("customName"),
  fileInfo: document.getElementById("fileInfo"),
  uploadBtn: document.getElementById("uploadBtn"),
  progressWrap: document.getElementById("progressWrap"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  uploadResult: document.getElementById("uploadResult"),
  searchMode: document.getElementById("searchMode"),
  searchQuery: document.getElementById("searchQuery"),
  searchBtn: document.getElementById("searchBtn"),
  searchResult: document.getElementById("searchResult"),
  refreshBtn: document.getElementById("refreshBtn"),
  recentResult: document.getElementById("recentResult")
};

const extensions = {
  gambar: [".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg"],
  video: [".mp4",".webm",".mov",".m4v",".avi"],
  audio: [".mp3",".wav",".ogg",".m4a",".aac",".flac"]
};

els.type.addEventListener("change", () => {
  els.file.disabled = !els.type.value;
  els.file.value = "";
  els.fileInfo.classList.add("hidden");
  if (els.type.value) {
    els.file.accept = extensions[els.type.value].join(",");
  } else {
    els.file.removeAttribute("accept");
  }
});

els.file.addEventListener("change", () => {
  const file = els.file.files[0];
  if (!file) return;
  const size = formatBytes(file.size);
  els.fileInfo.textContent = `${file.name} • ${size}`;
  els.fileInfo.classList.remove("hidden");

  if (file.size > MAX_FILE_BYTES) {
    els.fileInfo.textContent += " • FILE TERLALU BESAR (maks. 25 MB)";
    els.fileInfo.style.color = "#b91c1c";
  } else {
    els.fileInfo.style.color = "";
  }
});

els.uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearResult(els.uploadResult);

  if (API_URL.includes("GANTI_DENGAN")) {
    showResult(els.uploadResult, "error", "URL Apps Script belum diisi di app.js.");
    return;
  }

  const file = els.file.files[0];
  const visitor = els.visitor.value.trim();
  const type = els.type.value;

  if (!visitor) return showResult(els.uploadResult,"error","Nama pengunjung wajib diisi.");
  if (!type) return showResult(els.uploadResult,"error","Pilih jenis file.");
  if (!file) return showResult(els.uploadResult,"error","Pilih file.");
  if (file.size > MAX_FILE_BYTES) {
    return showResult(els.uploadResult,"error","File lebih dari 25 MB. Upload dibatalkan.");
  }

  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (!extensions[type].includes(ext)) {
    return showResult(els.uploadResult,"error","Ekstensi file tidak sesuai dengan jenis yang dipilih.");
  }

  setBusy(true);
  setProgress(5, "Membaca file...");

  try {
    const base64 = await fileToBase64(file);
    setProgress(35, "Menyiapkan data...");
    setProgress(55, "Mengirim file ke GitHub...");

    const payload = {
      action: "upload",
      visitor,
      type,
      originalName: file.name,
      customName: els.customName.value.trim(),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      base64
    };

    const result = await postJSON(payload);
    setProgress(100, "Selesai.");

    if (!result.success) throw new Error(result.message || "Upload gagal.");

    const d = result.data;
    els.uploadResult.innerHTML = `
      <div class="result success">
        <strong>✅ ${escapeHtml(result.message)}</strong>
        <div class="meta">
          Pengunjung: ${escapeHtml(d.visitor)}<br>
          Nama File: ${escapeHtml(d.name)}<br>
          Jenis: ${escapeHtml(d.type)}<br>
          Ukuran: ${escapeHtml(String(d.sizeMB))} MB
        </div>
        <div class="raw">
          <input readonly value="${escapeAttr(d.rawUrl)}" id="lastRaw">
          <button class="secondary" type="button" onclick="copyText('${escapeJs(d.rawUrl)}', this)">📋 Copy Link Raw</button>
        </div>
      </div>`;
    els.uploadForm.reset();
    els.file.disabled = true;
    els.fileInfo.classList.add("hidden");
    loadRecent();
  } catch (err) {
    showResult(els.uploadResult, "error", err.message || "Terjadi kesalahan.");
  } finally {
    setBusy(false);
    setTimeout(() => els.progressWrap.classList.add("hidden"), 1000);
  }
});

els.searchBtn.addEventListener("click", searchFiles);
els.searchQuery.addEventListener("keydown", e => {
  if (e.key === "Enter") searchFiles();
});
els.refreshBtn.addEventListener("click", loadRecent);

async function searchFiles() {
  const q = els.searchQuery.value.trim();
  if (!q) {
    showResult(els.searchResult,"error","Masukkan kata pencarian.");
    return;
  }

  els.searchResult.innerHTML = `<div class="result">Mencari...</div>`;
  try {
    const result = await postJSON({
      action:"search",
      mode:els.searchMode.value,
      query:q
    });
    if (!result.success) throw new Error(result.message);
    renderItems(els.searchResult, result.results, els.searchMode.value === "visitor");
  } catch (err) {
    showResult(els.searchResult,"error",err.message || "Pencarian gagal.");
  }
}

async function loadRecent() {
  els.recentResult.innerHTML = `<div class="result">Memuat...</div>`;
  try {
    const result = await postJSON({action:"list",limit:20});
    if (!result.success) throw new Error(result.message);
    renderItems(els.recentResult, result.results, false);
  } catch (err) {
    showResult(els.recentResult,"error",err.message || "Gagal memuat file.");
  }
}

function renderItems(container, items, canDelete) {
  if (!items.length) {
    container.innerHTML = `<div class="result">Tidak ada file ditemukan.</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <div class="meta">
            👤 ${escapeHtml(item.visitor)}<br>
            📁 ${escapeHtml(item.type)} • ${escapeHtml(String(item.sizeMB))} MB
          </div>
        </div>
      </div>
      <div class="raw">
        <input readonly value="${escapeAttr(item.rawUrl)}">
        <button class="secondary" type="button" onclick="copyText('${escapeJs(item.rawUrl)}', this)">📋 Copy Raw</button>
      </div>
      ${canDelete ? `
        <div class="actions">
          <button class="danger" type="button" onclick="deleteFile('${escapeJs(item.id)}','${escapeJs(item.name)}')">🗑️ Hapus File</button>
        </div>` : ""}
    </div>
  `).join("");
}

async function deleteFile(id, name) {
  const pin = prompt(`Masukkan PIN admin untuk menghapus:\n${name}`);
  if (pin === null) return;

  if (!pin) {
    alert("PIN wajib diisi.");
    return;
  }

  if (!confirm(`Yakin ingin menghapus "${name}" dari GitHub dan Spreadsheet?`)) return;

  try {
    const result = await postJSON({
      action:"delete",
      id:id,
      pin:pin
    });

    if (!result.success) throw new Error(result.message);
    alert("File berhasil dihapus.");
    searchFiles();
    loadRecent();
  } catch (err) {
    alert(err.message || "Penghapusan gagal.");
  }
}

async function postJSON(payload) {
  const response = await fetch(API_URL, {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch(e) { throw new Error("Respons server bukan JSON. Periksa deployment Apps Script dan akses Web App."); }

  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

function setBusy(busy) {
  els.uploadBtn.disabled = busy;
  els.uploadBtn.textContent = busy ? "⏳ Mengupload..." : "⬆️ Upload & Kirim Link Raw";
}

function setProgress(percent, text) {
  els.progressWrap.classList.remove("hidden");
  els.progressBar.style.width = percent + "%";
  els.progressText.textContent = text;
}

function showResult(el, cls, message) {
  el.innerHTML = `<div class="result ${cls}">${escapeHtml(message)}</div>`;
}

function clearResult(el) { el.innerHTML = ""; }

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch(e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const old = button.textContent;
  button.textContent = "✅ Tersalin";
  setTimeout(() => button.textContent = old, 1400);
}

function formatBytes(bytes) {
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/(1024*1024)).toFixed(2) + " MB";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function escapeJs(s) {
  return String(s ?? "").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\r/g,"\\r").replace(/\n/g,"\\n");
}

loadRecent();
