const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  let browser;
  try {
    // 1. Inicialização do navegador Playwright no modo headless
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: 'msedge' });
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Limite estrito de timeout de 30 segundos
    page.setDefaultTimeout(30000);

    // Bypass de autenticação com storageState / token injetado
    await page.addInitScript(() => {
      const mockSession = {
        access_token: 'qa-mock-jwt-token',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        user: {
          id: '11111111-2222-3333-4444-555555555555',
          email: 'qa.engenharia@hospital.gov.br',
          app_metadata: { role: 'admin', setor: 'admin' },
          user_metadata: { role: 'admin', setor: 'admin' }
        }
      };
      window.localStorage.setItem('e2e_session', JSON.stringify(mockSession));
    });

    // 2. Navegue diretamente para a rota da tela de Portaria
    await page.goto('http://localhost:3000/dashboard/portaria', { waitUntil: 'domcontentloaded' });

    // 3. Clique no botão 'Orelhinha Fono'
    const linkOrelhinha = page.locator('a, button').filter({ hasText: 'Orelhinha Fono' }).first();
    await linkOrelhinha.waitFor({ state: 'visible', timeout: 15000 });
    await linkOrelhinha.click();

    // 4. Aguarde transição para a tela de Fonoaudiologia e aguarde o modal ficar visível
    await page.waitForURL('**/dashboard/fono', { timeout: 15000 });

    const modalHeader = page.locator('text=Agendar Teste da Orelhinha');
    if (!await modalHeader.isVisible()) {
      const btnNovo = page.locator('button').filter({ hasText: 'Novo Agendamento' }).first();
      await btnNovo.waitFor({ state: 'visible', timeout: 5000 });
      await btnNovo.click();
    }

    // Aguarde o modal ficar visível
    await modalHeader.waitFor({ state: 'visible', timeout: 10000 });

    // 5. Localizar o campo 'LEITO/SETOR'
    const labelLeito = page.locator('label').filter({ hasText: 'LEITO/SETOR' }).first();
    await labelLeito.waitFor({ state: 'visible', timeout: 5000 });

    const inputLeito = labelLeito.locator('..').locator('input');
    await inputLeito.waitFor({ state: 'visible', timeout: 5000 });

    // 6. Faça uma asserção (expect) verificando se o campo 'LEITO/SETOR' possui o atributo readOnly ou está desabilitado para edição
    const isReadOnly = await inputLeito.getAttribute('readonly');
    const isDisabled = await inputLeito.isDisabled();
    const isEditable = await inputLeito.isEditable();

    const isProtegido = isReadOnly !== null || isDisabled || !isEditable;

    assert.ok(
      isProtegido,
      `O campo 'LEITO/SETOR' não está protegido para edição. (readOnly: ${isReadOnly}, disabled: ${isDisabled}, isEditable: ${isEditable})`
    );

    console.log('[SUCESSO] Teste E2E Atômico concluído com sucesso!');
    console.log(`- Rota acessada: /dashboard/portaria -> /dashboard/fono`);
    console.log(`- Botão acionado: 'Orelhinha Fono'`);
    console.log(`- Modal visível: 'Agendar Teste da Orelhinha'`);
    console.log(`- Asserção validada: Campo 'LEITO/SETOR' possui atributo readOnly=${isReadOnly !== null} (desabilitado para edição manual).`);
    process.exit(0);
  } catch (error) {
    console.error(`[FALHA] Teste E2E Atômico falhou: ${error.message}`);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
