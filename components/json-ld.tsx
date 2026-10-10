// Structured data for search engines, rendered as a JSON-LD script.
//
// `<` is escaped so a value that happens to contain `</script>` (a Grand Prix
// or display name, say) cannot close the tag early.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
