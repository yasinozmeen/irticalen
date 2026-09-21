import type { APIRoute, GetStaticPaths } from 'astro';
import { buildTopicIndex } from '../../../lib/slug';
import { renderTopicOgPng } from '../../../lib/ogImage';

export const getStaticPaths: GetStaticPaths = () => {
  return buildTopicIndex('tr').map((entry) => ({
    params: { slug: entry.slug },
    props: { topic: entry.topic },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const png = await renderTopicOgPng(props.topic as string, 'tr');
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
