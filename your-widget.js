(function () {
  if (window.__EAW_CHAT_WIDGET_LOADED__) return;
  window.__EAW_CHAT_WIDGET_LOADED__ = true;

  var scriptTag = document.currentScript;
  var config = window.EAWWidgetConfig || {};

  var endpoint =
    config.endpoint ||
    (scriptTag && scriptTag.getAttribute('data-endpoint')) ||
    '/chat';

  var storeId =
    config.storeId ||
    (scriptTag && scriptTag.getAttribute('data-store-id')) ||
    'demo-store';

  var title =
    config.title ||
    (scriptTag && scriptTag.getAttribute('data-title')) ||
    'Support Chat';

  var placeholder =
    config.placeholder ||
    (scriptTag && scriptTag.getAttribute('data-placeholder')) ||
    'Type your message...';

  var style = document.createElement('style');
  style.textContent =
    '.eaw-widget *{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
    '.eaw-widget{position:fixed;right:16px;bottom:16px;z-index:2147483647;}' +
    '.eaw-chat-toggle{width:56px;height:56px;border-radius:999px;border:none;background:#111827;color:#fff;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.2);font-size:22px;}' +
    '.eaw-chat-panel{display:none;flex-direction:column;position:absolute;right:0;bottom:70px;width:340px;max-width:calc(100vw - 24px);height:480px;max-height:70vh;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.18);}' +
    '.eaw-chat-panel.open{display:flex;}' +
    '.eaw-chat-header{padding:12px 14px;background:#111827;color:#fff;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:space-between;}' +
    '.eaw-close-btn{border:none;background:transparent;color:#fff;font-size:18px;line-height:1;cursor:pointer;}' +
    '.eaw-chat-messages{flex:1;overflow:auto;background:#f9fafb;padding:10px;display:flex;flex-direction:column;gap:8px;}' +
    '.eaw-msg{max-width:85%;padding:9px 11px;border-radius:12px;font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word;}' +
    '.eaw-msg.user{align-self:flex-end;background:#111827;color:#fff;border-bottom-right-radius:4px;}' +
    '.eaw-msg.bot{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;color:#111827;border-bottom-left-radius:4px;}' +
    '.eaw-chat-input-wrap{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff;}' +
    '.eaw-chat-input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;}' +
    '.eaw-chat-input:focus{border-color:#9ca3af;}' +
    '.eaw-send-btn{border:none;background:#111827;color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-size:14px;}' +
    '.eaw-send-btn[disabled]{opacity:.65;cursor:not-allowed;}' +
    '@media (max-width:640px){.eaw-widget{right:10px;bottom:10px;}.eaw-chat-panel{width:min(420px,calc(100vw - 12px));height:72vh;bottom:64px;}}';
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.className = 'eaw-widget';
  root.innerHTML =
    '<button class="eaw-chat-toggle" aria-label="Open chat">💬</button>' +
    '<div class="eaw-chat-panel" role="dialog" aria-label="Chat support widget">' +
    '<div class="eaw-chat-header"><span></span><button class="eaw-close-btn" aria-label="Close chat">×</button></div>' +
    '<div class="eaw-chat-messages"></div>' +
    '<form class="eaw-chat-input-wrap">' +
    '<input class="eaw-chat-input" type="text" maxlength="1000" />' +
    '<button class="eaw-send-btn" type="submit">Send</button>' +
    '</form>' +
    '</div>';

  document.body.appendChild(root);

  var toggleBtn = root.querySelector('.eaw-chat-toggle');
  var panel = root.querySelector('.eaw-chat-panel');
  var closeBtn = root.querySelector('.eaw-close-btn');
  var headerTitle = root.querySelector('.eaw-chat-header span');
  var messagesEl = root.querySelector('.eaw-chat-messages');
  var form = root.querySelector('.eaw-chat-input-wrap');
  var input = root.querySelector('.eaw-chat-input');
  var sendBtn = root.querySelector('.eaw-send-btn');

  headerTitle.textContent = title;
  input.placeholder = placeholder;

  function addMessage(text, sender) {
    var el = document.createElement('div');
    el.className = 'eaw-msg ' + sender;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setLoading(isLoading) {
    sendBtn.disabled = isLoading;
    input.disabled = isLoading;
    sendBtn.textContent = isLoading ? '...' : 'Send';
  }

  async function sendMessage(message) {
    setLoading(true);

    try {
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: storeId,
          message: message,
        }),
      });

      var data = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        var errText = (data && data.error) || 'Something went wrong.';
        addMessage(errText, 'bot');
        return;
      }

      var reply = data && data.reply ? String(data.reply) : "Sorry, I couldn't process that right now.";
      addMessage(reply, 'bot');
    } catch (error) {
      addMessage("Sorry, I couldn't process that right now.", 'bot');
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  toggleBtn.addEventListener('click', function () {
    panel.classList.add('open');
    input.focus();
    if (!messagesEl.children.length) {
      addMessage('Hi! How can I help you today?', 'bot');
    }
  });

  closeBtn.addEventListener('click', function () {
    panel.classList.remove('open');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var message = input.value.trim();

    if (!message) return;

    addMessage(message, 'user');
    input.value = '';
    sendMessage(message);
  });
})();
