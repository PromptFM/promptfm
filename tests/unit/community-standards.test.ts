import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Community Standards & Governance Files', () => {
  const rootDir = path.resolve(__dirname, '../../');

  describe('CODE_OF_CONDUCT.md', () => {
    const cocPath = path.join(rootDir, 'CODE_OF_CONDUCT.md');

    it('exists in the repository root for GitHub community detector', () => {
      expect(fs.existsSync(cocPath)).toBe(true);
    });

    it('contains Contributor Covenant v2.1 standard pledge and enforcement contact', () => {
      const content = fs.readFileSync(cocPath, 'utf8');
      expect(content).toContain('Contributor Covenant Code of Conduct');
      expect(content).toContain('Our Pledge');
      expect(content).toContain('Our Standards');
      expect(content).toContain('Enforcement Responsibilities');
      expect(content).toContain('Scope');
      expect(content).toContain('Enforcement');
      expect(content).toContain('Enforcement Guidelines');
      // Must contain contact email or admin handle
      expect(content).toMatch(/conduct@promptfm\.live|@atrifan/);
      expect(content).toContain('https://www.contributor-covenant.org/version/2/1/code_of_conduct');
    });
  });

  describe('SECURITY.md', () => {
    const secPath = path.join(rootDir, 'SECURITY.md');

    it('exists in the repository root for GitHub security overview', () => {
      expect(fs.existsSync(secPath)).toBe(true);
    });

    it('contains supported versions matrix, reporting instructions, and SLA', () => {
      const content = fs.readFileSync(secPath, 'utf8');
      expect(content).toContain('# Security Policy');
      expect(content).toContain('Supported Versions');
      expect(content).toContain('Reporting a Vulnerability');
      // Must provide private vulnerability reporting link or email
      expect(content).toMatch(/security@promptfm\.live|github\.com\/PromptFM\/promptfm\/security\/advisories/);
      expect(content).toContain('Response & SLA');
      expect(content).toContain('Safe Harbor');
    });
  });

  describe('ACCESSIBILITY.md', () => {
    const a11yPath = path.join(rootDir, 'ACCESSIBILITY.md');

    it('exists in the repository root as the additional community file', () => {
      expect(fs.existsSync(a11yPath)).toBe(true);
    });

    it('contains accessibility commitment, WCAG target, keyboard shortcuts, screen reader support, and reporting mechanism', () => {
      const content = fs.readFileSync(a11yPath, 'utf8');
      expect(content).toContain('# Accessibility Statement');
      expect(content).toContain('WCAG 2.1');
      expect(content).toContain('Keyboard Navigation');
      expect(content).toContain('Screen Reader');
      expect(content).toContain('aria-live');
      expect(content).toContain('prefers-reduced-motion');
      expect(content).toContain('Supported Environments');
      expect(content).toContain('Known Limitations');
      expect(content).toContain('Reporting Accessibility Barriers');
      expect(content).toMatch(/a11y@promptfm\.live|accessibility/);
    });
  });

  describe('Documentation & Cross-References', () => {
    it('README.md references Community Guidelines, Code of Conduct, Security, and Accessibility', () => {
      const readmePath = path.join(rootDir, 'README.md');
      const content = fs.readFileSync(readmePath, 'utf8');
      expect(content).toContain('CODE_OF_CONDUCT.md');
      expect(content).toContain('SECURITY.md');
      expect(content).toContain('ACCESSIBILITY.md');
    });

    it('docs/admin-guide.md documents how repository admins accept content reports', () => {
      const adminGuidePath = path.join(rootDir, 'docs/admin-guide.md');
      const content = fs.readFileSync(adminGuidePath, 'utf8');
      expect(content).toContain('Content Reports');
      expect(content).toContain('Moderation options');
      expect(content).toContain('Reported content');
    });
  });
});

