import { describe, expect, it } from 'vitest';
import { actionUnavailableReason } from './actionAvailability.js';

describe('Action availability across discovery surfaces', () => {
  it.each(['newTransaction', 'importStatement', 'newDebt', 'openSettings'])('explains why %s cannot open an editor while writes are paused', action => {
    expect(actionUnavailableReason(action, { readOnly: true })).toContain('edición está pausada');
    expect(actionUnavailableReason(action)).toBe('');
  });

  it.each(['exportExcel', 'exportBackup', 'openAssistant', 'openSettings', 'newTransaction', 'importStatement', 'newDebt'])('does not expose private actions through search: %s', action => {
    expect(actionUnavailableReason(action, { privacyMode: true })).toContain('Muestra tu información');
    expect(actionUnavailableReason(action, { privacyMode: true, readOnly: true })).toContain('Muestra tu información');
  });

  it('keeps consultation and export available when only editing is paused', () => {
    for (const action of ['exportExcel', 'exportBackup', 'openAssistant', 'openRoadmap', 'openPricing']) {
      expect(actionUnavailableReason(action, { readOnly: true })).toBe('');
    }
    expect(actionUnavailableReason('openRoadmap', { privacyMode: true })).toBe('');
    expect(actionUnavailableReason('openPricing', { privacyMode: true })).toBe('');
  });
});
