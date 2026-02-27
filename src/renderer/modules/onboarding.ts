import type { BrowserState } from './types';

export function checkOnboarding(state: BrowserState) {
  if (!state.profile || !state.profile.onboarding_complete) {
    document.getElementById('onboarding')!.classList.remove('hidden');
  }
}

export function setupOnboarding(
  state: BrowserState,
  onGreetingUpdate: () => void,
) {
  let selectedEngine = 'google';

  document.querySelectorAll('.engine-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.engine-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedEngine = (btn as HTMLElement).dataset.engine || 'google';
    });
  });

  const goToStep = (step: number) => {
    document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`onboarding-step-${step}`)!.classList.add('active');
    document.querySelectorAll('.onboarding-dots .dot').forEach(d => d.classList.remove('active'));
    document.querySelector(`.onboarding-dots .dot[data-step="${step}"]`)!.classList.add('active');
  };

  document.getElementById('onboarding-next-1')!.addEventListener('click', async () => {
    const name = (document.getElementById('onboarding-name') as HTMLInputElement).value.trim();
    if (!name) return;
    await window.electronAPI.db.updateProfile({ name });
    goToStep(2);
  });

  document.getElementById('onboarding-next-2')!.addEventListener('click', async () => {
    state.searchEngine = selectedEngine;
    await window.electronAPI.db.updateProfile({ search_engine: selectedEngine });
    goToStep(3);
  });

  const finishOnboarding = async () => {
    const apiKey = (document.getElementById('onboarding-api-key') as HTMLInputElement).value.trim();
    if (apiKey) {
      await window.electronAPI.ai.setApiKey(apiKey);
    }
    await window.electronAPI.db.updateProfile({ onboarding_complete: 1 });
    state.profile = await window.electronAPI.db.getProfile();
    document.getElementById('onboarding')!.classList.add('hidden');
    onGreetingUpdate();
  };

  document.getElementById('onboarding-finish')!.addEventListener('click', finishOnboarding);
  document.getElementById('onboarding-skip-key')!.addEventListener('click', finishOnboarding);

  (document.getElementById('onboarding-name') as HTMLInputElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('onboarding-next-1')!.click();
  });
}
