type Env = {
  JOURNAL_IMAGES: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = context.params.path;
  if (!key || Array.isArray(key)) {
    return new Response("Not Found", { status: 404 });
  }

  const object = await context.env.JOURNAL_IMAGES.get(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");

  return new Response(object.body, { headers });
};
