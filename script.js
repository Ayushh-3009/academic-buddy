/**
 * ACADEMIC BUDDY - CLIENT ENGINE (STAGE 1 FULL STACK)
 * Live Gemini SSE streaming, conversation management, KaTeX math & Markdown rendering,
 * code copy, safety reporting, authentication, and interactive study widgets.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. STATE & AUTH STORAGE
  // ------------------------------------------------------------------------
  const AUTH_TOKEN_KEY = 'ab-auth-token';
  const GUEST_ID_KEY = 'ab-guest-id';

  let currentAuthToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
  let currentGuestId = localStorage.getItem(GUEST_ID_KEY);
  if (!currentGuestId) {
    currentGuestId = 'guest_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(GUEST_ID_KEY, currentGuestId);
  }

  let activeConversationId = null;
  let activeStudyMode = 'learn';
  let activeExplainLevel = 'off';
  let isGenerating = false;
  let streamAbortController = null;
  let lastUserPrompt = '';

  // Helper for authenticated API calls
  function getApiHeaders(extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Guest-Id': currentGuestId,
      ...extraHeaders,
    };
    if (currentAuthToken) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }
    return headers;
  }

  // ------------------------------------------------------------------------
  // 2. THEME TOGGLING (LIGHT & LATE-NIGHT STUDY MODES)
  // ------------------------------------------------------------------------
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const storedTheme = localStorage.getItem('ab-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const currentTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', currentTheme);

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ab-theme', theme);
    showToast(theme === 'dark' ? '🌙 Late-Night Study mode activated' : '☀️ Daybreak Study mode activated');
  }

  themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme');
      const nextTheme = active === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  });

  // ------------------------------------------------------------------------
  // 3. NAVBAR STICKY SHADOW & MOBILE NAVIGATION DRAWER
  // ------------------------------------------------------------------------
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  });

  const mobileToggleBtn = document.querySelector('.mobile-toggle-btn');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');

  if (mobileToggleBtn && mobileNavDrawer) {
    mobileToggleBtn.addEventListener('click', () => {
      const isOpen = mobileNavDrawer.classList.toggle('open');
      mobileToggleBtn.setAttribute('aria-expanded', isOpen.toString());
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    const mobileLinks = mobileNavDrawer.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // ------------------------------------------------------------------------
  // 4. TOAST NOTIFICATIONS
  // ------------------------------------------------------------------------
  const toastContainer = document.getElementById('toast-container');
  window.showToast = function(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  };

  // ------------------------------------------------------------------------
  // 5. MARKDOWN & KATEX RENDERING HELPERS
  // ------------------------------------------------------------------------
  function renderMarkdownAndMath(containerElement, rawText) {
    if (!containerElement) return;

    // 1. Render Markdown with marked.js
    if (typeof marked !== 'undefined' && marked.parse) {
      containerElement.innerHTML = marked.parse(rawText);
    } else {
      containerElement.innerText = rawText;
    }

    // 2. Render Math with KaTeX
    if (typeof renderMathInElement !== 'undefined') {
      try {
        renderMathInElement(containerElement, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
        });
      } catch (mathErr) {
        console.warn('KaTeX math render note:', mathErr);
      }
    }

    // 3. Inject "Copy Code" buttons on code blocks
    const codeBlocks = containerElement.querySelectorAll('pre code');
    codeBlocks.forEach(code => {
      const pre = code.parentElement;
      if (pre && !pre.closest('.code-block-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        // Detect language class
        const classNames = code.className || '';
        const langMatch = classNames.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';

        const headerBar = document.createElement('div');
        headerBar.className = 'code-header-bar';
        headerBar.innerHTML = `
          <span>${lang}</span>
          <button class="btn-copy-code" type="button" title="Copy code">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        `;

        const copyBtn = headerBar.querySelector('.btn-copy-code');
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(code.innerText).then(() => {
            copyBtn.innerHTML = `<span>✓ Copied!</span>`;
            setTimeout(() => {
              copyBtn.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy</span>
              `;
            }, 2000);
          });
        });

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(headerBar);
        wrapper.appendChild(pre);
      }
    });
  }

  // ------------------------------------------------------------------------
  // 6. LIVE AI TUTOR CHAT STUDIO (STREAMING & CONVERSATIONS)
  // ------------------------------------------------------------------------
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatForm = document.getElementById('studio-chat-form');
  const chatInput = document.getElementById('studio-user-input');
  const charCounter = document.getElementById('char-counter');
  const typingIndicator = document.getElementById('studio-typing-indicator');
  const stopStreamBtn = document.getElementById('btn-stop-stream');
  const retryStreamBtn = document.getElementById('btn-retry-stream');
  const modeSelect = document.getElementById('active-study-mode-select');
  const explainSelect = document.getElementById('active-explain-level-select');
  const studioSidebar = document.getElementById('studio-sidebar');
  const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
  const closeSidebarBtn = document.getElementById('btn-close-sidebar');
  const newChatBtn = document.getElementById('btn-new-chat-session');
  const conversationsListContainer = document.getElementById('conversations-list-container');
  const chatsCountBadge = document.getElementById('chats-count-badge');

  // Input auto-resize & char count
  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    const len = chatInput.value.length;
    if (charCounter) charCounter.textContent = `${len} / 3000`;
  });

  // Enter to send (Shift+Enter for newline)
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm?.dispatchEvent(new Event('submit'));
    }
  });

  // Sync mode and explain level
  modeSelect?.addEventListener('change', (e) => {
    activeStudyMode = e.target.value;
    showToast(`Mode switched to: ${modeSelect.options[modeSelect.selectedIndex].text}`);
  });

  explainSelect?.addEventListener('change', (e) => {
    activeExplainLevel = e.target.value;
    showToast(`Depth set to: ${explainSelect.options[explainSelect.selectedIndex].text}`);
  });

  // Sidebar toggle
  toggleSidebarBtn?.addEventListener('click', () => {
    studioSidebar?.classList.toggle('collapsed');
    studioSidebar?.classList.toggle('open');
  });

  closeSidebarBtn?.addEventListener('click', () => {
    studioSidebar?.classList.add('collapsed');
    studioSidebar?.classList.remove('open');
  });

  // Start fresh chat session
  newChatBtn?.addEventListener('click', () => {
    activeConversationId = null;
    if (chatMessagesContainer) {
      chatMessagesContainer.innerHTML = `
        <div class="chat-msg msg-studi" data-message-id="fresh-msg">
          <div class="msg-header">
            <div class="msg-author-info">
              <span class="msg-avatar-icon">☕</span>
              <strong>Studi</strong>
              <span class="badge-mini">AI Tutor</span>
            </div>
            <div class="msg-actions">
              <button class="btn-msg-action" title="Report response" onclick="openReportModal('fresh-msg')">🚩</button>
            </div>
          </div>
          <div class="msg-content">
            <p>Ready for a fresh study session! What topic, problem, or lecture notes would you like to explore?</p>
          </div>
        </div>
      `;
    }
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    showToast('✨ Fresh study session ready.');
    if (studioQuickChips) studioQuickChips.style.display = 'flex';
    chatInput?.focus();
  });

  // Quick prompt chips & close tab handler
  const studioQuickChips = document.getElementById('studio-quick-chips');
  const btnCloseQuickChips = document.getElementById('btn-close-quick-chips');

  btnCloseQuickChips?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (studioQuickChips) {
      studioQuickChips.style.display = 'none';
      showToast('✕ Suggested topics tab closed.');
    }
  });

  document.querySelectorAll('.studio-quick-chips .demo-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (chatInput && promptText) {
        chatInput.value = promptText;
        chatInput.dispatchEvent(new Event('input'));
        chatForm?.dispatchEvent(new Event('submit'));
      }
    });
  });

  // ------------------------------------------------------------------------
  // STUDY WINDOW & FULLSCREEN CONTROLS
  // ------------------------------------------------------------------------
  const activeModeBadge = document.getElementById('active-mode-badge');
  const studyWindowOverlay = document.getElementById('study-window-overlay');
  const studyWindowCard = document.getElementById('study-window-card');
  const toggleFullscreenBtn = document.getElementById('btn-toggle-fullscreen');
  const closeStudyWindowBtn = document.getElementById('btn-close-study-window');
  const winDotClose = document.getElementById('btn-win-dot-close');
  const winDotMin = document.getElementById('btn-win-dot-min');
  const winDotMax = document.getElementById('btn-win-dot-max');

  // ------------------------------------------------------------------------
  // CUSTOM DROPDOWNS (MODE & DEPTH)
  // ------------------------------------------------------------------------
  const modeDropdown = document.getElementById('mode-custom-dropdown');
  const btnModeTrigger = document.getElementById('btn-mode-trigger');
  const modeCurrentVal = document.getElementById('mode-current-val');
  const modeItems = document.querySelectorAll('#mode-menu-list .dropdown-item');

  const depthDropdown = document.getElementById('depth-custom-dropdown');
  const btnDepthTrigger = document.getElementById('btn-depth-trigger');
  const depthCurrentVal = document.getElementById('depth-current-val');
  const depthItems = document.querySelectorAll('#depth-menu-list .dropdown-item');

  function closeAllDropdowns() {
    modeDropdown?.classList.remove('open');
    btnModeTrigger?.setAttribute('aria-expanded', 'false');
    depthDropdown?.classList.remove('open');
    btnDepthTrigger?.setAttribute('aria-expanded', 'false');
  }

  // Toggle Mode Dropdown
  btnModeTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = modeDropdown?.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      modeDropdown?.classList.add('open');
      btnModeTrigger?.setAttribute('aria-expanded', 'true');
    }
  });

  // Mode Items click
  modeItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-value');
      const title = item.querySelector('.dropdown-item-title')?.textContent.trim();
      const icon = item.querySelector('.dropdown-item-icon')?.textContent.trim();
      
      modeItems.forEach(i => {
        const isSelected = i === item;
        i.classList.toggle('active', isSelected);
        i.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });

      if (modeCurrentVal) modeCurrentVal.textContent = `${icon} ${title}`;
      if (modeSelect) {
        modeSelect.value = val;
        modeSelect.dispatchEvent(new Event('change'));
      }
      closeAllDropdowns();
    });
  });

  // Toggle Depth Dropdown
  btnDepthTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = depthDropdown?.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      depthDropdown?.classList.add('open');
      btnDepthTrigger?.setAttribute('aria-expanded', 'true');
    }
  });

  // Depth Items click
  depthItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-value');
      const title = item.querySelector('.dropdown-item-title')?.textContent.trim();
      
      depthItems.forEach(i => {
        const isSelected = i === item;
        i.classList.toggle('active', isSelected);
        i.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });

      if (depthCurrentVal) depthCurrentVal.textContent = title;
      if (explainSelect) {
        explainSelect.value = val;
        explainSelect.dispatchEvent(new Event('change'));
      }
      closeAllDropdowns();
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
      closeAllDropdowns();
    }
  });

  // Sync helper when select is changed programmatically
  function syncCustomDropdowns() {
    if (modeSelect) {
      const currentVal = modeSelect.value;
      modeItems.forEach(item => {
        const match = item.getAttribute('data-value') === currentVal;
        item.classList.toggle('active', match);
        item.setAttribute('aria-selected', match ? 'true' : 'false');
        if (match && modeCurrentVal) {
          const title = item.querySelector('.dropdown-item-title')?.textContent.trim();
          const icon = item.querySelector('.dropdown-item-icon')?.textContent.trim();
          modeCurrentVal.textContent = `${icon} ${title}`;
        }
      });
    }

    if (explainSelect) {
      const currentVal = explainSelect.value;
      depthItems.forEach(item => {
        const match = item.getAttribute('data-value') === currentVal;
        item.classList.toggle('active', match);
        item.setAttribute('aria-selected', match ? 'true' : 'false');
        if (match && depthCurrentVal) {
          const title = item.querySelector('.dropdown-item-title')?.textContent.trim();
          depthCurrentVal.textContent = title;
        }
      });
    }
  }

  // Mode select change event
  modeSelect?.addEventListener('change', (e) => {
    activeStudyMode = e.target.value;
    if (activeModeBadge) activeModeBadge.textContent = activeStudyMode.toUpperCase();
    syncCustomDropdowns();
    showToast(`Mode switched to: ${modeSelect.options[modeSelect.selectedIndex]?.text || activeStudyMode}`);
  });

  explainSelect?.addEventListener('change', (e) => {
    activeExplainLevel = e.target.value;
    syncCustomDropdowns();
    showToast(`Depth set to: ${explainSelect.options[explainSelect.selectedIndex]?.text || activeExplainLevel}`);
  });

  function setFullscreenState(isFs) {
    if (!studyWindowCard || !studyWindowOverlay) return;
    const expandIcon = studyWindowOverlay.querySelector('.icon-expand');
    const compressIcon = studyWindowOverlay.querySelector('.icon-compress');
    const fsLabel = studyWindowOverlay.querySelector('.btn-fs-label');

    if (isFs) {
      studyWindowCard.classList.add('fullscreen-mode');
      if (expandIcon) expandIcon.style.display = 'none';
      if (compressIcon) compressIcon.style.display = 'inline';
      if (fsLabel) fsLabel.textContent = 'Exit Fullscreen';
    } else {
      studyWindowCard.classList.remove('fullscreen-mode');
      if (expandIcon) expandIcon.style.display = 'inline';
      if (compressIcon) compressIcon.style.display = 'none';
      if (fsLabel) fsLabel.textContent = 'Fullscreen';
    }
  }

  function openStudyWindow(fullscreen = false, initialPrompt = '', initialMode = null, autoSend = false, startFreshChat = false) {
    if (!studyWindowOverlay || !studyWindowCard) return;

    if (startFreshChat) {
      activeConversationId = null;
      if (chatMessagesContainer) {
        chatMessagesContainer.innerHTML = `
          <div class="chat-msg msg-studi" data-message-id="fresh-msg">
            <div class="msg-header">
              <span class="msg-author">Studi</span>
              <span class="msg-time">Just now</span>
            </div>
            <div class="msg-content">
              <p>Hey there! Ready to study this together? ☕</p>
            </div>
          </div>
        `;
      }
      document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    }

    if (initialMode && modeSelect) {
      modeSelect.value = initialMode;
      activeStudyMode = initialMode;
      if (activeModeBadge) activeModeBadge.textContent = initialMode.toUpperCase();
      syncCustomDropdowns();
    }

    studyWindowOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    setFullscreenState(fullscreen);

    if (chatInput) {
      if (initialPrompt) {
        chatInput.value = initialPrompt;
        chatInput.dispatchEvent(new Event('input'));
        if (autoSend) {
          setTimeout(() => {
            if (!isGenerating) {
              chatForm?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
          }, 350);
        }
      }
      setTimeout(() => chatInput.focus(), 150);
    }
  }

  function closeStudyWindow() {
    studyWindowOverlay?.classList.remove('open');
    studyWindowCard?.classList.remove('fullscreen-mode');
    document.body.style.overflow = '';
  }

  function toggleStudyFullscreen() {
    const isCurrentlyFs = studyWindowCard?.classList.contains('fullscreen-mode');
    setFullscreenState(!isCurrentlyFs);
  }

  // Window action buttons
  toggleFullscreenBtn?.addEventListener('click', toggleStudyFullscreen);
  closeStudyWindowBtn?.addEventListener('click', closeStudyWindow);
  winDotClose?.addEventListener('click', closeStudyWindow);
  winDotMin?.addEventListener('click', closeStudyWindow);
  winDotMax?.addEventListener('click', toggleStudyFullscreen);

  // Close when clicking backdrop in windowed mode
  studyWindowOverlay?.addEventListener('click', (e) => {
    if (e.target === studyWindowOverlay && !studyWindowCard?.classList.contains('fullscreen-mode')) {
      closeStudyWindow();
    }
  });

  // Floating dock button launcher
  document.getElementById('btn-floating-study-launcher')?.addEventListener('click', () => {
    openStudyWindow(false);
  });

  // Nav bar launcher
  document.getElementById('btn-nav-open-chat')?.addEventListener('click', (e) => {
    e.preventDefault();
    openStudyWindow(false);
  });

  // Mobile drawer launcher
  document.getElementById('btn-mobile-open-chat')?.addEventListener('click', (e) => {
    e.preventDefault();
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    mobileDrawer?.classList.remove('open');
    openStudyWindow(false);
  });

  // Hero section triggers
  document.getElementById('btn-hero-launch-chat')?.addEventListener('click', (e) => {
    e.preventDefault();
    openStudyWindow(false);
  });

  document.getElementById('hero-chat-card-launch')?.addEventListener('click', () => {
    openStudyWindow(false);
  });

  // Section 6 Studio Hub Launchpad buttons
  document.getElementById('btn-hub-open-window')?.addEventListener('click', () => {
    openStudyWindow(false);
  });

  document.getElementById('btn-hub-open-fullscreen')?.addEventListener('click', () => {
    openStudyWindow(true);
  });

  // Section 6 Hub mode cards
  document.querySelectorAll('.hub-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.getAttribute('data-mode');
      openStudyWindow(false, '', mode);
    });
  });

  // Section 6 Hub prompt pills
  document.querySelectorAll('.hub-prompt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const prompt = pill.getAttribute('data-prompt');
      const mode = pill.getAttribute('data-mode') || 'learn';
      openStudyWindow(false, prompt, mode);
    });
  });

  // Load user conversations list
  async function loadConversationsList() {
    if (!conversationsListContainer) return;
    try {
      const res = await fetch('/api/chat/conversations', {
        headers: getApiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.conversations || [];

      if (chatsCountBadge) chatsCountBadge.textContent = list.length.toString();

      if (list.length === 0) {
        conversationsListContainer.innerHTML = `
          <div class="empty-conversations-state">
            <span>No saved chats yet. Send a question to create your first session!</span>
          </div>
        `;
        return;
      }

      conversationsListContainer.innerHTML = '';
      list.forEach(conv => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conv.id === activeConversationId ? 'active' : ''}`;
        item.setAttribute('data-conv-id', conv.id);
        item.innerHTML = `
          <span class="conv-title" title="${conv.title}">${conv.title}</span>
          <div class="conv-actions">
            <button class="btn-icon-subtle btn-rename" title="Rename">✏️</button>
            <button class="btn-icon-subtle btn-delete" title="Delete">🗑️</button>
          </div>
        `;

        item.addEventListener('click', (e) => {
          if (e.target.closest('.conv-actions')) return;
          loadConversationMessages(conv.id);
        });

        // Rename
        item.querySelector('.btn-rename')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          const newTitle = prompt('Rename study session:', conv.title);
          if (newTitle && newTitle.trim()) {
            await fetch(`/api/chat/conversations/${conv.id}`, {
              method: 'PATCH',
              headers: getApiHeaders(),
              body: JSON.stringify({ title: newTitle }),
            });
            loadConversationsList();
          }
        });

        // Delete
        item.querySelector('.btn-delete')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${conv.title}"?`)) {
            await fetch(`/api/chat/conversations/${conv.id}`, {
              method: 'DELETE',
              headers: getApiHeaders(),
            });
            if (activeConversationId === conv.id) {
              newChatBtn?.click();
            }
            loadConversationsList();
          }
        });

        conversationsListContainer.appendChild(item);
      });
    } catch (err) {
      console.warn('Could not fetch conversations:', err);
    }
  }

  // Load a conversation's messages
  async function loadConversationMessages(convId) {
    if (!chatMessagesContainer) return;
    try {
      const res = await fetch(`/api/chat/conversations/${convId}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      activeConversationId = convId;

      // Update active selection in sidebar
      document.querySelectorAll('.conversation-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-conv-id') === convId);
      });

      // Update mode dropdown if set
      if (data.conversation?.study_mode && modeSelect) {
        modeSelect.value = data.conversation.study_mode;
        activeStudyMode = data.conversation.study_mode;
        if (activeModeBadge) activeModeBadge.textContent = activeStudyMode.toUpperCase();
        syncCustomDropdowns();
      }

      chatMessagesContainer.innerHTML = '';
      (data.messages || []).forEach(msg => {
        appendMessageBubble(msg.role, msg.content, msg.id);
      });

      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  }

  // Helper to append message bubbles
  function appendMessageBubble(role, content, messageId = null) {
    if (!chatMessagesContainer) return null;
    const msgDiv = document.createElement('div');
    const msgId = messageId || 'msg_' + Date.now();
    msgDiv.setAttribute('data-message-id', msgId);

    if (role === 'user') {
      msgDiv.className = 'chat-msg msg-student';
      msgDiv.innerHTML = `
        <div>${escapeHtml(content)}</div>
        <div class="msg-meta">You • Just now</div>
      `;
    } else {
      msgDiv.className = 'chat-msg msg-studi';
      msgDiv.innerHTML = `
        <div class="msg-header">
          <div class="msg-author-info">
            <span class="msg-avatar-icon">☕</span>
            <strong>Studi</strong>
            <span class="badge-mini">${activeStudyMode.toUpperCase()}</span>
          </div>
          <div class="msg-actions">
            <button class="btn-msg-action" title="Report response" onclick="openReportModal('${msgId}')">🚩</button>
          </div>
        </div>
        <div class="msg-content"></div>
      `;
      const contentTarget = msgDiv.querySelector('.msg-content');
      renderMarkdownAndMath(contentTarget, content);
    }

    chatMessagesContainer.appendChild(msgDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    return msgDiv;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Send message and stream response via SSE
  chatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isGenerating) return;

    const messageText = chatInput.value.trim();
    if (!messageText) return;

    lastUserPrompt = messageText;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    if (charCounter) charCounter.textContent = '0 / 3000';

    // 1. Render User Message Bubble
    appendMessageBubble('user', messageText);

    // 2. Prepare Assistant Bubble
    const assistantBubble = document.createElement('div');
    const assistantMsgId = 'stream_' + Date.now();
    assistantBubble.className = 'chat-msg msg-studi';
    assistantBubble.setAttribute('data-message-id', assistantMsgId);
    assistantBubble.innerHTML = `
      <div class="msg-header">
        <div class="msg-author-info">
          <span class="msg-avatar-icon">☕</span>
          <strong>Studi</strong>
          <span class="badge-mini">${activeStudyMode.toUpperCase()}</span>
        </div>
        <div class="msg-actions">
          <button class="btn-msg-action" title="Report response" onclick="openReportModal('${assistantMsgId}')">🚩</button>
        </div>
      </div>
      <div class="msg-content"><span class="typing-cursor">▌</span></div>
    `;
    chatMessagesContainer.appendChild(assistantBubble);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    const contentTarget = assistantBubble.querySelector('.msg-content');

    // 3. UI State: Generating
    isGenerating = true;
    if (typingIndicator) typingIndicator.style.display = 'inline-flex';
    if (stopStreamBtn) stopStreamBtn.style.display = 'inline-flex';
    if (retryStreamBtn) retryStreamBtn.style.display = 'none';

    streamAbortController = new AbortController();
    let accumulatedText = '';

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          message: messageText,
          conversationId: activeConversationId,
          mode: activeStudyMode,
          explainLevel: activeExplainLevel,
        }),
        signal: streamAbortController.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errData = await response.json();
          contentTarget.innerHTML = `⚠️ <strong>Pacing break:</strong> ${errData.message || 'Rate limit reached. Please wait a moment.'}`;
        } else {
          contentTarget.innerHTML = `⚠️ <strong>Server Notice:</strong> Could not connect to AI service. Please verify server is running.`;
        }
        return;
      }

      // 4. SSE Stream Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();

          if (payload === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(payload);

            // Handle metadata (capture conversation ID)
            if (parsed.meta?.conversationId) {
              activeConversationId = parsed.meta.conversationId;
            }

            // Handle token delta
            if (parsed.token) {
              accumulatedText += parsed.token;
              renderMarkdownAndMath(contentTarget, accumulatedText);
              chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            }

            // Handle complete signal
            if (parsed.complete && parsed.messageId) {
              assistantBubble.setAttribute('data-message-id', parsed.messageId);
              const repBtn = assistantBubble.querySelector('.btn-msg-action');
              if (repBtn) repBtn.setAttribute('onclick', `openReportModal('${parsed.messageId}')`);
            }
          } catch (jsonErr) {
            // non-json line
          }
        }
      }

      // Final render to assure markdown formatting and code buttons
      renderMarkdownAndMath(contentTarget, accumulatedText);
      loadConversationsList();
      fetchAndRenderUserProgress();

    } catch (streamErr) {
      if (streamErr.name === 'AbortError') {
        contentTarget.innerHTML += `<p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem;"><em>⏹️ Response stopped by student.</em></p>`;
      } else {
        console.error('Fetch error:', streamErr);
        contentTarget.innerHTML = `⚠️ <em>Unable to reach the study server. Please check your connection.</em>`;
      }
    } finally {
      isGenerating = false;
      if (typingIndicator) typingIndicator.style.display = 'none';
      if (stopStreamBtn) stopStreamBtn.style.display = 'none';
      if (retryStreamBtn) retryStreamBtn.style.display = 'inline-flex';
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  });

  // Stop Generating button
  stopStreamBtn?.addEventListener('click', () => {
    if (streamAbortController) {
      streamAbortController.abort();
      showToast('⏹️ Generation paused.');
    }
  });

  // Retry Response button
  retryStreamBtn?.addEventListener('click', () => {
    if (lastUserPrompt && chatInput) {
      chatInput.value = lastUserPrompt;
      chatForm?.dispatchEvent(new Event('submit'));
    }
  });

  // Initial load of conversations list on page ready
  loadConversationsList();

  // ------------------------------------------------------------------------
  // 7. REPORT RESPONSE MODAL LOGIC
  // ------------------------------------------------------------------------
  const reportModal = document.getElementById('report-modal');
  const reportForm = document.getElementById('report-response-form');
  const reportTargetMsgId = document.getElementById('report-target-message-id');

  window.openReportModal = function(messageId) {
    if (!reportModal) return;
    if (reportTargetMsgId) reportTargetMsgId.value = messageId || '';
    reportModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeReportModal = function() {
    if (!reportModal) return;
    reportModal.classList.remove('open');
    document.body.style.overflow = '';
  };

  reportForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reasonEl = document.querySelector('input[name="report-reason"]:checked');
    const detailsEl = document.getElementById('report-details');

    const reason = reasonEl ? reasonEl.value : 'Other';
    const details = detailsEl ? detailsEl.value : '';
    const messageId = reportTargetMsgId ? reportTargetMsgId.value : '';

    try {
      const res = await fetch('/api/chat/report', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          messageId,
          conversationId: activeConversationId,
          reason,
          details,
        }),
      });

      if (res.ok) {
        showToast('🛡️ Thank you. Report submitted for safety review.');
      } else {
        showToast('Report received. Thank you.');
      }
    } catch (err) {
      showToast('Report received. Thank you.');
    } finally {
      closeReportModal();
      reportForm.reset();
    }
  });

  // ------------------------------------------------------------------------
  // 8. AUTHENTICATION (LOGIN, REGISTER, GOOGLE/APPLE OAUTH)
  // ------------------------------------------------------------------------
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const authTabs = document.querySelectorAll('.modal-tab-btn');
  const authNameGroup = document.getElementById('auth-name-group');
  const authUnder16Wrapper = document.getElementById('auth-under-16-wrapper');
  const authIsUnder16 = document.getElementById('auth-is-under-16');
  const parentalConsentBox = document.getElementById('parental-consent-box');
  let currentAuthMode = 'signup';

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentAuthMode = tab.getAttribute('data-auth-mode');

      const submitBtn = document.getElementById('auth-submit-btn');
      const formHeading = document.getElementById('auth-heading');

      if (currentAuthMode === 'signup') {
        if (submitBtn) submitBtn.textContent = 'Create My Free Account';
        if (formHeading) formHeading.textContent = 'Start Studying Smarter with Studi';
        if (authNameGroup) authNameGroup.style.display = 'flex';
        if (authUnder16Wrapper) authUnder16Wrapper.style.display = 'block';
      } else {
        if (submitBtn) submitBtn.textContent = 'Welcome Back — Log In';
        if (formHeading) formHeading.textContent = 'Continue Your Study Streak';
        if (authNameGroup) authNameGroup.style.display = 'none';
        if (authUnder16Wrapper) authUnder16Wrapper.style.display = 'none';
      }
    });
  });

  // Toggle parental consent disclosure if under 16
  authIsUnder16?.addEventListener('change', (e) => {
    if (parentalConsentBox) {
      parentalConsentBox.style.display = e.target.checked ? 'block' : 'none';
    }
  });

  // Auth Form Submission
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const fullName = document.getElementById('auth-name')?.value.trim();
    const isUnder16 = authIsUnder16?.checked;
    const parentalConsent = document.getElementById('auth-parental-consent')?.checked;

    const endpoint = currentAuthMode === 'signup' ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          is_under_16: isUnder16,
          parental_consent_given: parentalConsent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(`⚠️ ${data.message || 'Authentication error.'}`);
        return;
      }

      currentAuthToken = data.token;
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);

      authModal?.classList.remove('open');
      document.body.style.overflow = '';
      showToast(`🎉 ${data.message || 'Logged in!'}`);

      // Refresh chat list and progress dashboard for newly logged in user
      loadConversationsList();
      fetchAndRenderUserProgress();

    } catch (err) {
      console.error('Auth request failed:', err);
      showToast('⚠️ Could not complete sign in. Please verify the server is running.');
    }
  });

  // Connect Google and Apple buttons
  document.querySelectorAll('.btn-social-auth').forEach(btn => {
    btn.onclick = async () => {
      const isApple = btn.innerText.includes('Apple');
      const provider = isApple ? 'apple' : 'google';

      try {
        const res = await fetch('/api/auth/oauth-mock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        });
        const data = await res.json();
        if (data.token) {
          currentAuthToken = data.token;
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
          authModal?.classList.remove('open');
          document.body.style.overflow = '';
          showToast(`⚡ Signed in with ${provider.toUpperCase()}!`);
          loadConversationsList();
          fetchAndRenderUserProgress();
        }
      } catch (err) {
        showToast('OAuth connected.');
      }
    };
  });

  // ------------------------------------------------------------------------
  // 8B. REAL-TIME USER PROGRESS & MOTIVATION DASHBOARD SYNC
  // ------------------------------------------------------------------------
  const navUserPill = document.getElementById('nav-user-pill');
  const navUserAvatar = document.getElementById('nav-user-avatar');
  const navUserName = document.getElementById('nav-user-name');
  const navLogoutBtn = document.getElementById('btn-nav-logout');
  const navLoginBtn = document.getElementById('btn-nav-login');
  const navSignupBtn = document.getElementById('btn-nav-signup');

  const mobileUserPill = document.getElementById('mobile-user-pill');
  const mobileUserAvatar = document.getElementById('mobile-user-avatar');
  const mobileUserName = document.getElementById('mobile-user-name');
  const mobileLogoutBtn = document.getElementById('btn-mobile-logout');
  const mobileLoginBtn = document.getElementById('btn-mobile-login');
  const mobileSignupBtn = document.getElementById('btn-mobile-signup');

  const dashAvatarInitials = document.getElementById('dash-avatar-initials');
  const dashSanctuaryTitle = document.getElementById('dash-sanctuary-title');
  const dashUserSubtitle = document.getElementById('dash-user-subtitle');
  const dashStreakCount = document.getElementById('dash-streak-count');
  const dashXpCount = document.getElementById('dash-xp-count');
  const dashGoalText = document.getElementById('dash-goal-text');
  const dashAvgRetention = document.getElementById('dash-avg-retention');
  const dashMasteryList = document.getElementById('dash-mastery-list');
  const dashStudiNote = document.getElementById('dash-studi-note');
  const dashBadgesCount = document.getElementById('dash-badges-count');
  const dashBadgesGrid = document.getElementById('dash-badges-grid');

  async function fetchAndRenderUserProgress() {
    try {
      const res = await fetch('/api/user/progress', {
        headers: getApiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.user || !data.stats) return;

      // 1. Update Navigation Bar State (Desktop & Mobile)
      if (data.authenticated) {
        if (navUserPill) navUserPill.style.display = 'inline-flex';
        if (navUserAvatar) navUserAvatar.textContent = data.user.initials || 'ME';
        if (navUserName) navUserName.textContent = data.user.fullName || 'Scholar';
        if (navLoginBtn) navLoginBtn.style.display = 'none';
        if (navSignupBtn) navSignupBtn.style.display = 'none';

        if (mobileUserPill) mobileUserPill.style.display = 'flex';
        if (mobileUserAvatar) mobileUserAvatar.textContent = data.user.initials || 'ME';
        if (mobileUserName) mobileUserName.textContent = data.user.fullName || 'Scholar';
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
        if (mobileSignupBtn) mobileSignupBtn.style.display = 'none';
      } else {
        if (navUserPill) navUserPill.style.display = 'none';
        if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
        if (navSignupBtn) navSignupBtn.style.display = 'inline-flex';

        if (mobileUserPill) mobileUserPill.style.display = 'none';
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'inline-flex';
        if (mobileSignupBtn) mobileSignupBtn.style.display = 'inline-flex';
      }

      // 2. Update Section 9 Dashboard
      if (dashAvatarInitials) {
        dashAvatarInitials.textContent = data.user.initials || 'GS';
      }
      if (dashSanctuaryTitle) {
        dashSanctuaryTitle.textContent = data.user.sanctuaryTitle || "Your Study Sanctuary";
      }
      if (dashUserSubtitle) {
        dashUserSubtitle.textContent = data.user.track || 'High School Scholar';
      }
      if (dashStreakCount) {
        dashStreakCount.textContent = `${data.stats.streakDays} Day Streak`;
      }
      if (dashXpCount) {
        dashXpCount.textContent = `${Number(data.stats.xp || 0).toLocaleString()} XP`;
      }
      if (dashGoalText) {
        dashGoalText.textContent = `${data.stats.studyHours} / ${data.stats.weeklyGoalHours}h Goal`;
      }
      if (dashAvgRetention) {
        dashAvgRetention.textContent = `Avg ${data.stats.avgRetention}% Retention`;
      }
      if (dashStudiNote && data.stats.dailyNote) {
        dashStudiNote.textContent = data.stats.dailyNote;
      }
      if (dashBadgesCount) {
        dashBadgesCount.textContent = `${data.stats.unlockedBadgesCount} unlocked this semester`;
      }

      // 3. Render Subject Mastery Bars
      if (dashMasteryList && Array.isArray(data.stats.subjectMastery)) {
        dashMasteryList.innerHTML = data.stats.subjectMastery.map(subj => `
          <div class="mastery-item">
            <div class="mastery-header">
              <span>${escapeHtml(subj.name)}</span>
              <span style="color: var(--accent-primary); font-family: var(--font-mono);">${subj.score}% Ready</span>
            </div>
            <div class="mastery-progress-bg">
              <div class="mastery-progress-fill ${subj.color || 'fill-indigo'}" style="width: ${subj.score}%;"></div>
            </div>
          </div>
        `).join('');
      }

      // 4. Render Earned & Locked Badges
      if (dashBadgesGrid && Array.isArray(data.stats.badges)) {
        dashBadgesGrid.innerHTML = data.stats.badges.map(b => `
          <div class="badge-item ${b.unlocked ? '' : 'locked'}" title="${escapeHtml(b.desc || '')}">
            <span class="badge-icon">${b.icon}</span>
            <span class="badge-name">${escapeHtml(b.name)}</span>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Could not sync user dashboard progress:', err);
    }
  }

  function handleLogout(e) {
    if (e) e.stopPropagation();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    currentAuthToken = null;
    showToast('👋 You have been logged out.');
    newChatBtn?.click();
    loadConversationsList();
    fetchAndRenderUserProgress();
  }

  navLogoutBtn?.addEventListener('click', handleLogout);
  mobileLogoutBtn?.addEventListener('click', handleLogout);

  // ------------------------------------------------------------------------
  // 9. ONBOARDING MODAL SYNC WITH BACKEND
  // ------------------------------------------------------------------------
  const onboardingModal = document.getElementById('onboarding-modal');
  let currentOnboardingStep = 1;
  const totalOnboardingSteps = 3;
  const onboardingNextBtn = document.getElementById('onboarding-next-btn');
  const onboardingBackBtn = document.getElementById('onboarding-back-btn');
  const stepIndicators = document.querySelectorAll('.progress-step-pill');

  let selectedGradeLevel = 'High School (11th-12th)';
  let selectedSubjects = [];
  let selectedGoals = [];

  function updateOnboardingView() {
    document.querySelectorAll('.onboarding-step').forEach(step => step.classList.remove('active'));
    document.getElementById(`onboarding-step-${currentOnboardingStep}`)?.classList.add('active');

    stepIndicators.forEach((pill, idx) => {
      pill.classList.toggle('completed', idx + 1 <= currentOnboardingStep);
    });

    if (onboardingBackBtn) {
      onboardingBackBtn.style.visibility = currentOnboardingStep === 1 ? 'hidden' : 'visible';
    }

    if (onboardingNextBtn) {
      onboardingNextBtn.textContent = currentOnboardingStep === totalOnboardingSteps ? 'Launch My Study Space 🚀' : 'Continue →';
    }
  }

  // Chip selections in onboarding
  document.querySelectorAll('.onboarding-chip-select').forEach(chip => {
    chip.addEventListener('click', () => {
      const isMulti = chip.getAttribute('data-multiselect') === 'true';
      if (!isMulti) {
        chip.parentElement?.querySelectorAll('.onboarding-chip-select').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedGradeLevel = chip.textContent.trim();
      } else {
        chip.classList.toggle('selected');
      }
    });
  });

  onboardingNextBtn?.addEventListener('click', async () => {
    if (currentOnboardingStep < totalOnboardingSteps) {
      currentOnboardingStep++;
      updateOnboardingView();
    } else {
      // Gather selected subjects & goals
      const subjectChips = document.querySelectorAll('#onboarding-step-2 .onboarding-chip-select.selected');
      selectedSubjects = Array.from(subjectChips).map(c => c.textContent.trim());

      const goalChips = document.querySelectorAll('#onboarding-step-3 .onboarding-chip-select.selected');
      selectedGoals = Array.from(goalChips).map(c => c.textContent.trim());

      // Persist onboarding preferences to server
      try {
        await fetch('/api/auth/onboarding', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            gradeLevel: selectedGradeLevel,
            targetSubjects: selectedSubjects,
            studyGoals: selectedGoals,
          }),
        });
      } catch (err) {
        console.warn('Onboarding sync note:', err);
      }

      onboardingModal?.classList.remove('open');
      document.body.style.overflow = '';
      showToast('🚀 Study space customized! Welcome aboard.');
      currentOnboardingStep = 1;
      updateOnboardingView();
      fetchAndRenderUserProgress();
    }
  });

  onboardingBackBtn?.addEventListener('click', () => {
    if (currentOnboardingStep > 1) {
      currentOnboardingStep--;
      updateOnboardingView();
    }
  });

  // Modal open triggers
  document.querySelectorAll('[data-open-modal="auth"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      authModal?.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  document.querySelectorAll('[data-open-modal="onboarding"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onboardingModal?.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });



  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parentModal = btn.closest('.modal-overlay');
      parentModal?.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modeDropdown?.classList.contains('open') || depthDropdown?.classList.contains('open')) {
        closeAllDropdowns();
        return;
      }
      if (studyWindowCard?.classList.contains('fullscreen-mode')) {
        setFullscreenState(false);
        return;
      }
      if (studyWindowOverlay?.classList.contains('open')) {
        closeStudyWindow();
        return;
      }
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
      document.body.style.overflow = '';
    }
    // Quick launcher shortcut (Cmd+K / Ctrl+K)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openStudyWindow(false);
    }
  });

  // ------------------------------------------------------------------------
  // 10. INTERACTIVE DEMO WIDGET (TABS: 3D FLASHCARD & QUIZ)
  // ------------------------------------------------------------------------
  const demoTabs = document.querySelectorAll('.demo-tab-btn');
  const demoPanes = document.querySelectorAll('.demo-tab-content');

  demoTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');
      demoTabs.forEach(t => t.classList.remove('active'));
      demoPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Flashcard Deck
  const flashcardDeck = [
    {
      subject: "CALCULUS (BC)",
      q: "What is the derivative of \\(\\ln(x)\\) with respect to \\(x\\)?",
      a: "\\(\\frac{d}{dx}[\\ln(x)] = \\frac{1}{x}\\) (for \\(x > 0\\)).",
      hint: "Remember: \\(\\ln(x)\\) grows slower as \\(x\\) gets massive!"
    },
    {
      subject: "AP BIOLOGY",
      q: "Where does the Krebs Cycle (Citric Acid Cycle) take place?",
      a: "In the mitochondrial matrix of eukaryotic cells.",
      hint: "Glycolysis is in the cytoplasm, Krebs is in the matrix!"
    },
    {
      subject: "WORLD HISTORY",
      q: "What was the significance of the 1648 Peace of Westphalia?",
      a: "Established the concept of state sovereignty and the modern nation-state system.",
      hint: "Ended the Thirty Years' War in Europe."
    },
    {
      subject: "COMPUTER SCIENCE",
      q: "What is the average time complexity of QuickSort?",
      a: "\\(O(n \\log n)\\). (Worst-case is \\(O(n^2)\\) with poor pivot selection).",
      hint: "Divide and conquer logarithmic efficiency!"
    }
  ];

  let currentCardIdx = 0;
  let flashcardFlipped = false;
  const cardElement = document.getElementById('flashcard-card-inner');
  const cardTag = document.getElementById('flashcard-tag');
  const cardQ = document.getElementById('flashcard-question');
  const cardA = document.getElementById('flashcard-answer');
  const cardCounter = document.getElementById('flashcard-counter');
  const flipBtn = document.getElementById('flashcard-flip-btn');
  const nextCardBtn = document.getElementById('flashcard-next-btn');
  const gotItBtn = document.getElementById('flashcard-got-it-btn');

  function renderCard(idx) {
    if (!cardElement) return;
    flashcardFlipped = false;
    cardElement.classList.remove('is-flipped');
    const item = flashcardDeck[idx];
    if (cardTag) cardTag.textContent = item.subject;
    if (cardQ) cardQ.innerHTML = item.q;
    if (cardA) cardA.innerHTML = item.a;
    if (cardCounter) cardCounter.textContent = `Card ${idx + 1} of ${flashcardDeck.length}`;
  }

  function toggleCardFlip() {
    if (!cardElement) return;
    flashcardFlipped = !flashcardFlipped;
    cardElement.classList.toggle('is-flipped', flashcardFlipped);
  }

  cardElement?.addEventListener('click', toggleCardFlip);
  flipBtn?.addEventListener('click', toggleCardFlip);

  nextCardBtn?.addEventListener('click', () => {
    currentCardIdx = (currentCardIdx + 1) % flashcardDeck.length;
    renderCard(currentCardIdx);
  });

  gotItBtn?.addEventListener('click', () => {
    showToast('✨ +15 XP! Concept mastered and queued for spaced repetition.');
    currentCardIdx = (currentCardIdx + 1) % flashcardDeck.length;
    renderCard(currentCardIdx);
  });

  // Interactive Quizzer
  const quizOptions = document.querySelectorAll('.quiz-opt-btn');
  const quizExplanation = document.getElementById('quiz-explanation-box');
  const nextQuizBtn = document.getElementById('quiz-next-btn');

  const quizPool = [
    {
      q: "Which neurotransmitter is primarily responsible for learning, memory consolidation, and long-term potentiation?",
      opts: ["Dopamine", "Glutamate", "GABA", "Melatonin"],
      correct: 1,
      explanation: "Glutamate is the brain's principal excitatory neurotransmitter and drives Long-Term Potentiation (LTP)—the cellular foundation of active memory formation!"
    },
    {
      q: "According to the Feynman Technique, how can you test whether you truly understand a concept?",
      opts: [
        "Memorize the textbook definition verbatim",
        "Explain it simply in plain language as if teaching a beginner",
        "Re-read highlighted passages five times",
        "Copy lecture slides onto paper"
      ],
      correct: 1,
      explanation: "Teaching it simply exposes your knowledge gaps and conceptual illusions. Studi's 'Teach It Back' mode is built directly on this principle!"
    }
  ];

  let activeQuizIdx = 0;

  function loadQuiz(idx) {
    const qData = quizPool[idx];
    const qHeader = document.getElementById('quiz-header-text');
    if (qHeader) qHeader.textContent = qData.q;
    quizOptions.forEach((btn, i) => {
      btn.className = 'quiz-opt-btn';
      btn.disabled = false;
      const label = btn.querySelector('.quiz-label');
      if (label) label.textContent = qData.opts[i];
    });
    if (quizExplanation) {
      quizExplanation.classList.remove('show');
      quizExplanation.textContent = '';
    }
  }

  quizOptions.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const qData = quizPool[activeQuizIdx];
      quizOptions.forEach(b => b.disabled = true);

      if (i === qData.correct) {
        btn.classList.add('correct');
        showToast('🎯 Brilliant! Correct answer.');
      } else {
        btn.classList.add('incorrect');
        quizOptions[qData.correct].classList.add('correct');
        showToast('💡 Close! Studi broke down the reason below.');
      }

      if (quizExplanation) {
        quizExplanation.innerHTML = `<strong>Why this matters:</strong> ${qData.explanation}`;
        quizExplanation.classList.add('show');
      }
    });
  });

  nextQuizBtn?.addEventListener('click', () => {
    activeQuizIdx = (activeQuizIdx + 1) % quizPool.length;
    loadQuiz(activeQuizIdx);
  });

  // ------------------------------------------------------------------------
  // 11. SUBJECTS SECTION: FILTER & INTERACTIVE STUDI CHAT LAUNCH
  // ------------------------------------------------------------------------
  const subjectFilterBtns = document.querySelectorAll('.subject-filter-btn');
  const subjectCards = document.querySelectorAll('.subject-card');

  subjectFilterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      subjectFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterVal = btn.getAttribute('data-filter');
      subjectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filterVal === 'all' || category === filterVal) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Clicking on any subject card opens up a live Studi chat of the chosen topic
  subjectCards.forEach(card => {
    const handleCardSelection = (e) => {
      const headingEl = card.querySelector('.subject-card-header h3');
      const subjectTitle = headingEl ? headingEl.textContent.trim() : 'Study Topic';
      const promptEl = card.querySelector('.subject-sample-prompt');
      let promptText = promptEl ? promptEl.textContent.trim().replace(/^["“]|["”]$/g, '') : '';
      const cardMode = card.getAttribute('data-mode') || 'learn';

      // If user clicked specifically on a topic tag inside the card
      const clickedTag = e.target.closest('.topic-tag');
      if (clickedTag) {
        const tagText = clickedTag.textContent.trim();
        promptText = `Hi Studi! Can you explain "${tagText}" in ${subjectTitle} step-by-step with intuitive examples?`;
      }

      showToast(`💬 Opening Studi Study Window for ${subjectTitle}...`);
      openStudyWindow(false, promptText, cardMode, true, true);
    };

    card.addEventListener('click', handleCardSelection);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardSelection(e);
      }
    });
  });

  // Mode cards in Section 8: clicking opens study window in that mode
  document.querySelectorAll('.mode-card').forEach((card, idx) => {
    const modeKeys = ['learn', 'quiz-me', 'teach-it-back', 'exam-crunch', 'chill-review'];
    card.addEventListener('click', () => {
      const targetMode = modeKeys[idx] || 'learn';
      const modeTitle = card.querySelector('.mode-title')?.textContent || targetMode;
      showToast(`Activated ${modeTitle} mode with Studi!`);
      openStudyWindow(false, '', targetMode, false, false);
    });
  });

  // ------------------------------------------------------------------------
  // 12. FAQ ACCORDION
  // ------------------------------------------------------------------------
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question-btn');
    questionBtn?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          other.querySelector('.faq-question-btn')?.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('active', !isActive);
      questionBtn.setAttribute('aria-expanded', (!isActive).toString());
    });
  });

  // ------------------------------------------------------------------------
  // 13. COOKIE BANNER
  // ------------------------------------------------------------------------
  const cookieBanner = document.getElementById('cookie-banner');
  const acceptCookieBtn = document.getElementById('cookie-accept-btn');
  const settingsCookieBtn = document.getElementById('cookie-settings-btn');

  if (!localStorage.getItem('ab-cookies-accepted')) {
    setTimeout(() => {
      cookieBanner?.classList.add('show');
    }, 1200);
  }

  acceptCookieBtn?.addEventListener('click', () => {
    localStorage.setItem('ab-cookies-accepted', 'true');
    cookieBanner?.classList.remove('show');
    showToast('🍪 Preferences saved. We prioritize your privacy.');
  });

  settingsCookieBtn?.addEventListener('click', () => {
    localStorage.setItem('ab-cookies-accepted', 'essential');
    cookieBanner?.classList.remove('show');
    showToast('🔒 Essential cookies only enabled.');
  });

  // ------------------------------------------------------------------------
  // 14. NEWSLETTER & CTA FORM HANDLERS
  // ------------------------------------------------------------------------
  const ctaForm = document.getElementById('cta-capture-form');
  ctaForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = ctaForm.querySelector('input[type="email"]');
    if (input && input.value) {
      input.value = '';
      showToast('✨ High-five! Check your email for your free study kit.');
    }
  });

  const footerNewsletterForm = document.getElementById('footer-newsletter-form');
  footerNewsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = footerNewsletterForm.querySelector('input');
    if (input && input.value) {
      input.value = '';
      showToast('📬 Subscribed! Expect study tips every Tuesday.');
    }
  });

  // Initial sync for custom dropdowns
  syncCustomDropdowns();

  // Initial user progress dashboard sync & navbar state
  fetchAndRenderUserProgress();
});
