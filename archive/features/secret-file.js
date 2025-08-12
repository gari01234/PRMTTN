document.addEventListener("DOMContentLoaded", function() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadStatus = document.getElementById('uploadStatus');
  const jwkOutput = document.getElementById('jwkOutput');
  const cidOutput = document.getElementById('cidOutput');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#888";
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#ccc";
  });
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#ccc";
    if (e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleFile(e.target.files[0]);
    }
  });
  async function handleFile(file) {
    uploadStatus.textContent = "Cifrando archivo…";
    jwkOutput.textContent = "";
    cidOutput.textContent = "";
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await file.arrayBuffer());
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    const exportedKey = await crypto.subtle.exportKey("jwk", key);
    jwkOutput.textContent = " Clave secreta (guárdala para descifrar): " + JSON.stringify(exportedKey);
    const ivHex = Array.from(iv).map(x=>x.toString(16).padStart(2,"0")).join("");
    jwkOutput.textContent += "\n IV usado: " + ivHex;

    const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.byteLength);
    const encryptedBlob = new Blob([combined], { type: file.type });

    uploadStatus.textContent = "Subiendo a Bundlr (requiere wallet conectada)…";
    try {
      if (!window.bundlr) {
        uploadStatus.textContent = "Bundlr no está listo aún o la wallet no está conectada";
        return;
      }
      const tx = await window.bundlr.upload(encryptedBlob, {
        tags: [{ name: "Content-Type", value: file.type }]
      });
      uploadStatus.textContent = " Subida exitosa";
      window.lastUploadedTxId = tx.id;
      cidOutput.textContent = "CID (Arweave/Bundlr): " + tx.id;
    } catch (err) {
      uploadStatus.textContent = " Error subiendo a Bundlr: " + err.message;
    }
  }
});
