import { site } from "@/lib/config";

// Filters on a list run in the browser, so a program that fetches the page
// sees the unfiltered first screen. This points it (and anyone curious) at the
// text version, which applies the same filters on the server.
export function AgentNote({ base }: { base: string }) {
  const text = `${site.url}${base}/llms.txt`;
  return (
    <p className="pb-10 text-sm leading-relaxed text-soft">
      Using an AI assistant? Filters on this page run in your browser, so a fetched copy is unfiltered. The same list as
      plain text, with filters applied and paged, is at{" "}
      <a href={`${base}/llms.txt`} className="underline underline-offset-4">
        {text}
      </a>{" "}
      (add for example <code>?g=college-junior&amp;f=tech&amp;gpa=3.6&amp;n=y&amp;st=TX&amp;page=1</code>). Every parameter is
      listed at{" "}
      <a href="/llms.txt" className="underline underline-offset-4">
        {site.url}/llms.txt
      </a>
      .
    </p>
  );
}
