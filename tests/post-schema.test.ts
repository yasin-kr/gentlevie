import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostSchema, publishPostSchema } from '../lib/post-schema';

const validPost = {
  title: 'Yeni bir bakış',
  subtitle: 'Gündelik hayatta küçük ayrıntılar',
  slug: 'yeni-bir-bakis',
  category: 'journal',
  image: '/assets/hero.webp',
  paragraphs: ['Bir öğleden sonra çevremize yeniden bakıyoruz.'],
};

test('new posts default to drafts without announcements', () => {
  const post = createPostSchema.parse(validPost);
  assert.equal(post.status, 'draft');
  assert.equal(post.notify, false);
});

test('seed article slugs cannot be overwritten', () => {
  for (const slug of ['az-parcayla-kendin-gibi', 'bir-sabahin-kucuk-rituelleri', 'bir-yere-yetismeden']) {
    assert.equal(createPostSchema.safeParse({ ...validPost, slug }).success, false);
  }
});

test('only editorial categories and local curated images are accepted', () => {
  assert.equal(createPostSchema.safeParse({ ...validPost, category: 'admin' }).success, false);
  assert.equal(createPostSchema.safeParse({ ...validPost, image: 'https://outside.example/image.jpg' }).success, false);
});

test('post titles remain valid announcement subject lines', () => {
  for (const title of ['İlk satır\nİkinci satır', 'İlk satır\rİkinci satır']) {
    assert.equal(createPostSchema.safeParse({ ...validPost, title, status: 'published', notify: true }).success, false);
  }
  assert.equal(createPostSchema.safeParse({ ...validPost, status: 'published', notify: true }).success, true);
});

test('unsafe slugs, unknown fields and excessive text are rejected', () => {
  for (const slug of ['../test', 'has spaces', '<script>', 'UPPER', '-edge', 'edge-']) {
    assert.equal(createPostSchema.safeParse({ ...validPost, slug }).success, false);
  }
  assert.equal(createPostSchema.safeParse({ ...validPost, authorRole: 'admin' }).success, false);
  assert.equal(createPostSchema.safeParse({ ...validPost, paragraphs: Array(11).fill('x'.repeat(3000)) }).success, false);
  assert.equal(createPostSchema.safeParse({ ...validPost, paragraphs: [] }).success, false);
});

test('publication accepts only a valid identifier and explicit published state', () => {
  assert.equal(publishPostSchema.safeParse({ id: 'not-an-id', status: 'published' }).success, false);
  assert.equal(publishPostSchema.safeParse({ id: '507f1f77bcf86cd799439011', status: 'draft' }).success, false);
  const request = publishPostSchema.parse({ id: '507f1f77bcf86cd799439011', status: 'published', notify: true });
  assert.equal(request.notify, true);
});
