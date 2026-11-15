import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const firstTrack = {
  id: 't1',
  title: 'Aurora Drift',
  artistName: 'Nova',
  audioUrl: 'https://cdn.example/aurora.mp3',
  toolUsed: 'Suno',
  upvotesCount: 4,
  coverArtUrl: null,
  category: 'Synthwave & Electro',
  previewSeconds: 15,
};

function catalogItem(index: number) {
  return {
    ...firstTrack,
    id: `t-${index}`,
    title: `Catalog Track ${index}`,
    upvotesCount: 100 - index,
  };
}

test.describe('Public song library', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.route('**/api/library**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/queue') && route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, trackId: 't1', message: 'Queued Aurora Drift' }),
        });
        return;
      }

      const pageNum = url.searchParams.get('page') || '1';
      const q = url.searchParams.get('q') || '';
      const hidden = {
        ...firstTrack,
        id: 'hidden',
        title: 'Hidden B-Side',
        artistName: 'Nova',
      };

      if (q.toLowerCase().includes('hidden')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [hidden],
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
            hasNext: false,
            previewSeconds: 15,
          }),
        });
        return;
      }

      if (pageNum === '2') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [hidden],
            page: 2,
            pageSize: 20,
            total: 25,
            totalPages: 2,
            hasNext: false,
            previewSeconds: 15,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [firstTrack, ...Array.from({ length: 19 }, (_, index) => catalogItem(index + 2))],
          page: 1,
          pageSize: 20,
          total: 25,
          totalPages: 2,
          hasNext: true,
          previewSeconds: 15,
        }),
      });
    });

    await page.route('**/api/vote', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, trackId: 't1', upvotes_count: 5, title: 'Aurora Drift' }),
      });
    });
  });

  test('lists the catalog, previews, votes, queues, pages, and stays accessible', async ({ page }) => {
    const listRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/library') && request.method() === 'GET';
    });

    await page.goto('/library');
    const initial = await listRequest;
    const initialUrl = new URL(initial.url());
    expect(initialUrl.searchParams.get('page') ?? '1').toBe('1');

    await expect(page.getByRole('heading', { name: /song library/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Library$/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /search the library/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Preview Aurora Drift for 15 seconds/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Vote for Aurora Drift/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Aurora Drift to queue/i })).toBeVisible();
    await expect(page.getByText('Hidden B-Side')).toHaveCount(0);

    await page.getByRole('button', { name: /Preview Aurora Drift for 15 seconds/i }).click();
    await expect(page.getByRole('button', { name: /Preview Aurora Drift for 15 seconds/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const voteRequest = page.waitForRequest(
      (request) => request.url().includes('/api/vote') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: /Vote for Aurora Drift/i }).click();
    expect((await voteRequest).postDataJSON()).toMatchObject({ trackId: 't1' });
    await expect(page.getByRole('button', { name: /Vote for Aurora Drift/i })).toHaveAttribute('aria-pressed', 'true');

    const queueRequest = page.waitForRequest(
      (request) => request.url().includes('/api/library/queue') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: /Add Aurora Drift to queue/i }).click();
    expect((await queueRequest).postDataJSON()).toMatchObject({ trackId: 't1' });

    const pageTwo = page.waitForRequest((request) => {
      if (request.method() !== 'GET') return false;
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/library') && url.searchParams.get('page') === '2';
    });
    await page.getByRole('button', { name: /^Next$/ }).click();
    await pageTwo;
    await expect(page.getByText('Hidden B-Side')).toBeVisible();

    const searched = page.waitForRequest((request) => {
      if (request.method() !== 'GET') return false;
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/library') && url.searchParams.get('q') === 'hidden';
    });
    await page.getByRole('textbox', { name: /search the library/i }).fill('hidden');
    await page.getByRole('button', { name: /^Search$/ }).click();
    const searchRequest = await searched;
    expect(new URL(searchRequest.url()).searchParams.get('page') ?? '1').toBe('1');
    await expect(page.getByText('Hidden B-Side')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const summary = results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact}) x${violation.nodes.length}: ${violation.nodes
          .map((node) => node.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    );
    expect(summary, `axe violations:\n${summary.join('\n')}`).toEqual([]);
  });
});
