(() => {
  'use strict';

  const WHATSAPP_NUMBER = '5527998225807';
  const STORAGE_KEY = 'schwambach_pedido_rascunho_v1';
  const MAX_ITEMS = 40;

  const form = document.getElementById('pedidoForm');
  const itemsList = document.getElementById('itemsList');
  const itemTemplate = document.getElementById('itemTemplate');
  const addItemBtn = document.getElementById('addItemBtn');
  const clearBtn = document.getElementById('clearBtn');
  const modal = document.getElementById('reviewModal');
  const reviewContent = document.getElementById('reviewContent');
  const whatsappBtn = document.getElementById('whatsappBtn');
  const copyBtn = document.getElementById('copyBtn');
  const toast = document.getElementById('toast');
  const notaFiscal = document.getElementById('notaFiscal');
  const notaWrap = document.getElementById('notaWrap');
  const trocoWrap = document.getElementById('trocoWrap');
  const itemCountBadge = document.getElementById('itemCountBadge');
  const sideItemCount = document.getElementById('sideItemCount');
  const sidePayment = document.getElementById('sidePayment');
  const sideInvoice = document.getElementById('sideInvoice');
  const obs = document.getElementById('observacoesPedido');
  const obsCounter = document.getElementById('obsCounter');
  const autosaveStatus = document.getElementById('autosaveStatus');

  let lastMessage = '';
  let saveTimer = null;
  let lastFocusedElement = null;

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');
  const escapeHTML = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function formatPhone(input) {
    const digits = digitsOnly(input.value).slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    input.value = formatted;
  }

  function formatFiscalDocument(input) {
    const digits = digitsOnly(input.value).slice(0, 14);
    if (digits.length <= 11) {
      input.value = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return;
    }
    input.value = digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function createItem(data = {}) {
    if (itemsList.children.length >= MAX_ITEMS) {
      showToast(`Limite de ${MAX_ITEMS} itens por pedido.`);
      return;
    }

    const fragment = itemTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.item-card');
    const name = fragment.querySelector('.item-name');
    const qty = fragment.querySelector('.item-qty');
    const itemObs = fragment.querySelector('.item-obs');

    name.value = data.name || '';
    qty.value = data.qty || '';
    itemObs.value = data.obs || '';

    fragment.querySelector('.item-card__remove').addEventListener('click', () => {
      if (itemsList.children.length === 1) {
        name.value = '';
        qty.value = '';
        itemObs.value = '';
        showToast('O pedido precisa ter pelo menos um item.');
      } else {
        card.remove();
        updateItemIndexes();
      }
      scheduleSave();
      updateSideSummary();
    });

    [name, qty, itemObs].forEach((input) => {
      input.addEventListener('input', () => {
        clearItemError(input);
        scheduleSave();
        updateSideSummary();
      });
    });

    itemsList.appendChild(fragment);
    updateItemIndexes();
  }

  function updateItemIndexes() {
    [...itemsList.children].forEach((card, index) => {
      card.querySelector('.item-card__index').textContent = `Item ${index + 1}`;
      const remove = card.querySelector('.item-card__remove');
      remove.setAttribute('aria-label', `Remover item ${index + 1}`);
    });
    updateItemCount();
  }

  function updateItemCount() {
    const count = itemsList.children.length;
    itemCountBadge.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
    sideItemCount.textContent = count;
  }

  function getItems() {
    return [...itemsList.children].map((card) => ({
      name: clean(card.querySelector('.item-name').value),
      qty: clean(card.querySelector('.item-qty').value),
      obs: clean(card.querySelector('.item-obs').value)
    }));
  }

  function getPayment() {
    return form.querySelector('input[name="pagamento"]:checked')?.value || '';
  }

  function updateConditionalFields() {
    const payment = getPayment();
    trocoWrap.hidden = payment !== 'Dinheiro';
    notaWrap.hidden = !notaFiscal.checked;
    sidePayment.textContent = payment || 'Não informado';
    sideInvoice.textContent = notaFiscal.checked ? 'Sim' : 'Não';
  }

  function updateSideSummary() {
    updateItemCount();
    updateConditionalFields();
  }

  function setFieldError(id, message) {
    const field = document.getElementById(id);
    const container = field?.closest('.field') || field?.closest('.consent-row');
    const error = document.querySelector(`[data-error-for="${id}"]`);
    if (container) container.classList.toggle('is-invalid', Boolean(message));
    if (error) error.textContent = message || '';
  }

  function clearFieldError(id) {
    setFieldError(id, '');
  }

  function setItemError(input, message) {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.toggle('is-invalid', Boolean(message));
    const error = field.querySelector('.field-error');
    if (error) error.textContent = message || '';
  }

  function clearItemError(input) {
    setItemError(input, '');
  }

  function validateForm() {
    let valid = true;
    let firstInvalid = null;

    ['nome', 'telefone', 'endereco', 'bairro', 'cidade'].forEach(clearFieldError);
    setFieldError('pagamento', '');
    setFieldError('consentimento', '');
    document.getElementById('paymentGroup').classList.remove('is-invalid');

    const requiredText = [
      ['nome', 'Informe seu nome completo.'],
      ['endereco', 'Informe o endereço de entrega.'],
      ['bairro', 'Informe o bairro ou comunidade.'],
      ['cidade', 'Informe a cidade.']
    ];

    requiredText.forEach(([id, message]) => {
      const input = document.getElementById(id);
      if (!clean(input.value)) {
        setFieldError(id, message);
        valid = false;
        firstInvalid ||= input;
      }
    });

    const phone = document.getElementById('telefone');
    if (digitsOnly(phone.value).length < 10) {
      setFieldError('telefone', 'Informe um telefone válido com DDD.');
      valid = false;
      firstInvalid ||= phone;
    }

    [...itemsList.children].forEach((card) => {
      const name = card.querySelector('.item-name');
      const qty = card.querySelector('.item-qty');
      setItemError(name, '');
      setItemError(qty, '');
      if (!clean(name.value)) {
        setItemError(name, 'Informe o produto.');
        valid = false;
        firstInvalid ||= name;
      }
      if (!clean(qty.value)) {
        setItemError(qty, 'Informe a quantidade.');
        valid = false;
        firstInvalid ||= qty;
      }
    });

    if (!getPayment()) {
      document.getElementById('paymentGroup').classList.add('is-invalid');
      setFieldError('pagamento', 'Escolha uma forma de pagamento.');
      valid = false;
      firstInvalid ||= document.getElementById('paymentGroup');
    }

    const consent = document.getElementById('consentimento');
    if (!consent.checked) {
      consent.closest('.consent-row').classList.add('is-invalid');
      setFieldError('consentimento', 'Confirme a revisão dos dados para continuar.');
      valid = false;
      firstInvalid ||= consent;
    }

    if (!valid && firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof firstInvalid.focus === 'function') setTimeout(() => firstInvalid.focus(), 250);
    }
    return valid;
  }

  function collectData() {
    return {
      nome: clean(document.getElementById('nome').value),
      telefone: clean(document.getElementById('telefone').value),
      endereco: clean(document.getElementById('endereco').value),
      numero: clean(document.getElementById('numero').value),
      bairro: clean(document.getElementById('bairro').value),
      cidade: clean(document.getElementById('cidade').value),
      complemento: clean(document.getElementById('complemento').value),
      referencia: clean(document.getElementById('referencia').value),
      items: getItems(),
      confirmarSubstituicao: document.getElementById('confirmarSubstituicao').checked,
      observacoesPedido: clean(obs.value),
      pagamento: getPayment(),
      troco: clean(document.getElementById('troco').value),
      notaFiscal: notaFiscal.checked,
      documentoFiscal: clean(document.getElementById('documentoFiscal').value),
      nomeFiscal: clean(document.getElementById('nomeFiscal').value)
    };
  }

  function buildMessage(data) {
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now);
    const lines = [];
    lines.push('🛒 *NOVO PEDIDO ONLINE*');
    lines.push('*SUPERMERCADO SCHWAMBACH*');
    lines.push('');
    lines.push('👤 *CLIENTE*');
    lines.push(`Nome: ${data.nome}`);
    lines.push(`Telefone: ${data.telefone}`);
    lines.push('');
    lines.push('📍 *ENTREGA*');
    lines.push(`Endereço: ${data.endereco}${data.numero ? `, ${data.numero}` : ''}`);
    lines.push(`Bairro/Comunidade: ${data.bairro}`);
    lines.push(`Cidade: ${data.cidade}`);
    if (data.complemento) lines.push(`Complemento: ${data.complemento}`);
    if (data.referencia) lines.push(`Referência: ${data.referencia}`);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('🛍️ *ITENS DO PEDIDO*');
    lines.push('');
    data.items.forEach((item, index) => {
      lines.push(`${index + 1}. *${item.name}*`);
      lines.push(`Quantidade: ${item.qty}`);
      if (item.obs) lines.push(`Obs.: ${item.obs}`);
      if (index < data.items.length - 1) lines.push('');
    });
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('💳 *PAGAMENTO*');
    lines.push(data.pagamento);
    if (data.pagamento === 'Dinheiro' && data.troco) lines.push(`Troco: ${data.troco}`);
    lines.push('');
    lines.push('🧾 *NOTA FISCAL*');
    lines.push(data.notaFiscal ? 'Sim' : 'Não');
    if (data.notaFiscal && data.documentoFiscal) lines.push(`CPF/CNPJ: ${data.documentoFiscal}`);
    if (data.notaFiscal && data.nomeFiscal) lines.push(`Nome/Razão social: ${data.nomeFiscal}`);
    lines.push('');
    lines.push('📌 *SUBSTITUIÇÕES*');
    lines.push(data.confirmarSubstituicao ? 'Entrar em contato antes de substituir qualquer produto.' : 'Pode substituir por opção semelhante, se necessário.');
    if (data.observacoesPedido) {
      lines.push('');
      lines.push('📝 *OBSERVAÇÕES*');
      lines.push(data.observacoesPedido);
    }
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(`Pedido preenchido pelo sistema online em ${dateLabel}.`);
    lines.push('_Aguardando confirmação da recepção._');
    return lines.join('\n');
  }

  function buildReview(data) {
    const address = `${escapeHTML(data.endereco)}${data.numero ? `, ${escapeHTML(data.numero)}` : ''} — ${escapeHTML(data.bairro)} — ${escapeHTML(data.cidade)}`;
    const itemsHTML = data.items.map((item) => `
      <li><strong>${escapeHTML(item.name)}</strong> — ${escapeHTML(item.qty)}${item.obs ? `<small>${escapeHTML(item.obs)}</small>` : ''}</li>
    `).join('');

    reviewContent.innerHTML = `
      <div class="review-block">
        <h3>Cliente</h3>
        <p><strong>${escapeHTML(data.nome)}</strong></p>
        <p>${escapeHTML(data.telefone)}</p>
      </div>
      <div class="review-block">
        <h3>Entrega</h3>
        <p>${address}</p>
        ${data.complemento ? `<p>Complemento: ${escapeHTML(data.complemento)}</p>` : ''}
        ${data.referencia ? `<p>Referência: ${escapeHTML(data.referencia)}</p>` : ''}
      </div>
      <div class="review-block">
        <h3>${data.items.length} ${data.items.length === 1 ? 'item' : 'itens'}</h3>
        <ol class="review-items">${itemsHTML}</ol>
      </div>
      <div class="review-block">
        <h3>Pagamento</h3>
        <p><strong>${escapeHTML(data.pagamento)}</strong>${data.pagamento === 'Dinheiro' && data.troco ? ` — troco: ${escapeHTML(data.troco)}` : ''}</p>
        <p>Nota fiscal: <strong>${data.notaFiscal ? 'Sim' : 'Não'}</strong></p>
        ${data.notaFiscal && data.documentoFiscal ? `<p>CPF/CNPJ: ${escapeHTML(data.documentoFiscal)}</p>` : ''}
      </div>
      ${(data.confirmarSubstituicao || data.observacoesPedido) ? `
        <div class="review-block">
          <h3>Observações</h3>
          <p>${data.confirmarSubstituicao ? 'Entrar em contato antes de substituir produtos.' : 'Substituições semelhantes estão autorizadas.'}</p>
          ${data.observacoesPedido ? `<p>${escapeHTML(data.observacoesPedido)}</p>` : ''}
        </div>` : ''}
    `;
  }

  function openModal() {
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modal.querySelector('.icon-btn').focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    lastFocusedElement?.focus?.();
  }

  function serializeDraft() {
    const data = collectData();
    data.consentimento = document.getElementById('consentimento').checked;
    return data;
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft()));
      autosaveStatus.textContent = 'Rascunho salvo automaticamente neste aparelho.';
    } catch (_) {
      autosaveStatus.textContent = 'Não foi possível salvar o rascunho neste aparelho.';
    }
  }

  function scheduleSave() {
    autosaveStatus.textContent = 'Salvando rascunho...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 450);
  }

  function restoreDraft() {
    let data;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) { return; }
    if (!data || typeof data !== 'object') return;

    const ids = ['nome','telefone','endereco','numero','bairro','cidade','complemento','referencia','observacoesPedido','troco','documentoFiscal','nomeFiscal'];
    ids.forEach((id) => {
      if (Object.hasOwn(data, id) && document.getElementById(id)) document.getElementById(id).value = data[id] || '';
    });
    document.getElementById('confirmarSubstituicao').checked = Boolean(data.confirmarSubstituicao);
    notaFiscal.checked = Boolean(data.notaFiscal);
    document.getElementById('consentimento').checked = Boolean(data.consentimento);
    if (data.pagamento) {
      const radio = form.querySelector(`input[name="pagamento"][value="${CSS.escape(data.pagamento)}"]`);
      if (radio) radio.checked = true;
    }

    itemsList.innerHTML = '';
    const items = Array.isArray(data.items) && data.items.length ? data.items.slice(0, MAX_ITEMS) : [{}];
    items.forEach(createItem);
    obsCounter.textContent = `${obs.value.length}/300`;
    updateConditionalFields();
    updateSideSummary();
  }

  function clearDraftAndForm() {
    if (!window.confirm('Deseja limpar todos os dados e itens deste pedido?')) return;
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    document.getElementById('cidade').value = 'Afonso Cláudio - ES';
    itemsList.innerHTML = '';
    createItem();
    notaWrap.hidden = true;
    trocoWrap.hidden = true;
    obsCounter.textContent = '0/300';
    document.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    document.querySelectorAll('.field-error').forEach((el) => el.textContent = '');
    updateSideSummary();
    autosaveStatus.textContent = 'Rascunho limpo.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  addItemBtn.addEventListener('click', () => {
    createItem();
    const card = itemsList.lastElementChild;
    card?.querySelector('.item-name')?.focus();
    scheduleSave();
  });

  document.getElementById('telefone').addEventListener('input', (e) => {
    formatPhone(e.target);
    clearFieldError('telefone');
  });
  document.getElementById('documentoFiscal').addEventListener('input', (e) => formatFiscalDocument(e.target));

  ['nome','endereco','bairro','cidade'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => clearFieldError(id));
  });

  form.querySelectorAll('input[name="pagamento"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.getElementById('paymentGroup').classList.remove('is-invalid');
      setFieldError('pagamento', '');
      updateConditionalFields();
      scheduleSave();
    });
  });

  notaFiscal.addEventListener('change', () => { updateConditionalFields(); scheduleSave(); });
  document.getElementById('consentimento').addEventListener('change', (e) => {
    if (e.target.checked) {
      e.target.closest('.consent-row').classList.remove('is-invalid');
      setFieldError('consentimento', '');
    }
    scheduleSave();
  });

  obs.addEventListener('input', () => {
    obsCounter.textContent = `${obs.value.length}/300`;
  });

  form.addEventListener('input', (event) => {
    if (!event.target.matches('.item-name, .item-qty, .item-obs')) scheduleSave();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm()) {
      showToast('Revise os campos destacados.');
      return;
    }
    const data = collectData();
    lastMessage = buildMessage(data);
    buildReview(data);
    saveDraft();
    openModal();
  });

  whatsappBtn.addEventListener('click', () => {
    if (!lastMessage) return;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lastMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  copyBtn.addEventListener('click', async () => {
    if (!lastMessage) return;
    try {
      await navigator.clipboard.writeText(lastMessage);
      showToast('Resumo copiado.');
      copyBtn.textContent = 'Copiado ✓';
      setTimeout(() => copyBtn.textContent = 'Copiar resumo', 1600);
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = lastMessage;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showToast('Resumo copiado.');
    }
  });

  modal.querySelectorAll('[data-close-modal]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  clearBtn.addEventListener('click', clearDraftAndForm);

  if (!localStorage.getItem(STORAGE_KEY)) createItem();
  restoreDraft();
  updateSideSummary();
})();
