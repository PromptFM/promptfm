import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Infrastructure as Code (IaC) Declarations', () => {
  const projectManifestPath = path.resolve(__dirname, '../../config/github-project.json');
  const terraformGithubPath = path.resolve(__dirname, '../../infra/terraform/github.tf');
  const terraformVersionsPath = path.resolve(__dirname, '../../infra/terraform/versions.tf');

  describe('Declarative Community Project Manifest (config/github-project.json)', () => {
    it('exists and contains valid JSON', () => {
      expect(fs.existsSync(projectManifestPath)).toBe(true);
      const content = fs.readFileSync(projectManifestPath, 'utf8');
      const manifest = JSON.parse(content);
      expect(manifest.organization).toBe('PromptFM');
      expect(manifest.repository).toBe('promptfm');
      expect(manifest.project.visibility).toBe('PUBLIC');
      expect(manifest.project.number).toBe(1);
    });

    it('defines all 5 community project views with appropriate layouts', () => {
      const manifest = JSON.parse(fs.readFileSync(projectManifestPath, 'utf8'));
      const views = manifest.project.views;
      expect(views).toHaveLength(5);

      const viewNames = views.map((v: any) => v.name);
      expect(viewNames).toContain('📋 Active Backlog & Triage');
      expect(viewNames).toContain('📌 Community Kanban (Todo, In Progress, Done)');
      expect(viewNames).toContain('🗺️ Release Roadmap & Milestones');
      expect(viewNames).toContain('🏗️ Infra, Terraform & Cloud Free-Tier');
      expect(viewNames).toContain('📻 Streaming, Playback & DJs');

      const layouts = views.map((v: any) => v.layout);
      expect(layouts).toContain('TABLE_LAYOUT');
      expect(layouts).toContain('BOARD_LAYOUT');
      expect(layouts).toContain('ROADMAP_LAYOUT');
    });

    it('declares all 6 target release milestones', () => {
      const manifest = JSON.parse(fs.readFileSync(projectManifestPath, 'utf8'));
      const milestones = manifest.milestones;
      expect(milestones).toHaveLength(6);

      const titles = milestones.map((m: any) => m.title);
      expect(titles).toContain('v0.2.0 - Zero-Cost Infrastructure & Stream Server');
      expect(titles).toContain('v0.3.0 - Autonomous Playback & Station Clock Wheel');
      expect(titles).toContain('v0.4.0 - Mobile Player Ergonomics & Multi-Channel UX');
      expect(titles).toContain('v0.5.0 - Creator Community, Submissions & Safety Guardrails');
      expect(titles).toContain('v0.6.0 - Admin Studio, Web MCP & Observability');
      expect(titles).toContain('v1.0.0 - Production Readiness, Bot Ecosystem & Scale');
    });

    it('defines core issue priority and surface taxonomy labels', () => {
      const manifest = JSON.parse(fs.readFileSync(projectManifestPath, 'utf8'));
      const labelNames = manifest.labels.map((l: any) => l.name);
      expect(labelNames).toContain('urgent');
      expect(labelNames).toContain('high');
      expect(labelNames).toContain('moderate');
      expect(labelNames).toContain('low');
      expect(labelNames).toContain('client_facing');
      expect(labelNames).toContain('admin_facing');
      expect(labelNames).toContain('dev_facing');
      expect(labelNames).toContain('infra');
      expect(labelNames).toContain('ci_cd');
    });
  });

  describe('Terraform GitHub Provider & Resource Declarations', () => {
    it('declares integrations/github provider in versions.tf', () => {
      const versions = fs.readFileSync(terraformVersionsPath, 'utf8');
      expect(versions).toContain('integrations/github');
    });

    it('declares github_repository_milestone resources in github.tf', () => {
      const tf = fs.readFileSync(terraformGithubPath, 'utf8');
      expect(tf).toContain('resource "github_repository_milestone"');
      expect(tf).toContain('v0.2.0 - Zero-Cost Infrastructure & Stream Server');
      expect(tf).toContain('v0.3.0 - Autonomous Playback & Station Clock Wheel');
      expect(tf).toContain('v0.4.0 - Mobile Player Ergonomics & Multi-Channel UX');
      expect(tf).toContain('v0.5.0 - Creator Community, Submissions & Safety Guardrails');
      expect(tf).toContain('v0.6.0 - Admin Studio, Web MCP & Observability');
      expect(tf).toContain('v1.0.0 - Production Readiness, Bot Ecosystem & Scale');
    });

    it('declares github_issue_label resource map in github.tf', () => {
      const tf = fs.readFileSync(terraformGithubPath, 'utf8');
      expect(tf).toContain('resource "github_issue_label"');
      expect(tf).toContain('urgent');
      expect(tf).toContain('client_facing');
      expect(tf).toContain('infra');
    });
  });
});

