/**
 * Smart Image Resizer - App Logic
 * Features: Multi-file drag & drop, ratio selection (1:1, 3:4, 4:3, 9:16, 16:9, Custom),
 * padding vs crop mode, color picker, real-time progress bars, individual download, batch ZIP export.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const btnSelectFiles = document.getElementById('btnSelectFiles');
  
  const ratioButtons = document.querySelectorAll('.ratio-btn');
  const customRatioInputs = document.getElementById('customRatioInputs');
  const customWidthInput = document.getElementById('customWidth');
  const customHeightInput = document.getElementById('customHeight');
  
  const modePadding = document.getElementById('modePadding');
  const modeCrop = document.getElementById('modeCrop');
  const modePaddingLabel = document.getElementById('modePaddingLabel');
  const modeCropLabel = document.getElementById('modeCropLabel');
  const paddingColorGroup = document.getElementById('paddingColorGroup');
  const bgColorPicker = document.getElementById('bgColorPicker');
  const colorCodeText = document.getElementById('colorCodeText');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  
  const maxDimensionSelect = document.getElementById('maxDimensionSelect');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnStartProcess = document.getElementById('btnStartProcess');
  
  const queueSection = document.getElementById('queueSection');
  const queueList = document.getElementById('queueList');
  const totalCountEl = document.getElementById('totalCount');
  const overallStatusText = document.getElementById('overallStatusText');
  const totalProgressFill = document.getElementById('totalProgressFill');
  const totalProgressPercent = document.getElementById('totalProgressPercent');
  const btnDownloadZip = document.getElementById('btnDownloadZip');

  // State Variables
  let queueFiles = []; // Array of file objects with processing metadata
  let selectedRatio = '1:1'; // '1:1', '3:4', '4:3', '9:16', '16:9', or 'custom'
  let selectedMode = 'padding'; // 'padding' or 'crop'
  let isProcessing = false;

  // --- 1. Event Listeners for Upload & Drag-and-Drop ---
  btnSelectFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset input
  });

  // Handle selected image files
  function handleFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('이미지 파일만 업로드할 수 있습니다 (PNG, JPG, WEBP 등).');
      return;
    }

    validFiles.forEach(file => {
      const id = 'img_' + Math.random().toString(36).substr(2, 9);
      const item = {
        id,
        file,
        name: file.name,
        size: formatBytes(file.size),
        status: 'pending', // 'pending', 'processing', 'complete', 'error'
        progress: 0,
        originalImg: null,
        processedBlob: null,
        processedUrl: null,
        outputFileName: generateOutputFileName(file.name)
      };

      queueFiles.push(item);
      loadOriginalImage(item);
    });

    renderQueue();
  }

  // Helper: Format Bytes
  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Helper: Output file naming
  function generateOutputFileName(origName) {
    const dotIdx = origName.lastIndexOf('.');
    if (dotIdx === -1) return `${origName}_resized.jpg`;
    const base = origName.substring(0, dotIdx);
    const ext = origName.substring(dotIdx);
    return `${base}_resized${ext}`;
  }

  // Load Image Object to get original dimensions
  function loadOriginalImage(item) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        item.originalImg = img;
        item.origWidth = img.naturalWidth;
        item.origHeight = img.naturalHeight;
        updateItemDOM(item);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(item.file);
  }

  // --- 2. Ratio & Option Controls ---
  ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRatio = btn.dataset.ratio;

      if (selectedRatio === 'custom') {
        customRatioInputs.classList.remove('hidden');
      } else {
        customRatioInputs.classList.add('hidden');
      }
      
      // Reset process state if ratio changes
      resetProcessedState();
    });
  });

  [customWidthInput, customHeightInput].forEach(input => {
    input.addEventListener('input', () => {
      resetProcessedState();
    });
  });

  // Mode Selection Toggle
  modePadding.addEventListener('change', () => {
    if (modePadding.checked) {
      selectedMode = 'padding';
      modePaddingLabel.classList.add('active');
      modeCropLabel.classList.remove('active');
      paddingColorGroup.style.display = 'flex';
      resetProcessedState();
    }
  });

  modeCrop.addEventListener('change', () => {
    if (modeCrop.checked) {
      selectedMode = 'crop';
      modeCropLabel.classList.add('active');
      modePaddingLabel.classList.remove('active');
      paddingColorGroup.style.display = 'none';
      resetProcessedState();
    }
  });

  // Color Picker & Quick Swatches
  bgColorPicker.addEventListener('input', (e) => {
    colorCodeText.textContent = e.target.value.toUpperCase();
    resetProcessedState();
  });

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      bgColorPicker.value = color;
      colorCodeText.textContent = color.toUpperCase();
      resetProcessedState();
    });
  });

  maxDimensionSelect.addEventListener('change', () => {
    resetProcessedState();
  });

  // Clear All
  btnClearAll.addEventListener('click', () => {
    if (queueFiles.length === 0) return;
    if (confirm('목록의 모든 이미지를 삭제하시겠습니까?')) {
      queueFiles.forEach(item => {
        if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
      });
      queueFiles = [];
      renderQueue();
    }
  });

  function resetProcessedState() {
    queueFiles.forEach(item => {
      item.status = 'pending';
      item.progress = 0;
      if (item.processedUrl) {
        URL.revokeObjectURL(item.processedUrl);
        item.processedUrl = null;
      }
      item.processedBlob = null;
    });
    renderQueue();
  }

  // --- 3. Calculate Target Canvas Dimensions ---
  function getTargetDimensions(origWidth, origHeight) {
    let ratioW = 1;
    let ratioH = 1;

    if (selectedRatio === '1:1') { ratioW = 1; ratioH = 1; }
    else if (selectedRatio === '3:4') { ratioW = 3; ratioH = 4; }
    else if (selectedRatio === '4:3') { ratioW = 4; ratioH = 3; }
    else if (selectedRatio === '9:16') { ratioW = 9; ratioH = 16; }
    else if (selectedRatio === '16:9') { ratioW = 16; ratioH = 9; }
    else if (selectedRatio === 'custom') {
      ratioW = parseFloat(customWidthInput.value) || 1;
      ratioH = parseFloat(customHeightInput.value) || 1;
    }

    const maxDimSetting = maxDimensionSelect.value;
    let baseDimension;

    if (maxDimSetting === 'original') {
      baseDimension = Math.max(origWidth, origHeight);
    } else {
      baseDimension = parseInt(maxDimSetting, 10) || 1920;
    }

    let targetW, targetH;
    if (ratioW >= ratioH) {
      targetW = baseDimension;
      targetH = Math.round(baseDimension * (ratioH / ratioW));
    } else {
      targetH = baseDimension;
      targetW = Math.round(baseDimension * (ratioW / ratioH));
    }

    return { targetW, targetH };
  }

  // --- 4. Render Queue List ---
  function renderQueue() {
    if (queueFiles.length === 0) {
      queueSection.classList.add('hidden');
      btnDownloadZip.disabled = true;
      return;
    }

    queueSection.classList.remove('hidden');
    totalCountEl.textContent = queueFiles.length;
    queueList.innerHTML = '';

    queueFiles.forEach(item => {
      const itemEl = createQueueItemDOM(item);
      queueList.appendChild(itemEl);
    });

    updateGlobalStatus();
  }

  function createQueueItemDOM(item) {
    const itemEl = document.createElement('div');
    itemEl.className = `queue-item ${item.status === 'complete' ? 'complete' : ''}`;
    itemEl.id = item.id;

    const { targetW, targetH } = (item.origWidth && item.origHeight)
      ? getTargetDimensions(item.origWidth, item.origHeight)
      : { targetW: '...', targetH: '...' };

    itemEl.innerHTML = `
      <div class="item-thumb-box">
        <img class="item-thumb-img" src="${item.processedUrl || (item.originalImg ? item.originalImg.src : '')}" alt="${item.name}">
      </div>

      <div class="item-info">
        <div class="item-title-row">
          <span class="item-name" title="${item.name}">${item.name}</span>
          <button type="button" class="btn-item-remove" title="삭제" data-id="${item.id}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="item-meta">
          <span>원본: ${item.origWidth ? item.origWidth + '×' + item.origHeight + 'px' : '로딩중...'} (${item.size})</span>
          <span class="item-dim-badge">목표: ${targetW}×${targetH}px</span>
        </div>

        <!-- Real-time Progress Bar -->
        <div class="item-progress-container">
          <div class="item-progress-bar">
            <div class="item-progress-fill" style="width: ${item.progress}%;"></div>
          </div>
          <span class="item-progress-val">${item.progress}%</span>
        </div>
      </div>

      <!-- Individual Download Button (Req #10) -->
      <button type="button" class="btn btn-primary btn-item-download" id="dl_${item.id}" ${item.status === 'complete' ? '' : 'disabled'}>
        <i class="fa-solid fa-download"></i> 다운로드
      </button>
    `;

    // Event listeners
    const removeBtn = itemEl.querySelector('.btn-item-remove');
    removeBtn.addEventListener('click', () => {
      removeItem(item.id);
    });

    const downloadBtn = itemEl.querySelector('.btn-item-download');
    downloadBtn.addEventListener('click', () => {
      if (item.processedBlob) {
        triggerDownload(item.processedBlob, item.outputFileName);
      }
    });

    return itemEl;
  }

  function updateItemDOM(item) {
    const itemEl = document.getElementById(item.id);
    if (!itemEl) return;

    // Update thumbnail if available
    const thumbImg = itemEl.querySelector('.item-thumb-img');
    if (thumbImg && item.originalImg && !item.processedUrl) {
      thumbImg.src = item.originalImg.src;
    }

    const { targetW, targetH } = getTargetDimensions(item.origWidth, item.origHeight);
    const metaEl = itemEl.querySelector('.item-meta');
    if (metaEl) {
      metaEl.innerHTML = `
        <span>원본: ${item.origWidth}×${item.origHeight}px (${item.size})</span>
        <span class="item-dim-badge">목표: ${targetW}×${targetH}px</span>
      `;
    }

    // Update progress bar
    const progressFill = itemEl.querySelector('.item-progress-fill');
    const progressVal = itemEl.querySelector('.item-progress-val');
    const dlBtn = itemEl.querySelector('.btn-item-download');

    if (progressFill) progressFill.style.width = `${item.progress}%`;
    if (progressVal) progressVal.textContent = `${item.progress}%`;

    if (item.status === 'complete') {
      itemEl.classList.add('complete');
      if (dlBtn) dlBtn.disabled = false;
      if (thumbImg && item.processedUrl) thumbImg.src = item.processedUrl;
    } else {
      itemEl.classList.remove('complete');
      if (dlBtn) dlBtn.disabled = true;
    }
  }

  function removeItem(id) {
    const idx = queueFiles.findIndex(f => f.id === id);
    if (idx !== -1) {
      if (queueFiles[idx].processedUrl) {
        URL.revokeObjectURL(queueFiles[idx].processedUrl);
      }
      queueFiles.splice(idx, 1);
      renderQueue();
    }
  }

  // Global status update
  function updateGlobalStatus() {
    const completedCount = queueFiles.filter(f => f.status === 'complete').length;
    const total = queueFiles.length;
    
    const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    totalProgressFill.style.width = `${percent}%`;
    totalProgressPercent.textContent = `${percent}%`;

    if (completedCount === total && total > 0) {
      overallStatusText.textContent = '모든 변환 완료!';
      overallStatusText.style.color = 'var(--success)';
      btnDownloadZip.disabled = false; // Req #11
    } else if (isProcessing) {
      overallStatusText.textContent = `변환 진행 중 (${completedCount}/${total})`;
      overallStatusText.style.color = 'var(--primary)';
      btnDownloadZip.disabled = true;
    } else {
      overallStatusText.textContent = `${completedCount}/${total} 완료`;
      overallStatusText.style.color = 'var(--text-muted)';
      btnDownloadZip.disabled = (completedCount === 0);
    }
  }

  // --- 5. Image Resizing Engine (Canvas) ---
  btnStartProcess.addEventListener('click', startBatchProcessing);

  async function startBatchProcessing() {
    if (queueFiles.length === 0) {
      alert('변환할 이미지를 먼저 선택하세요.');
      return;
    }

    isProcessing = true;
    btnStartProcess.disabled = true;
    btnDownloadZip.disabled = true;

    for (let i = 0; i < queueFiles.length; i++) {
      const item = queueFiles[i];
      if (item.status !== 'complete') {
        await processSingleItem(item);
      }
    }

    isProcessing = false;
    btnStartProcess.disabled = false;
    updateGlobalStatus();
  }

  function processSingleItem(item) {
    return new Promise((resolve) => {
      item.status = 'processing';
      item.progress = 10;
      updateItemDOM(item);
      updateGlobalStatus();

      // Ensure original image object is loaded
      if (!item.originalImg) {
        const img = new Image();
        img.onload = () => {
          item.originalImg = img;
          item.origWidth = img.naturalWidth;
          item.origHeight = img.naturalHeight;
          runCanvasRender(item, resolve);
        };
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(item.file);
      } else {
        runCanvasRender(item, resolve);
      }
    });
  }

  function runCanvasRender(item, resolve) {
    const { targetW, targetH } = getTargetDimensions(item.origWidth, item.origHeight);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Smooth progress animation frames
    let currentProgress = 20;
    const progressInterval = setInterval(() => {
      if (currentProgress < 85) {
        currentProgress += 15;
        item.progress = currentProgress;
        updateItemDOM(item);
      }
    }, 50);

    setTimeout(() => {
      const img = item.originalImg;
      const imgW = item.origWidth;
      const imgH = item.origHeight;

      if (selectedMode === 'padding') {
        // --- 6. Padding Mode ---
        // Fill canvas background with selected color
        ctx.fillStyle = bgColorPicker.value || '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);

        // Fit image preserving aspect ratio inside targetW x targetH
        const scale = Math.min(targetW / imgW, targetH / imgH);
        const dw = imgW * scale;
        const dh = imgH * scale;
        const dx = (targetW - dw) / 2;
        const dy = (targetH - dh) / 2;

        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        // --- 7. Crop Mode ---
        // Cover canvas preserving aspect ratio (crop center)
        const scale = Math.max(targetW / imgW, targetH / imgH);
        const sw = targetW / scale;
        const sh = targetH / scale;
        const sx = (imgW - sw) / 2;
        const sy = (imgH - sh) / 2;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      }

      // Export canvas to Blob
      const mimeType = item.file.type || 'image/jpeg';
      canvas.toBlob((blob) => {
        clearInterval(progressInterval);
        
        item.processedBlob = blob;
        if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
        item.processedUrl = URL.createObjectURL(blob);
        
        item.progress = 100;
        item.status = 'complete';
        
        updateItemDOM(item);
        updateGlobalStatus();
        resolve();
      }, mimeType, 0.92);
    }, 150); // Minor async delay for visual progress feedback
  }

  // Download Trigger helper
  function triggerDownload(blob, fileName) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // --- 8. Batch ZIP Download (Req #11) ---
  btnDownloadZip.addEventListener('click', async () => {
    const completedItems = queueFiles.filter(item => item.status === 'complete' && item.processedBlob);
    if (completedItems.length === 0) {
      alert('다운로드할 변환 완료 이미지가 없습니다.');
      return;
    }

    if (typeof JSZip === 'undefined') {
      alert('ZIP 라이브러리를 로드할 수 없습니다. 개별 다운로드 버튼을 이용해주세요.');
      return;
    }

    btnDownloadZip.disabled = true;
    btnDownloadZip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 압축 생성 중...';

    try {
      const zip = new JSZip();
      const folder = zip.folder('resized_images');

      completedItems.forEach((item, index) => {
        // Avoid duplicate names in zip
        let fileName = item.outputFileName;
        folder.file(fileName, item.processedBlob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      triggerDownload(content, 'Smart_Resized_Images.zip');
    } catch (err) {
      console.error('ZIP generation error:', err);
      alert('ZIP 압축 중 오류가 발생했습니다.');
    } finally {
      btnDownloadZip.disabled = false;
      btnDownloadZip.innerHTML = '<i class="fa-solid fa-file-zipper"></i> 일괄 다운로드 (.ZIP)';
    }
  });

});
